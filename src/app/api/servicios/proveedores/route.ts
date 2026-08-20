import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generarToken, hashToken } from '@/lib/tokens'
import { AUTORIZACION_PROVEEDOR_VERSION } from '@/lib/config'
import { contienePII } from '@/lib/validacion'
import type { ModalidadServicio } from '@/lib/types'

/**
 * Alta asistida: un miembro de una organización aliada registra a alguien
 * que no tiene cuenta de Google.
 *
 * Va por route handler y no por RPC desde el cliente porque el token se
 * genera aquí: `generarToken` necesita el crypto del servidor, y la RPC
 * recibe solo el hash. Así el token en claro existe una vez, viaja en
 * esta respuesta y no queda escrito en ningún registro de Postgres.
 *
 * Se devuelve UNA vez. No hay forma de volver a verlo, y eso se le dice
 * al aliado en pantalla antes de que cierre.
 */
export async function POST(request: Request) {
  let cuerpo: unknown
  try {
    cuerpo = await request.json()
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }

  const b = cuerpo as Record<string, unknown>

  const nombre = typeof b.nombre === 'string' ? b.nombre.trim() : ''
  if (nombre.length < 3 || nombre.length > 60) {
    return NextResponse.json(
      { error: 'El nombre debe tener entre 3 y 60 caracteres' },
      { status: 400 }
    )
  }
  if (contienePII(nombre)) {
    return NextResponse.json(
      { error: 'El nombre no puede llevar teléfonos ni correos' },
      { status: 400 }
    )
  }

  const telefono = typeof b.telefono === 'string' ? b.telefono.trim() : ''
  if (!/^[0-9+()\- ]{7,20}$/.test(telefono)) {
    return NextResponse.json({ error: 'Revisa el teléfono' }, { status: 400 })
  }

  if (b.tipo !== 'persona' && b.tipo !== 'microempresa') {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }
  if (typeof b.municipio !== 'string' || !/^[0-9]{5}$/.test(b.municipio)) {
    return NextResponse.json({ error: 'Municipio inválido' }, { status: 400 })
  }
  if (typeof b.organizacion_id !== 'string') {
    return NextResponse.json({ error: 'Falta la organización' }, { status: 400 })
  }
  const MODALIDADES_VALIDAS: ModalidadServicio[] = ['domicilio', 'local', 'remoto']
  if (
    !Array.isArray(b.modalidad) ||
    b.modalidad.length === 0 ||
    !b.modalidad.every((m): m is ModalidadServicio =>
      MODALIDADES_VALIDAS.includes(m as ModalidadServicio)
    )
  ) {
    return NextResponse.json({ error: 'Di dónde atiende esta persona' }, { status: 400 })
  }
  const modalidad = b.modalidad as ModalidadServicio[]
  if (!Array.isArray(b.oficios) || b.oficios.length === 0) {
    return NextResponse.json({ error: 'Elige al menos un oficio' }, { status: 400 })
  }
  const zonaTexto = typeof b.zona_texto === 'string' ? b.zona_texto.trim() : ''
  if (zonaTexto && contienePII(zonaTexto)) {
    return NextResponse.json(
      { error: 'La zona no puede llevar teléfonos ni correos' },
      { status: 400 }
    )
  }

  // Cliente de sesión, no de servicio: la RPC comprueba con `auth.uid()`
  // que quien llama sea miembro activo de esa organización. Con la llave
  // de servicio esa comprobación se caería y cualquiera con la ruta
  // podría dar de alta a nombre de cualquier fundación.
  const supabase = await createClient()

  const token = generarToken()

  const { data, error } = await supabase.rpc('crear_proveedor_asistido', {
    p_organizacion_id: b.organizacion_id,
    p_token_hash: hashToken(token),
    p_nombre_visible: nombre,
    p_tipo: b.tipo,
    p_telefono: telefono,
    p_municipio: b.municipio,
    p_zona_id: typeof b.zona_id === 'string' && b.zona_id ? b.zona_id : null,
    p_zona_texto: zonaTexto || null,
    p_modalidad: modalidad,
    p_oficios: b.oficios as never,
    p_autorizacion_version: AUTORIZACION_PROVEEDOR_VERSION,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // El token en claro sale de aquí y no vuelve. Nada de esto se loggea
  // (regla 6).
  return NextResponse.json({ ok: true, id: data, token })
}
