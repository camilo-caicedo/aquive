import { RPCHandler } from '@orpc/server/fetch'

import { enrutador } from '@/orpc/servidor'

// El borde HTTP, y lo único que sabe de peticiones en toda la cadena.
//
// Regla 6 de producto: nada de datos personales en logs ni en URLs. Los
// argumentos van en el cuerpo, no en la query string, que es lo que hace el
// protocolo de oRPC por defecto — un token o un teléfono en una URL termina
// en el registro de acceso del proveedor de alojamiento.

const manejador = new RPCHandler(enrutador)

async function atender(peticion: Request): Promise<Response> {
  const { response } = await manejador.handle(peticion, {
    prefix: '/api/rpc',
    context: {},
  })

  return response ?? new Response('No encontrado', { status: 404 })
}

export const GET = atender
export const POST = atender
