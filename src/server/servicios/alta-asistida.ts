import { and, eq, inArray, sql } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import {
  catalogoOficios,
  miembrosOrganizacion,
  municipios,
  organizaciones,
  proveedorOficios,
  proveedores,
  zonas,
} from '@/db/esquema'
import { contienePII } from '@/lib/validacion'
import { crearCuenta } from '@/server/cuentas/alta'

export class AltaRechazada extends Error {}

const MODALIDADES = ['domicilio', 'local', 'remoto'] as const
const MODOS = ['gratis', 'aporte', 'solidario', 'normal'] as const

export interface EntradaAlta {
  organizacion_id: string
  nombre_visible: string
  tipo: 'persona' | 'microempresa'
  telefono: string
  municipio: string
  zona_id?: string
  zona_texto?: string
  modalidad: string[]
  oficios: { oficio_id: string; modo: string }[]
  autorizacion_version: string
}

/**
 * Alta asistida: alguien del equipo de un centro de acopio registra a un
 * prestador que no tiene cuenta de Google.
 *
 * ⚠ Esto era `crear_proveedor_asistido`, y llevaba roto desde el ADR 0006.
 * Insertaba en `proveedores.token_hash`, columna que ese ADR borró, así que
 * cada intento moría con «column does not exist». Y aunque hubiera pasado,
 * el enlace que el panel entregaba —`/servicios/mi-perfil/<token>`— apunta a
 * una ruta que también desapareció con el ADR 0006.
 *
 * Ahora hace lo que el ADR 0006 dijo que había que hacer: **una cuenta de
 * verdad**. La persona queda con su `perfil_id` como cualquiera que entre
 * con Google, y recibe el mismo código de acceso que reparte `/admin/cuentas`,
 * que se canjea en `/entrar/<codigo>`. Una sola manera de ser dueño de algo.
 *
 * Lo que cambia respecto al alta del admin es solo quién puede: aquí no hace
 * falta ser administrador, basta ser miembro activo de esa organización. Es
 * la gente que está en la calle con la persona enfrente.
 */
