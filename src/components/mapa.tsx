'use client'

import { useEffect, useRef } from 'react'
import type { Map as MapaLeaflet, Marker } from 'leaflet'

import 'leaflet/dist/leaflet.css'

export type PuntoEnMapa = {
  id: string
  latitud: number
  longitud: number
  nombre: string
  detalle?: string | null
  /** El color de la familia del oficio, en hex. */
  color: string
  href?: string
}

/**
 * El mapa. Leaflet, cargado solo en el navegador.
 *
 * ⚠ Leaflet toca `window` al importarse, así que este módulo NO puede
 * renderizarse en el servidor. Quien lo use tiene que traerlo con
 * `dynamic(..., { ssr: false })`. Por eso la librería se importa dentro del
 * efecto y no arriba: un import estático rompería el build de la página.
 *
 * ---------------------------------------------------------------------
 * Las teselas y por qué son las que son
 * ---------------------------------------------------------------------
 *
 * Se usan las de OpenStreetMap, que son gratis y no piden llave. Dos cosas
 * que hay que tener presentes y que no son detalles:
 *
 * 1. Su política de uso PROHÍBE el uso intensivo. Para una fundación con
 *    tráfico pequeño esto se tolera, pero si el proyecto crece hay que pasar
 *    a teselas propias —Protomaps sirve un archivo `.pmtiles` desde el propio
 *    alojamiento y sigue siendo gratis— o a un proveedor con plan.
 *
 * 2. El navegador de quien mira le manda su IP y qué zona está viendo al
 *    servidor de teselas. Es una petición a un tercero, y el aviso de
 *    privacidad tiene que decirlo. Está anotado en PENDIENTES-LEGALES.
 *
 * La atribución es obligatoria por la licencia ODbL y no se quita.
 */
