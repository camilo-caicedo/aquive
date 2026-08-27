'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

import { rpc } from '@/orpc/cliente'
import { Button } from '@/components/ui/button'

const Mapa = dynamic(() => import('@/components/mapa').then((m) => m.Mapa), {
  ssr: false,
  loading: () => (
    <div className="shadow-canto h-[320px] w-full animate-pulse rounded-2xl bg-muted" />
  ),
})

/**
 * «Pon tu punto en el mapa», en la ficha del prestador. ADR 0004.
 *
 * Es una sección con su propio botón y su propia casilla, aparte del
 * formulario grande, y eso no es organización: el consentimiento de ubicación
 * es un acto distinto del de publicar nombre y teléfono (artículo 9), así que
 * se acepta aparte y se guarda aparte.
 *
 * Quitarse es un botón del mismo tamaño que ponerse. Si retirarse cuesta más
 * que entrar, el consentimiento no es libre — y además borra el punto, no lo
 * esconde.
 */
export function MiUbicacion({
  latitudInicial,
  longitudInicial,
  aceptadoInicial,
  centroMunicipio,
}: {
  latitudInicial: number | null
  longitudInicial: number | null
  aceptadoInicial: boolean
  /** Dónde abrir el mapa si todavía no hay punto. */
  centroMunicipio?: { latitud: number; longitud: number }
}) {
  const [punto, setPunto] = useState<{ latitud: number; longitud: number } | null>(
    latitudInicial !== null && longitudInicial !== null
      ? { latitud: latitudInicial, longitud: longitudInicial }
      : null,
  )
  const [acepto, setAcepto] = useState(aceptadoInicial)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enElMapa, setEnElMapa] = useState(aceptadoInicial)

  async function guardar(quitar: boolean) {
    setGuardando(true)
    setAviso(null)
    try {
      await rpc.servicios.guardarUbicacion({
        acepto: !quitar && acepto,
        latitud: quitar ? null : (punto?.latitud ?? null),
        longitud: quitar ? null : (punto?.longitud ?? null),
      })
      setEnElMapa(!quitar && acepto)
      if (quitar) {
        setPunto(null)
        setAcepto(false)
      }
      setAviso(quitar ? 'Listo, ya no apareces en el mapa.' : 'Guardado.')
    } catch (error) {
      const motivo =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: string }).message)
          : 'No se pudo guardar.'
      setAviso(motivo)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="shadow-canto rounded-2xl bg-card p-4">
      <h2 className="font-heading text-xl font-extrabold tracking-tight">
        Tu punto en el mapa
      </h2>
      <p className="mt-1 text-base text-muted-foreground">
        Opcional. Si no lo pones, sigues apareciendo en el directorio igual —
        solo no sales en el mapa.
      </p>

      <div className="mt-4">
        <Mapa
          puntos={
            punto
              ? [
                  {
                    id: 'yo',
                    latitud: punto.latitud,
                    longitud: punto.longitud,
                    nombre: 'Tu punto',
                    color: '#B8F000',
                  },
                ]
              : []
          }
          centro={punto ?? centroMunicipio}
          zoom={15}
          alto={320}
          seleccionable
          alSeleccionar={setPunto}
        />
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Toca el mapa donde quieras tu punto, o arrastra el pin. No tiene que ser
        tu casa exacta: puedes marcar la esquina o la cuadra donde trabajas.
      </p>

      <label className="mt-4 flex min-h-12 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={acepto}
          onChange={(e) => setAcepto(e.target.checked)}
          className="mt-1 size-5 shrink-0"
        />
        {/* El texto de la autorización, entero y junto a la casilla. Este es
            el que hay que revisar con abogado antes de producción. */}
        <span className="text-base">
          Autorizo que este punto aparezca en el mapa público de AquíVe, junto a
          mi nombre y mi oficio, para que quien busque un servicio pueda saber
          en qué parte trabajo. Puedo quitarlo cuando quiera.
        </span>
      </label>

      {aviso && (
        <p role="status" className="bg-accent text-accent-foreground mt-3 rounded-xl px-4 py-3 text-base">
          {aviso}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={() => guardar(false)} disabled={guardando || !acepto || !punto}>
          {guardando ? 'Guardando…' : 'Guardar mi punto'}
        </Button>
        {enElMapa && (
          <Button variant="outline" onClick={() => guardar(true)} disabled={guardando}>
            {guardando ? 'Un momento…' : 'Quitarme del mapa'}
          </Button>
        )}
      </div>
    </section>
  )
}