export async function registrar(
  db: BaseDeDatos,
  entrada: EntradaAlta,
  llave: { usuarioId: string | null },
): Promise<{ proveedor_id: string; perfil_id: string; codigo: string }> {
  if (!llave.usuarioId) throw new AltaRechazada('No autorizado.')

  // Miembro ACTIVO de una organización ACTIVA. Va en la consulta y no en un
  // `if` suelto: es lo que impide dar de alta a nombre de una fundación de
  // la que uno se salió, o de una que se dio de baja.
  const [miembro] = await db
    .select({ id: miembrosOrganizacion.perfilId })
    .from(miembrosOrganizacion)
    .innerJoin(organizaciones, eq(organizaciones.id, miembrosOrganizacion.organizacionId))
    .where(
      and(
        eq(miembrosOrganizacion.organizacionId, entrada.organizacion_id),
        eq(miembrosOrganizacion.perfilId, llave.usuarioId),
        eq(miembrosOrganizacion.estado, 'activo'),
        eq(organizaciones.activa, true),
      ),
    )
    .limit(1)
  if (!miembro) throw new AltaRechazada('No perteneces a esa organización.')

  const nombre = entrada.nombre_visible.trim()
  const telefono = entrada.telefono.trim()
  const zonaTexto = entrada.zona_texto?.trim() || null

  // Los dos campos libres, con su filtro (regla de producto 4). Aquí los
  // escribe una tercera persona sobre alguien que está delante, así que el
  // filtro importa igual: un segundo teléfono en el nombre se publica.
  if (contienePII(nombre)) {
    throw new AltaRechazada('El nombre no puede llevar teléfonos ni correos.')
  }
  if (zonaTexto && contienePII(zonaTexto)) {
    throw new AltaRechazada('El barrio no puede llevar teléfonos ni correos.')
  }
  if (!/^[0-9+()\- ]{7,20}$/.test(telefono)) {
    throw new AltaRechazada('Revisa el teléfono.')
  }
  if (entrada.autorizacion_version.trim().length < 3) {
    throw new AltaRechazada('Falta la versión del texto de autorización.')
  }

  if (
    entrada.modalidad.length === 0 ||
    !entrada.modalidad.every((m) => (MODALIDADES as readonly string[]).includes(m))
  ) {
    throw new AltaRechazada('Di dónde atiende esta persona.')
  }
  if (entrada.oficios.length === 0) {
    throw new AltaRechazada('Elige al menos un oficio.')
  }
  if (!entrada.oficios.every((o) => (MODOS as readonly string[]).includes(o.modo))) {
    throw new AltaRechazada('Modo de precio no válido.')
  }

  const [municipio] = await db
    .select({ codigo: municipios.codigoDane })
    .from(municipios)
    .where(eq(municipios.codigoDane, entrada.municipio))
    .limit(1)
  if (!municipio) throw new AltaRechazada('Municipio inválido.')

  // Al menos una: sin ubicación dentro del municipio, nadie sabe si le queda
  // cerca y la ficha no le sirve a nadie.
  if (!entrada.zona_id && !zonaTexto) {
    throw new AltaRechazada('Di al menos la comuna o el barrio donde trabaja.')
  }
  if (entrada.zona_id) {
    const [zona] = await db
      .select({ id: zonas.id })
      .from(zonas)
      .where(
        and(
          eq(zonas.id, entrada.zona_id),
          eq(zonas.municipio, entrada.municipio),
          eq(zonas.activa, true),
          eq(zonas.estado, 'aprobada'),
        ),
      )
      .limit(1)
    if (!zona) throw new AltaRechazada('Esa zona no es de ese municipio.')
  }

  // Los oficios salen del catálogo, no de lo que mande el cliente. Se
  // comprueban TODOS de una consulta: uno apagado tiene que tumbar el alta,
  // no colarse callado.
  const ids = entrada.oficios.map((o) => o.oficio_id)
  const validos = await db
    .select({ id: catalogoOficios.id })
    .from(catalogoOficios)
    .where(and(inArray(catalogoOficios.id, ids), eq(catalogoOficios.activo, true)))
  if (validos.length !== new Set(ids).size) {
    throw new AltaRechazada('Alguno de esos oficios ya no está en la lista.')
  }

  let proveedorId = ''

  const { perfil_id, codigo } = await crearCuenta(
    db,
    {
      nombre_visible: nombre,
      // El teléfono es público en la ficha, así que también es el contacto
      // del perfil: son el mismo número y la misma autorización.
      contacto_publico: telefono,
      contacto_tipo: 'whatsapp',
      municipios: [entrada.municipio],
      tipo: 'servidor',
    },
    llave.usuarioId,
    async (perfilId) => {
      const [fila] = await db
        .insert(proveedores)
        .values({
          perfilId,
          organizacionId: entrada.organizacion_id,
          altaAsistida: true,
          nombreVisible: nombre,
          tipo: entrada.tipo,
          telefono,
          municipio: entrada.municipio,
          zonaId: entrada.zona_id ?? null,
          zonaTexto,
          modalidad: entrada.modalidad,
          aceptoPublicacion: true,
          autorizacionVersion: entrada.autorizacion_version.trim(),
        })
        .returning({ id: proveedores.id })

      proveedorId = fila.id

      await db.insert(proveedorOficios).values(
        entrada.oficios.map((o) => ({
          proveedorId: fila.id,
          oficioId: o.oficio_id,
          modo: o.modo,
        })),
      )

      // El barrio escrito a mano se propone como zona del municipio, pero
      // solo donde todavía no hay desplegable: la función lo decide. Es un
      // catálogo, así que se queda en Postgres.
      if (zonaTexto) {
        await db.execute(
          sql`select public.proponer_zona(${entrada.municipio}, ${zonaTexto})`,
        )
      }
    },
  )

  return { proveedor_id: proveedorId, perfil_id, codigo }
}
