import 'server-only'

import { implement } from '@orpc/server'

import { contrato } from '@/contrato'
import { db } from '@/db/cliente'
import type { Contexto } from './contexto'
import * as chat from '@/server/chat/hilo'
import * as comunidad from '@/server/comunidad/muro'
import * as imagenes from '@/server/imagenes/recorrido'
import * as moderacion from '@/server/moderacion/comandos'
import * as servicios from '@/server/servicios/consultas'
import * as ubicacion from '@/server/servicios/ubicacion'

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
    miUbicacion: os.servicios.miUbicacion.handler(({ input, context }) =>
      ubicacion.miUbicacion(db, { token: input?.token, usuarioId: context.usuarioId }),
    ),
    guardarUbicacion: os.servicios.guardarUbicacion.handler(
      async ({ input, context, errors }) => {
        try {
          return await ubicacion.guardarUbicacion(
            db,
            { acepto: input.acepto, latitud: input.latitud, longitud: input.longitud },
            { token: input.token, usuarioId: context.usuarioId },
          )
        } catch (e) {
          if (e instanceof ubicacion.UbicacionRechazada) {
            throw errors.RECHAZADO({ data: { motivo: e.message } })
          }
          throw e
        }
      },
    ),
    categorias: os.servicios.categorias.handler(({ input }) => servicios.categorias(db, input)),
    zonas: os.servicios.zonas.handler(({ input }) => servicios.zonasConGente(db, input)),
  },
  moderacion: {
    reportar: os.moderacion.reportar.handler(({ input }) => moderacion.reportar(db, input)),
  },
  comunidad: {
    muro: os.comunidad.muro.handler(({ input }) => comunidad.muro(db, input)),
    productos: os.comunidad.productos.handler(({ input }) => comunidad.productos(db, input)),
    publicarEnMuro: os.comunidad.publicarEnMuro.handler(
      async ({ input, context, errors }) => {
        try {
          return await comunidad.publicar(db, input, { usuarioId: context.usuarioId })
        } catch (e) {
          if (e instanceof comunidad.MuroRechazado) {
            throw errors.RECHAZADO({ data: { motivo: e.message } })
          }
          throw e
        }
      },
    ),
    firmarImagen: os.comunidad.firmarImagen.handler(async ({ input, errors }) => {
      try {
        return await imagenes.firmarSubida(db, input)
      } catch (e) {
        if (e instanceof imagenes.ImagenRechazada) {
          throw errors.RECHAZADO({ data: { motivo: e.message } })
        }
        throw e
      }
    }),
    // Moderar imágenes es decidir qué se publica, así que el permiso se
    // comprueba en el procedimiento y no en la pantalla: esconder el botón
    // deja el endpoint abierto a cualquiera con sesión.
    colaDeImagenes: os.comunidad.colaDeImagenes.handler(async ({ context }) =>
      (await imagenes.esAdmin(db, context.usuarioId)) ? imagenes.cola(db) : [],
    ),
    moderarImagen: os.comunidad.moderarImagen.handler(async ({ input, context, errors }) => {
      if (!(await imagenes.esAdmin(db, context.usuarioId))) {
        throw errors.RECHAZADO({ data: { motivo: 'No tienes permiso para moderar.' } })
      }
      try {
        return await imagenes.moderar(db, input, context.usuarioId!)
      } catch (e) {
        if (e instanceof imagenes.ImagenRechazada) {
          throw errors.RECHAZADO({ data: { motivo: e.message } })
        }
        throw e
      }
    }),
    procesarImagen: os.comunidad.procesarImagen.handler(async ({ input, errors }) => {
      try {
        return await imagenes.procesar(db, input.imagen_id)
      } catch (e) {
        if (e instanceof imagenes.ImagenRechazada) {
          throw errors.RECHAZADO({ data: { motivo: e.message } })
        }
        throw e
      }
    }),
  },
  chat: {
    leer: os.chat.leer.handler(({ input, context }) =>
      chat.leer(db, input.respuesta_id, { token: input.token, usuarioId: context.usuarioId }),
    ),
    // El dominio lanza `ChatRechazado` y no sabe qué es un código HTTP; aquí
    // se traduce. Es la única capa que conoce las dos cosas.
    escribir: os.chat.escribir.handler(async ({ input, context, errors }) => {
      try {
        return await chat.escribir(
          db,
          { respuestaId: input.respuesta_id, cuerpo: input.cuerpo },
          { token: input.token, usuarioId: context.usuarioId },
        )
      } catch (e) {
        if (e instanceof chat.ChatRechazado) {
          throw errors.RECHAZADO({ data: { motivo: e.message } })
        }
        throw e
      }
    }),
  },
})

export type Enrutador = typeof enrutador