export function Mapa({
  puntos,
  centro,
  zoom = 13,
  alto = 360,
  seleccionable = false,
  alSeleccionar,
}: {
  puntos: PuntoEnMapa[]
  /** Si no se da, se encuadra a los puntos. Sin puntos, el centro de Cali. */
  centro?: { latitud: number; longitud: number }
  zoom?: number
  alto?: number
  /** Modo «pon tu pin»: un toque en el mapa mueve el marcador. */
  seleccionable?: boolean
  alSeleccionar?: (punto: { latitud: number; longitud: number }) => void
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<MapaLeaflet | null>(null)
  const marcadorRef = useRef<Marker | null>(null)
  // El callback en una ref para que cambiarlo no vuelva a montar el mapa: sin
  // esto, un padre que redefine la función en cada render tira las teselas y
  // las vuelve a pedir. Se asigna en un efecto y no durante el render, que es
  // lo que React permite.
  const alSeleccionarRef = useRef(alSeleccionar)
  useEffect(() => {
    alSeleccionarRef.current = alSeleccionar
  }, [alSeleccionar])

  useEffect(() => {
    let cancelado = false
    let mapa: MapaLeaflet | null = null

    void (async () => {
      const L = await import('leaflet')
      if (cancelado || !contenedor.current || mapaRef.current) return

      mapa = L.map(contenedor.current, {
        // El scroll del dedo tiene que seguir moviendo la PÁGINA. Un mapa que
        // se traga el gesto deja a alguien atrapado a mitad de pantalla, y en
        // un teléfono es la manera más rápida de que cierre la aplicación.
        scrollWheelZoom: false,
        attributionControl: true,
      })
      mapaRef.current = mapa

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; colaboradores de OpenStreetMap',
      }).addTo(mapa)

      const conPunto = puntos.filter((p) => Number.isFinite(p.latitud))

      if (centro) {
        mapa.setView([centro.latitud, centro.longitud], zoom)
      } else if (conPunto.length > 0) {
        mapa.fitBounds(
          L.latLngBounds(conPunto.map((p) => [p.latitud, p.longitud] as [number, number])),
          { padding: [32, 32], maxZoom: 16 },
        )
      } else {
        // Cali, que es donde nació el proyecto. Solo pasa si no hay nada que
        // enseñar, y entonces el encuadre da igual.
        mapa.setView([3.4516, -76.532], 12)
      }

      for (const p of conPunto) {
        const icono = L.divIcon({
          className: '',
          html: `<span style="display:flex;width:34px;height:34px;border-radius:50%;background:${p.color};color:#1D1D1B;align-items:center;justify-content:center;font:700 13px/1 Poppins,sans-serif;box-shadow:0 1px 3px rgba(29,29,27,.4)">●</span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        })
        const marcador = L.marker([p.latitud, p.longitud], {
          icon: icono,
          // El nombre en el `title` y en el `alt`: un mapa de puntos de
          // colores no le dice nada a un lector de pantalla.
          title: p.nombre,
          alt: p.nombre,
        }).addTo(mapa)

        const detalle = p.detalle ? `<br><span>${p.detalle}</span>` : ''
        const enlace = p.href
          ? `<br><a href="${p.href}" style="color:#2860A8">Ver ficha</a>`
          : ''
        marcador.bindPopup(`<strong>${p.nombre}</strong>${detalle}${enlace}`)
      }

      if (seleccionable) {
        // El pin que se arrastra: mismo `divIcon` que los puntos de arriba,
        // pero en forma de gota y color `--primary` para que se distinga a
        // simple vista de los puntos de otros prestadores —esos son
        // información, este se mueve—. Sin `icon` aquí Leaflet cae a su
        // marcador por defecto, que pide `marker-icon.png` a una URL que el
        // empaquetador no resuelve: de ahí el círculo roto y el `alt`
        // «marker icon» que se reportó.
        const iconoArrastrable = L.divIcon({
          className: '',
          html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(29,29,27,.45))"><path d="M17 0C7.61 0 0 7.61 0 17c0 12.75 17 27 17 27s17-14.25 17-27C34 7.61 26.39 0 17 0z" fill="var(--primary)" stroke="var(--foreground)" stroke-width="1.5"/><circle cx="17" cy="17" r="6.5" fill="var(--foreground)"/></svg>`,
          iconSize: [34, 44],
          iconAnchor: [17, 44],
        })
        const inicial = conPunto[0]
        if (inicial) {
          marcadorRef.current = L.marker([inicial.latitud, inicial.longitud], {
            icon: iconoArrastrable,
            draggable: true,
          }).addTo(mapa)
          marcadorRef.current.on('dragend', () => {
            const { lat, lng } = marcadorRef.current!.getLatLng()
            alSeleccionarRef.current?.({ latitud: lat, longitud: lng })
          })
        }
        mapa.on('click', (evento) => {
          const { lat, lng } = evento.latlng
          if (marcadorRef.current) {
            marcadorRef.current.setLatLng([lat, lng])
          } else {
            marcadorRef.current = L.marker([lat, lng], {
              icon: iconoArrastrable,
              draggable: true,
            }).addTo(mapa!)
            marcadorRef.current.on('dragend', () => {
              const p = marcadorRef.current!.getLatLng()
              alSeleccionarRef.current?.({ latitud: p.lat, longitud: p.lng })
            })
          }
          alSeleccionarRef.current?.({ latitud: lat, longitud: lng })
        })
      }
    })()

    return () => {
      cancelado = true
      mapaRef.current?.remove()
      mapaRef.current = null
      marcadorRef.current = null
    }
    // Se monta una vez por conjunto de puntos. Leaflet no es declarativo y
    // remontar en cada render costaría una petición de teselas por pintada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(puntos), seleccionable])

  return (
    <div
      ref={contenedor}
      style={{ height: alto }}
      className="shadow-canto w-full overflow-hidden rounded-2xl bg-muted"
      role="application"
      aria-label="Mapa"
    />
  )
}
