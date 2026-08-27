import { createHash, randomBytes } from 'node:crypto'

import { desc, eq } from 'drizzle-orm'

import type { BaseDeDatos } from '@/db/cliente'
import { codigosAcceso, perfiles } from '@/db/esquema'
import { createServiceClient } from '@/lib/supabase/service'
import { contienePII } from '@/lib/validacion'
import { esAdmin } from '@/server/imagenes/recorrido'

export class CuentaRechazada extends Error {}

/**
 * La cuenta que crea un admin para quien no tiene Google (ADR 0006).
 *
 * Desde ese ADR todo exige cuenta. Buena parte del rebusque no tiene cuenta
 * de Google —y es a quien la aplicación quiere incluir—, así que sin esta
 * puerta el cambio los deja fuera. Es la parte del ADR que hace que el
 * resto sea aceptable, no un añadido.
 *
 * ⚠ El correo que se guarda es SINTÉTICO. Supabase Auth necesita uno para
 * crear el usuario; el de la persona no se pide y no se guarda, igual que
 * con Google. El dominio `sin-correo.aquive.invalid` es de la RFC 2606:
 * está reservado para que nunca resuelva, así que ese buzón no puede
 * existir ni por accidente.
 *
 * ⚠ El código de acceso es, en la práctica, una contraseña en un papel.
 * Es consciente: quien no tiene correo tampoco tiene cómo recuperar una
 * cuenta, y un enlace que caduca en una hora deja fuera a quien lo recibió
 * el martes y vuelve el jueves. Lo que se hace en vez de caducarlo está en
 * la migración `v5-a1`, y lo importante es que hay UNO por persona: darle
 * otro invalida el anterior, y ese es el botón para cuando alguien pierde
 * el papel.
 */
const DOMINIO_SINTETICO = 'sin-correo.aquive.invalid'

/** El código en claro. Solo existe en el valor que devuelve `crear`. */
function nuevoCodigo() {
  const codigo = randomBytes(32).toString('base64url')
  return { codigo, hash: createHash('sha256').update(codigo).digest('hex') }
}

async function exigirAdmin(db: BaseDeDatos, usuarioId: string | null) {
  if (!(await esAdmin(db, usuarioId))) {
    throw new CuentaRechazada('Esto solo lo puede hacer un administrador.')
  }
}

/**
 * La cuenta en sí: usuario de Auth, perfil y código de acceso.
 *
 * Vive aparte de `crear` porque hay DOS puertas de alta asistida y las dos
 * necesitan exactamente esto: la del admin, y la del aliado que registra a
 * un prestador en la calle. Lo que cambia entre ellas es quién está
 * autorizado y qué se crea DESPUÉS; la cuenta se crea igual, y duplicarla
 * sería duplicar el rollback del final, que es la parte que importa.
 *
 * No comprueba permisos. Lo hace quien la llama, que es quien sabe cuáles.
 */
export async function crearCuenta(
  db: BaseDeDatos,
  entrada: {
    nombre_visible: string
    contacto_publico?: string
    contacto_tipo?: 'whatsapp' | 'telefono'
    municipios: string[]
    tipo: 'vecino' | 'ofertador' | 'servidor'
  },
  creadoPor: string | null,
  /** Qué hacer con la cuenta recién creada, antes de darla por buena. */
  despues?: (perfilId: string) => Promise<void>,
): Promise<{ perfil_id: string; codigo: string }> {
  // El nombre es lo único libre y va a ser público si esa persona publica
  // algo. Mismo filtro que en todo lo demás (regla de producto 4).
  if (contienePII(entrada.nombre_visible)) {
    throw new CuentaRechazada(
      'El nombre no puede llevar teléfonos, correos ni cédulas.',
    )
  }
  if (entrada.tipo !== 'vecino' && !entrada.contacto_publico) {
    throw new CuentaRechazada(
      'Quien va a ofrecer algo necesita un teléfono público: es por donde le escriben.',
    )
  }

  const admin = createServiceClient()

  const { data, error } = await admin.auth.admin.createUser({
    email: `${crypto.randomUUID()}@${DOMINIO_SINTETICO}`,
    email_confirm: true,
    user_metadata: { alta_asistida: true },
  })
  if (error || !data.user) {
    throw new CuentaRechazada('No se pudo crear la cuenta. Inténtalo otra vez.')
  }

  const { codigo, hash } = nuevoCodigo()

  try {
    await db.insert(perfiles).values({
      id: data.user.id,
      nombreVisible: entrada.nombre_visible,
      tipo: entrada.tipo,
      municipios: entrada.municipios,
      contactoPublico: entrada.contacto_publico ?? null,
      contactoTipo: entrada.contacto_tipo ?? 'whatsapp',
      aceptoPublicacion: entrada.tipo !== 'vecino',
      aceptoPoliticaAt: new Date().toISOString(),
    })
    await db.insert(codigosAcceso).values({
      perfilId: data.user.id,
      codigoHash: hash,
      creadoPor,
    })
    // La ficha del prestador, cuando la hay. Va DENTRO del try: si falla,
    // la limpieza de abajo borra también la cuenta, y no queda alguien con
    // un código que no lleva a ninguna parte.
    if (despues) await despues(data.user.id)
  } catch (e) {
    // Sin esto queda un usuario de Auth sin perfil: no puede entrar a
    // nada y nadie sabe que existe. El fallo de la limpieza no se traga
    // el error original, que es el que explica qué pasó.
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {})
    throw e
  }

  return { perfil_id: data.user.id, codigo }
}

