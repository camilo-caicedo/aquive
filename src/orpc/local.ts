import 'server-only'

import { createRouterClient } from '@orpc/server'

import { contextoDeLaPeticion } from './contexto'
import { enrutador } from './servidor'

// Llamar al contrato desde el servidor sin pasar por HTTP.
//
// Un Server Component que hiciera `fetch('/api/rpc')` contra su propio proceso
// pagaría un viaje de red y una serialización para hablar consigo mismo, y en
// el primer render ni siquiera sabe su propia URL. Esto ejecuta el mismo
// procedimiento en memoria: misma validación, mismos tipos, misma capa de
// dominio, cero red.
//
// El navegador y la aplicación de Expo usan `@/orpc/cliente`, que sí va por
// HTTP. Los dos caminos entran por el mismo contrato, que es el punto.

export const servidor = createRouterClient(enrutador, {
  // Perezoso: se resuelve por llamada, no al importar el módulo. Al importar
  // no hay petición todavía y `cookies()` reventaría.
  context: () => contextoDeLaPeticion(),
})
