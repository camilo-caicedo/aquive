import { RPCHandler } from '@orpc/server/fetch'

import { contextoDeLaPeticion } from '@/orpc/contexto'
import { enrutador } from '@/orpc/servidor'
import { CON_CUENTA, ESCRITURA, SIN_CUENTA, permitir, quien } from '@/lib/limite-de-tasa'

// El borde HTTP, y lo único que sabe de peticiones en toda la cadena.
//
// Regla 6 de producto: nada de datos personales en logs ni en URLs. Los
// argumentos van en el cuerpo, no en la query string, que es lo que hace el
// protocolo de oRPC por defecto — un token o un teléfono en una URL termina
// en el registro de acceso del proveedor de alojamiento.

const manejador = new RPCHandler(enrutador)

/**
 * Lo que CREA algo, y por eso lleva un techo aparte mucho más bajo.
 *
 * Nadie publica doce cosas en un minuto a mano, y es justo lo que hace quien
 * está llenando el sitio de basura. Se reconocen por el último tramo de la
 * ruta, que en oRPC es el nombre del procedimiento: así el techo vive en un
 * sitio y no hay que acordarse de ponerlo en cada handler nuevo.
 */
const CREAN = new Set([
  'publicarSolicitud',
  'publicarEnMuro',
  'publicarProducto',
  'firmarImagen',
  'procesarImagen',
  'escribir',
  'reportar',
  'crear',
  'responder',
  'altaAsistida',
])

async function atender(peticion: Request): Promise<Response> {
  const contexto = await contextoDeLaPeticion()

  // El techo de la API (`CLAUDE.md`, tabla de arquitectura). Va AQUÍ y no
  // dentro de cada procedimiento porque este es el único endpoint que hay:
  // un contador por procedimiento obligaría a acordarse de ponerlo en cada
  // uno nuevo, y el que se olvide es justo el que se va a usar.
  //
  // Quien tiene cuenta cabe mucho más: navegar el directorio son muchas
  // lecturas seguidas y ninguna es sospechosa. Sin cuenta se puede hacer
  // poco, y nada de lo poco se repite.
  const cupo = contexto.usuarioId ? CON_CUENTA : SIN_CUENTA
  if (!permitir(quien(peticion, contexto.usuarioId), cupo)) {
    // 429 con `Retry-After`, que es lo que un cliente sabe leer. Sin cuerpo:
    // no hay nada que contarle a quien está repitiendo.
    return new Response('Demasiadas peticiones. Espera un momento.', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(cupo.ventanaMs / 1000)) },
    })
  }

  // El segundo techo, para lo que crea. Se cuenta aparte del general: gastar
  // la cuota de publicar no gasta la de mirar.
  const procedimiento = new URL(peticion.url).pathname.split('/').pop() ?? ''
  if (CREAN.has(procedimiento)) {
    const llave = `crear:${quien(peticion, contexto.usuarioId)}`
    if (!permitir(llave, ESCRITURA)) {
      return new Response('Estás publicando muy seguido. Espera un momento.', {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(ESCRITURA.ventanaMs / 1000)) },
      })
    }
  }

  const { response } = await manejador.handle(peticion, {
    prefix: '/api/rpc',
    // El borde resuelve la sesión y la mete en el contexto. Nada más allá de
    // aquí vuelve a tocar una cookie.
    context: contexto,
  })

  return response ?? new Response('No encontrado', { status: 404 })
}

export const GET = atender
export const POST = atender
