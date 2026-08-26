import 'server-only'

import { implement } from '@orpc/server'

import { contrato } from '@/contrato'
import { db } from '@/db/cliente'
import type { Contexto } from './contexto'
import * as moderacion from '@/server/moderacion/comandos'
import * as servicios from '@/server/servicios/consultas'

// El enrutador: pega el contrato con la capa de dominio. Aquí y solo aquí se
// tocan las dos cosas — el contrato no sabe de Postgres y el dominio no sabe
// de HTTP ni de cookies.
//
// Fíjate en lo poco que hay: cada procedimiento pasa la base, el contexto ya
// resuelto y los argumentos ya validados. Si esto empieza a tener lógica, la
// lógica está en el sitio equivocado y va a `src/server/<dominio>/`.

const os = implement(contrato).$context<Contexto>()

export const enrutador = os.router({
  servicios: {
    ficha: os.servicios.ficha.handler(({ input }) => servicios.ficha(db, input.id)),
    directorio: os.servicios.directorio.handler(({ input }) => servicios.directorio(db, input)),
    miFicha: os.servicios.miFicha.handler(({ context }) =>
      servicios.miFicha(db, context.usuarioId),
    ),
    categorias: os.servicios.categorias.handler(({ input }) => servicios.categorias(db, input)),
    zonas: os.servicios.zonas.handler(({ input }) => servicios.zonasConGente(db, input)),
  },
  moderacion: {
    reportar: os.moderacion.reportar.handler(({ input }) => moderacion.reportar(db, input)),
  },
})

export type Enrutador = typeof enrutador