/** El alta que hace un admin desde `/admin/cuentas`. */
export async function crear(
  db: BaseDeDatos,
  entrada: {
    nombre_visible: string
    /** Solo para quien va a ofrecer algo. Quien solo pide no lo da. */
    contacto_publico?: string
    contacto_tipo?: 'whatsapp' | 'telefono'
    municipios: string[]
    tipo: 'vecino' | 'ofertador' | 'servidor'
  },
  llave: { usuarioId: string | null },
): Promise<{ perfil_id: string; codigo: string }> {
  await exigirAdmin(db, llave.usuarioId)
  return await crearCuenta(db, entrada, llave.usuarioId)
}

/** Cuando alguien pierde el papel, o se lo quitan. Invalida el anterior. */
export async function regenerar(
  db: BaseDeDatos,
  perfilId: string,
  llave: { usuarioId: string | null },
): Promise<{ codigo: string }> {
  await exigirAdmin(db, llave.usuarioId)

  const { codigo, hash } = nuevoCodigo()
  const filas = await db
    .update(codigosAcceso)
    .set({ codigoHash: hash, creadoPor: llave.usuarioId, usadoAt: null })
    .where(eq(codigosAcceso.perfilId, perfilId))
    .returning({ perfilId: codigosAcceso.perfilId })

  if (filas.length === 0) {
    throw new CuentaRechazada('Esa cuenta no la creó un administrador.')
  }
  return { codigo }
}

/**
 * Cambiar el código por una sesión.
 *
 * Devuelve el enlace de Supabase que la crea. Se pide EN ESTE MOMENTO y no
 * al dar de alta: ese enlace caduca en una hora, así que generarlo antes
 * sería entregarle a alguien un papel que ya no sirve.
 */
export async function canjear(
  db: BaseDeDatos,
  codigo: string,
): Promise<{ url: string } | null> {
  const hash = createHash('sha256').update(codigo).digest('hex')

  const [fila] = await db
    .select({ perfilId: codigosAcceso.perfilId })
    .from(codigosAcceso)
    .where(eq(codigosAcceso.codigoHash, hash))
    .limit(1)

  if (!fila) return null

  const admin = createServiceClient()
  const { data: usuario } = await admin.auth.admin.getUserById(fila.perfilId)
  if (!usuario.user?.email) return null

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: usuario.user.email,
  })
  if (error || !data.properties?.action_link) return null

  // La última entrada, no un consumo: el código sigue sirviendo. Sirve para
  // que un admin vea si sigue en uso, y para notar una entrada que su dueño
  // no hizo.
  await db
    .update(codigosAcceso)
    .set({ usadoAt: new Date().toISOString() })
    .where(eq(codigosAcceso.perfilId, fila.perfilId))

  return { url: data.properties.action_link }
}

/**
 * Las cuentas que ha creado un admin.
 *
 * ⚠ Esta lista faltaba, y sin ella `regenerar` era inalcanzable: la pantalla
 * prometía «ese es el botón para cuando lo pierde» y no había forma de dar
 * con la persona. Quien perdía su enlace —la única llave de quien no tiene
 * Google— quedaba fuera para siempre.
 *
 * De aquí NO sale el código ni su hash: solo cuándo se creó y cuándo se usó
 * por última vez, que es lo que deja ver si alguien sigue entrando y notar
 * una entrada que su dueño no hizo.
 */
export async function creadas(
  db: BaseDeDatos,
  llave: { usuarioId: string | null },
) {
  await exigirAdmin(db, llave.usuarioId)

  const filas = await db
    .select({
      perfil_id: codigosAcceso.perfilId,
      nombre_visible: perfiles.nombreVisible,
      tipo: perfiles.tipo,
      creado_at: codigosAcceso.creadoAt,
      usado_at: codigosAcceso.usadoAt,
    })
    .from(codigosAcceso)
    .innerJoin(perfiles, eq(perfiles.id, codigosAcceso.perfilId))
    .orderBy(desc(codigosAcceso.creadoAt))

  return filas.map((f) => ({
    ...f,
    creado_at: String(f.creado_at),
    usado_at: f.usado_at ? String(f.usado_at) : null,
  }))
}
