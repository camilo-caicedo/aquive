import { and, eq, inArray, ne } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import { catalogoServicios, perfiles, servidores } from '@/db/esquema'
import { contienePII } from '@/lib/validacion'

// La matrícula profesional de quien está en sesión.
//
// Vivía dentro de `crear_perfil`, una función de PL/pgSQL que el navegador
// llamaba directo y que hacía tres cosas a la vez: crear el perfil, elegir su
// tipo y escribir la matrícula. Al retirarse `/registro` (ADR 0014) esto se
// quedaba sin puerta, así que sale a su propia pantalla y a su propio
// procedimiento (ADR 0015).
//
// Regla 1 de arquitectura: nada de `next/*`.

export class MatriculaRechazada extends Error {}

export type MiMatricula = {
  profesion: string
  // v6-f5-barrio-y-direccion.sql las volvió opcionales: un `servidor` puede
  // existir sin matrícula todavía declarada.
  entidad_matricula: string | null
  numero_matricula: string | null
  servicios: string[]
  verificado: boolean
}

export async function mia(
  db: BaseDeDatos,
  llave: { usuarioId: string | null },
): Promise<MiMatricula | null> {
  if (!llave.usuarioId) return null

  const [fila] = await db
    .select()
    .from(servidores)
    .where(eq(servidores.perfilId, llave.usuarioId))
    .limit(1)

  if (!fila) return null

  return {
    profesion: fila.profesion,
    entidad_matricula: fila.entidadMatricula,
    numero_matricula: fila.numeroMatricula,
    servicios: fila.servicios,
    verificado: fila.verificado,
  }
}

/**
 * Declarar o corregir la matrícula.
 *
 * ⚠ Es lo único que sube una cuenta de `vecino` a `servidor`, y por eso es lo
 * único que escribe `acepto_publicacion` y `autorizacion_version` del perfil:
 * `servidores_publicos` publica el nombre y el teléfono de esta persona, y esa
 * es la finalidad que se está autorizando (mínimo legal 2).
 *
 * ⚠ Y nunca escribe `verificado`. Nada nace verificado (regla de producto 6):
 * una persona de la fundación consulta el número en el registro de la entidad,
 * a mano. Cambiar el número **borra** la verificación anterior, por lo mismo
 * que cambiar el teléfono la borra en la ficha del prestador: lo comprobado
 * era el número viejo.
 */
export async function guardar(
  db: BaseDeDatos,
  entrada: {
    profesion: string
    entidad_matricula: string
    numero_matricula: string
    servicios: string[]
    contacto_publico: string
    contacto_tipo: 'whatsapp' | 'telefono'
    autorizacion_version: string
  },
  llave: { usuarioId: string | null },
): Promise<{ ok: true }> {
  if (!llave.usuarioId) {
    throw new MatriculaRechazada('Tienes que entrar para declarar tu matrícula.')
  }

  const [perfil] = await db
    .select({ id: perfiles.id })
    .from(perfiles)
    .where(eq(perfiles.id, llave.usuarioId))
    .limit(1)
  if (!perfil) {
    throw new MatriculaRechazada('Primero abre tu cuenta: tu nombre y tu municipio.')
  }

  if (contienePII(entrada.profesion)) {
    throw new MatriculaRechazada(
      'La profesión no puede llevar teléfonos, correos ni cédulas.',
    )
  }

  // Que el número sea de otra persona no es un fallo del formulario: es que
  // alguien está declarando una matrícula que no es suya. Se dice claro.
  const [ajena] = await db
    .select({ perfilId: servidores.perfilId })
    .from(servidores)
    .where(
      and(
        eq(servidores.entidadMatricula, entrada.entidad_matricula),
        eq(servidores.numeroMatricula, entrada.numero_matricula),
        ne(servidores.perfilId, llave.usuarioId),
      ),
    )
    .limit(1)
  if (ajena) {
    throw new MatriculaRechazada('Esa matrícula ya está registrada por otra persona.')
  }

  // Los servicios se comprueban TODOS de una consulta: uno apagado tiene que
  // tumbar el guardado, no colarse callado.
  if (entrada.servicios.length > 0) {
    const validos = await db
      .select({ id: catalogoServicios.id })
      .from(catalogoServicios)
      .where(
        and(
          inArray(catalogoServicios.id, entrada.servicios),
          eq(catalogoServicios.activo, true),
        ),
      )
    if (validos.length !== new Set(entrada.servicios).size) {
      throw new MatriculaRechazada('Alguno de esos servicios ya no está en la lista.')
    }
  }

  const [previa] = await db
    .select({ numero: servidores.numeroMatricula, entidad: servidores.entidadMatricula })
    .from(servidores)
    .where(eq(servidores.perfilId, llave.usuarioId))
    .limit(1)

  const cambioElNumero =
    !!previa &&
    (previa.numero !== entrada.numero_matricula ||
      previa.entidad !== entrada.entidad_matricula)

  await db
    .insert(servidores)
    .values({
      perfilId: llave.usuarioId,
      profesion: entrada.profesion,
      entidadMatricula: entrada.entidad_matricula,
      numeroMatricula: entrada.numero_matricula,
      servicios: entrada.servicios,
    })
    .onConflictDoUpdate({
      target: servidores.perfilId,
      set: {
        profesion: entrada.profesion,
        entidadMatricula: entrada.entidad_matricula,
        numeroMatricula: entrada.numero_matricula,
        servicios: entrada.servicios,
        // Lo comprobado era el número viejo.
        ...(cambioElNumero
          ? { verificado: false, verificadoAt: null, verificadoPor: null }
          : {}),
      },
    })

  // El perfil sube a `servidor` con su autorización. Es lo que hace que
  // `servidores_publicos` —que filtra por `p.tipo = 'servidor'`— lo saque.
  await db
    .update(perfiles)
    .set({
      tipo: 'servidor',
      contactoPublico: entrada.contacto_publico,
      contactoTipo: entrada.contacto_tipo,
      aceptoPublicacion: true,
      autorizacionVersion: entrada.autorizacion_version,
      aceptoPoliticaAt: new Date().toISOString(),
    })
    .where(eq(perfiles.id, llave.usuarioId))

  return { ok: true }
}
