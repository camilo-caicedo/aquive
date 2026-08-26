import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { ContractRouterClient } from '@orpc/contract'

import type { contrato } from '@/contrato'

// El cliente tipado que usan los componentes de navegador.
//
// Es el reemplazo de `createBrowserClient` de Supabase: mismo sitio en la
// arquitectura, dos diferencias que importan. Habla con NUESTRO servidor y no
// con Postgres, así que el navegador deja de tener credenciales de base de
// datos; y los tipos salen del contrato, así que un cambio de forma es un
// error de compilación y no un `undefined` en pantalla.
//
// La URL es relativa a propósito: la aplicación de Expo montará el mismo
// cliente con una URL absoluta y una cabecera `Authorization`, y no hará
// falta tocar ni el contrato ni el dominio.

const enlace = new RPCLink({
  url: () => new URL('/api/rpc', globalThis.location.origin).toString(),
})

export const rpc: ContractRouterClient<typeof contrato> = createORPCClient(enlace)
