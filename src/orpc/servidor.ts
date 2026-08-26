import 'server-only'

import { implement } from '@orpc/server'

import { contrato } from '@/contrato'
import { db } from '@/db/cliente'
import * as servicios from '@/server/servicios/consultas'

// El enrutador: pega el contrato con la capa de dominio. Aquí y solo aquí se
// tocan las dos cosas — el contrato no sabe de Postgres y el dominio no sabe
// de HTTP.
//
// Fíjate en lo poco que hay: cada procedimiento pasa la base y los argumentos
// ya validados por el contrato. Si esto empieza a tener lógica, la lógica
// está en el sitio equivocado y va a `src/server/<dominio>/`.

const os = implement(contrato)

export const enrutador = os.router({
  servicios: {
    ficha: os.servicios.ficha.handler(({ input }) => servicios.ficha(db, input.id)),
    listado: os.servicios.listado.handler(({ input }) => servicios.listado(db, input)),
  },
})

export type Enrutador = typeof enrutador
