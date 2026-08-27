import 'server-only'

import { implement } from '@orpc/server'

import { contrato } from '@/contrato'
import { db } from '@/db/cliente'
import type { Contexto } from './contexto'
import * as chat from '@/server/chat/hilo'
import * as comunidad from '@/server/comunidad/muro'
import * as acopios from '@/server/acopios/consultas'
import * as cuentas from '@/server/cuentas/alta'
import * as insumos from '@/server/insumos/solicitudes'
import * as productos from '@/server/comunidad/productos'
import * as imagenes from '@/server/imagenes/recorrido'
import * as moderacion from '@/server/moderacion/comandos'
import * as pqr from '@/server/pqr/buzon'
import * as servicios from '@/server/servicios/consultas'
import * as pedidos from '@/server/servicios/solicitudes'
import * as ubicacion from '@/server/servicios/ubicacion'
import * as foto from '@/server/servicios/foto'
import * as altaAsistida from '@/server/servicios/alta-asistida'
import * as fichaPropia from '@/server/servicios/ficha'

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
    inicio: os.servicios.inicio.handler(({ input }) => servicios.inicio(db, input)),
    ficha: os.servicios.ficha.handler(({ input }) => servicios.ficha(db, input.id)),
    directorio: os.servicios.directorio.handler(({ input }) => servicios.directorio(db, input)),
    miFicha: os.servicios.miFicha.handler(({ context }) =>
      servicios.miFicha(db, context.usuarioId),
    ),
    publicarSolicitud: os.servicios.publicarSolicitud.handler(
      async ({ input, context, errors }) => {
        try {
          return await pedidos.publicar(db, input, { usuarioId: context.usuarioId })
        } catch (e) {
          if (e instanceof pedidos.SolicitudRechazada) {
            throw errors.RECHAZADO({ data: { motivo: e.message } })
          }
          throw e
        }
      },
    ),
    misSolicitudes: os.servicios.misSolicitudes.handler(({ context }) =>
      pedidos.mias(db, { usuarioId: context.usuarioId }),
    ),
    altaAsistida: os.servicios.altaAsistida.handler(async ({ input, context, errors }) => {
      try {
        return await altaAsistida.registrar(db, input, { usuarioId: context.usuarioId })
      } catch (e) {
        if (e instanceof altaAsistida.AltaRechazada) {
          throw errors.RECHAZADO({ data: { motivo: e.message } })
        }
        throw e
      }
    }),
    borrarFicha: os.servicios.borrarFicha.handler(async ({ context, errors }) => {
      try {
        return await fichaPropia.borrar(db, { usuarioId: context.usuarioId })
      } catch (e) {
        if (e instanceof fichaPropia.FichaRechazada) {
          throw errors.RECHAZADO({ data: { motivo: e.message } })
        }
        throw e
      }
    }),
    guardarFoto: os.servicios.guardarFoto.handler(async ({ input, context, errors }) => {
      try {
        return await foto.guardar(db, input, { usuarioId: context.usuarioId })
      } catch (e) {
        if (e instanceof foto.FotoRechazada) {
          throw errors.RECHAZADO({ data: { motivo: e.message } })
        }
        throw e
      }
    }),
    gestionarSolicitud: os.servicios.gestionarSolicitud.handler(
      async ({ input, context, errors }) => {
        try {
          return await pedidos.gestionar(db, input.id, input.accion, {
            usuarioId: context.usuarioId,
          })
        } catch (e) {
          if (e instanceof pedidos.SolicitudRechazada) {
            throw errors.RECHAZADO({ data: { motivo: e.message } })
          }
          throw e
        }
      },
    ),
    miUbicacion: os.servicios.miUbicacion.handler(({ context }) =>
      ubicacion.miUbicacion(db, { usuarioId: context.usuarioId }),
    ),
    guardarUbicacion: os.servicios.guardarUbicacion.handler(
      async ({ input, context, errors }) => {
        try {
          return await ubicacion.guardarUbicacion(
            db,
            { acepto: input.acepto, latitud: input.latitud, longitud: input.longitud },
            { usuarioId: context.usuarioId },
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
  insumos: {
    publicar: os.insumos.publicar.handler(async ({ input, context, errors }) => {
      try {
        return await insumos.publicar(db, input, { usuarioId: context.usuarioId })
      } catch (e) {
        if (e instanceof insumos.InsumoRechazado) {
          throw errors.RECHAZADO({ data: { motivo: e.message } })
        }
        throw e
      }
    }),
    mias: os.insumos.mias.handler(({ context }) =>
      insumos.mias(db, { usuarioId: context.usuarioId }),
    ),
    porCodigo: os.insumos.porCodigo.handler(({ input, context }) =>
      insumos.porCodigo(db, input.codigo, { usuarioId: context.usuarioId }),
    ),
    responder: os.insumos.responder.handler(async ({ input, context, errors }) => {
      try {
        return await insumos.responder(db, input, { usuarioId: context.usuarioId })
      } catch (e) {
        if (e instanceof insumos.InsumoRechazado) {
          throw errors.RECHAZADO({ data: { motivo: e.message } })
        }
        throw e
      }
    }),
    gestionar: os.insumos.gestionar.handler(async ({ input, context, errors }) => {
      try {
        return await insumos.gestionar(db, input.id, input.accion, {
          usuarioId: context.usuarioId,
        })
      } catch (e) {
        if (e instanceof insumos.InsumoRechazado) {
          throw errors.RECHAZADO({ data: { motivo: e.message } })
        }
        throw e
      }
    }),
  },
  acopios: {
    lista: os.acopios.lista.handler(({ input }) => acopios.lista(db, input)),
  },
  cuentas: {
    crear: os.cuentas.crear.handler(async ({ input, context, errors }) => {
      try {
        return await cuentas.crear(db, input, { usuarioId: context.usuarioId })
      } catch (e) {
        if (e instanceof cuentas.CuentaRechazada) {
          throw errors.RECHAZADO({ data: { motivo: e.message } })
        }
        throw e
      }
    }),
    regenerar: os.cuentas.regenerar.handler(async ({ input, context, errors }) => {
      try {
        return await cuentas.regenerar(db, input.perfil_id, {
          usuarioId: context.usuarioId,
        })
      } catch (e) {
        if (e instanceof cuentas.CuentaRechazada) {
          throw errors.RECHAZADO({ data: { motivo: e.message } })
        }
        throw e
      }
    }),
  },
  comunidad: {
    muro: os.comunidad.muro.handler(({ input }) => comunidad.muro(db, input)),
    productos: os.comunidad.productos.handler(({ input }) => comunidad.productos(db, input)),
    misProductos: os.comunidad.misProductos.handler(({ context }) =>
      productos.mios(db, context.usuarioId),
    ),
    publicarProducto: os.comunidad.publicarProducto.handler(
      async ({ input, context, errors }) => {
        try {
          return await productos.publicar(db, input, { usuarioId: context.usuarioId })
        } catch (e) {
          if (e instanceof productos.ProductoRechazado) {
            throw errors.RECHAZADO({ data: { motivo: e.message } })
          }
          throw e
        }
      },
    ),
    editarProducto: os.comunidad.editarProducto.handler(
      async ({ input, context, errors }) => {
        const { id, ...cambios } = input
        try {
          await productos.editar(db, id, cambios, { usuarioId: context.usuarioId })
          return { ok: true as const }
        } catch (e) {
          if (e instanceof productos.ProductoRechazado) {
            throw errors.RECHAZADO({ data: { motivo: e.message } })
          }
          throw e
        }
      },
    ),
    disponibilidadProducto: os.comunidad.disponibilidadProducto.handler(
      async ({ input, context, errors }) => {
        try {
          await productos.disponibilidad(db, input.id, input.disponible, {
            usuarioId: context.usuarioId,
          })
          return { ok: true as const }
        } catch (e) {
          if (e instanceof productos.ProductoRechazado) {
            throw errors.RECHAZADO({ data: { motivo: e.message } })
          }
          throw e
        }
      },
    ),
    borrarProducto: os.comunidad.borrarProducto.handler(
      async ({ input, context, errors }) => {
        try {
          await productos.borrarProducto(db, input.id, { usuarioId: context.usuarioId })
          return { ok: true as const }
        } catch (e) {
          if (e instanceof productos.ProductoRechazado) {
            throw errors.RECHAZADO({ data: { motivo: e.message } })
          }
          throw e
        }
      },
    ),
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
    // ⚠ Con cuenta, las dos. Desde el ADR 0006 todo la exige, y estas dos
    // eran las únicas que escribían sin mirarla: cualquiera sin sesión podía
    // pedir URLs firmadas y subir 2 MB por vez, sin límite de veces. El
    // archivo iba a un bucket público (ver `recorrido.ts`), así que era
    // alojamiento gratis en el dominio del proyecto.
    firmarImagen: os.comunidad.firmarImagen.handler(async ({ input, context, errors }) => {
      if (!context.usuarioId) {
        throw errors.RECHAZADO({ data: { motivo: 'Para subir una imagen necesitas entrar con tu cuenta.' } })
      }
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
    procesarImagen: os.comunidad.procesarImagen.handler(async ({ input, context, errors }) => {
      if (!context.usuarioId) {
        throw errors.RECHAZADO({ data: { motivo: 'Para subir una imagen necesitas entrar con tu cuenta.' } })
      }
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
  pqr: {
    crear: os.pqr.crear.handler(async ({ input, errors }) => {
      try {
        return await pqr.crear(db, input)
      } catch (e) {
        if (e instanceof pqr.PqrRechazada) {
          throw errors.RECHAZADO({ data: { motivo: e.message } })
        }
        throw e
      }
    }),
  },
  chat: {
    bandeja: os.chat.bandeja.handler(({ context }) => chat.bandeja(db, context.usuarioId)),
    sinLeer: os.chat.sinLeer.handler(({ context }) => chat.sinLeer(db, context.usuarioId)),
    leer: os.chat.leer.handler(({ input, context }) =>
      chat.leer(db, input.origen, { usuarioId: context.usuarioId }),
    ),
    // El dominio lanza `ChatRechazado` y no sabe qué es un código HTTP; aquí
    // se traduce. Es la única capa que conoce las dos cosas.
    escribir: os.chat.escribir.handler(async ({ input, context, errors }) => {
      try {
        return await chat.escribir(
          db,
          { origen: input.origen, cuerpo: input.cuerpo },
          { usuarioId: context.usuarioId },
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
