import { eq } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import { perfiles } from '@/db/esquema'
import { contienePII } from '@/lib/validacion'
import { CuentaRechazada } from './alta'

// La cuenta propia: la que abre cualquiera al entrar con Google (ADR 0015).
//
// Vive al lado de `alta.ts` —la que abre un admin para otra persona— porque
// escriben la misma tabla con las mismas reglas. Lo único que cambia es quién
// autoriza: aquí nadie, porque cada quien abre la suya.
//
// Regla 1 de arquitectura del ADR 0001: nada de `next/*`. Recibe el
// identificador de sesión como argumento y no sabe de dónde salió.

/** Lo que devuelve `mia`. El gemelo del esquema del contrato. */
export type MiCuenta = {
  nombre_visible: string
  municipios: string[]
  contacto_publico: string | null
  contacto_tipo: 'whatsapp' | 'telefono'
  descripcion: string | null
  tipo: 'vecino' | 'servidor' | 'aliado'
  acepto_publicacion: boolean
  creado_at: string
}

export async function mia(
  db: BaseDeDatos,
  llave: { usuarioId: string | null },
): Promise<MiCuenta | null> {
  if (!llave.usuarioId) return null

  const [fila] = await db
    .select()
    .from(perfiles)
    .where(eq(perfiles.id, llave.usuarioId))
    .limit(1)

  if (!fila) return null

  return {
    nombre_visible: fila.nombreVisible,
    municipios: fila.municipios,
    contacto_publico: fila.contactoPublico,
    contacto_tipo: fila.contactoTipo as MiCuenta['contacto_tipo'],
    descripcion: fila.descripcion,
    tipo: fila.tipo as MiCuenta['tipo'],
    acepto_publicacion: fila.aceptoPublicacion,
    creado_at: fila.creadoAt,
  }
}

/**
 * Abrir la cuenta. Nombre y municipio, y nada más.
 *
 * ⚠ `tipo: 'vecino'`, `aceptoPublicacion: false` y `autorizacionVersion: null`
 * van escritos aquí y no se pueden pasar desde fuera. Una cuenta recién
 * abierta no publica nada, y el `CHECK perfiles_autorizacion_completa` de la
 * base dice lo mismo por su lado: sin publicación no hace falta versión.
 *
 * ⚠ `DO NOTHING` y no `DO UPDATE`. Si ya hay perfil, esto no es un alta: es
 * alguien que llegó dos veces, o una pantalla que no comprobó. Pisar sus datos
 * con lo que traiga la segunda llamada es peor que rechazarla.
 */
export async function abrir(
  db: BaseDeDatos,
  entrada: { nombre_visible: string; municipios: string[] },
  llave: { usuarioId: string | null },
): Promise<{ ok: true }> {
  if (!llave.usuarioId) {
    throw new CuentaRechazada('Tienes que entrar para abrir tu cuenta.')
  }

  // El mismo filtro que en todo lo demás (regla de producto 4). El nombre es
  // lo único libre de esta pantalla, y va a ser público en cuanto esta persona
  // publique cualquier cosa.
  if (contienePII(entrada.nombre_visible)) {
    throw new CuentaRechazada(
      'El nombre no puede llevar teléfonos, correos ni cédulas.',
    )
  }

  const filas = await db
    .insert(perfiles)
    .values({
      id: llave.usuarioId,
      nombreVisible: entrada.nombre_visible,
      tipo: 'vecino',
      municipios: entrada.municipios,
      contactoPublico: null,
      contactoTipo: 'whatsapp',
      aceptoPublicacion: false,
      autorizacionVersion: null,
      aceptoPoliticaAt: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: perfiles.id })
    .returning({ id: perfiles.id })

  if (filas.length === 0) {
    throw new CuentaRechazada('Tu cuenta ya estaba abierta.')
  }

  return { ok: true }
}

/**
 * Editar los datos de la cuenta.
 *
 * ⚠ Lo que NO escribe, y es a propósito: `tipo`, `acepto_publicacion` y
 * `autorizacion_version`. Pasar de vecino a prestador o a profesional es dar
 * una autorización de publicación, con su versión y su fecha, y eso ocurre en
 * la pantalla que publica —el carné, la matrícula—, no en la que corrige un
 * teléfono. Si algún día esta función acepta un `tipo`, el consentimiento deja
 * de tener rastro de dónde se dio.
 */
export async function guardar(
  db: BaseDeDatos,
  entrada: {
    nombre_visible: string
    municipios: string[]
    contacto_publico?: string | null
    contacto_tipo?: 'whatsapp' | 'telefono'
    descripcion?: string | null
  },
  llave: { usuarioId: string | null },
): Promise<{ ok: true }> {
  if (!llave.usuarioId) {
    throw new CuentaRechazada('Tienes que entrar para cambiar tus datos.')
  }

  if (contienePII(entrada.nombre_visible)) {
    throw new CuentaRechazada(
      'El nombre no puede llevar teléfonos, correos ni cédulas.',
    )
  }
  if (entrada.descripcion && contienePII(entrada.descripcion)) {
    throw new CuentaRechazada(
      'La presentación no puede llevar teléfonos, correos ni cédulas.',
    )
  }

  // ⚠ Quien publica NO puede quedarse sin teléfono: el `CHECK
  // perfiles_contacto_publico_check` lo exige para `servidor`, y ahí es por
  // donde le escriben. La base lo rechazaría igual, pero con un mensaje que
  // no se puede enseñar.
  const actual = await mia(db, llave)
  if (!actual) throw new CuentaRechazada('Todavía no has abierto tu cuenta.')
  const contacto =
    entrada.contacto_publico === undefined
      ? actual.contacto_publico
      : entrada.contacto_publico
  if (actual.tipo === 'servidor' && !contacto) {
    throw new CuentaRechazada(
      'Tu ficha de profesional se publica con un teléfono: es por donde te escriben.',
    )
  }

  await db
    .update(perfiles)
    .set({
      nombreVisible: entrada.nombre_visible,
      municipios: entrada.municipios,
      contactoPublico: contacto,
      ...(entrada.contacto_tipo ? { contactoTipo: entrada.contacto_tipo } : {}),
      ...(entrada.descripcion === undefined
        ? {}
        : { descripcion: entrada.descripcion || null }),
    })
    .where(eq(perfiles.id, llave.usuarioId))

  return { ok: true }
}
