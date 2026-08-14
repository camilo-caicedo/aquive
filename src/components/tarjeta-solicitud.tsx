import Link from 'next/link'
import { MapPin, MessageSquare, TimerOff, Check } from 'lucide-react'
import type { Categoria, ItemResumen } from '@/lib/types'
import { categoria, describirItem, horasParaVencer, HORAS_POR_VENCER } from '@/lib/catalogo'
import { formatearHoras } from '@/lib/tiempo'
import { AVISO_CORTO } from '@/lib/honestidad'
import { BadgeFrescura } from '@/components/badge-frescura'
import { Button } from '@/components/ui/button'

// Solo lo que la tarjeta usa, y no la fila entera de la vista: así sirve
// igual para el tablero y para el cruce inverso, cuya RPC devuelve las
// mismas columnas más `coincidencias` y sin los arreglos de identificadores.
interface Solicitud {
  codigo: string
  categoria: Categoria
  municipio_nombre: string
  barrio: string
  nota: string | null
  expira_at: string
  horas_sin_confirmar: number
  num_respuestas: number
  items: ItemResumen[]
}

export function TarjetaSolicitud({
  solicitud,
  coincidencias,
}: {
  solicitud: Solicitud
  coincidencias?: number
}) {
  const { etiqueta, Icono } = categoria(solicitud.categoria)
  const restantes = horasParaVencer(solicitud.expira_at)
  const porVencer = restantes <= HORAS_POR_VENCER

  return (
    <li className="animar-entrada rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icono className="size-5" aria-hidden="true" />
          </span>
          <div>
            <span className="font-mono text-lg font-bold">{solicitud.codigo}</span>
            <p className="text-sm text-muted-foreground">{etiqueta}</p>
          </div>
        </div>
        <BadgeFrescura horas={solicitud.horas_sin_confirmar} />
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-base">
        <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {solicitud.municipio_nombre} — {solicitud.barrio}
      </p>

      {coincidencias !== undefined && coincidencias > 0 && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-sm font-medium text-accent-foreground">
          <Check className="size-4 shrink-0" aria-hidden="true" />
          {coincidencias === 1
            ? 'Pide una de las cosas que marcaste'
            : `Pide ${coincidencias} de las cosas que marcaste`}
        </p>
      )}

      {solicitud.items.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {solicitud.items.map((it, i) => (
            <li
              key={i}
              className="rounded-md bg-muted px-2 py-1 text-sm text-foreground"
            >
              {describirItem(it)}
            </li>
          ))}
        </ul>
      )}

      {solicitud.nota && (
        <p className="mt-3 text-base text-muted-foreground">{solicitud.nota}</p>
      )}

      {porVencer && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-sm font-medium text-accent-foreground">
          <TimerOff className="punto-urgente size-4 shrink-0" aria-hidden="true" />
          {restantes <= 1
            ? 'Se borra sola en menos de una hora'
            : `Se borra sola en ${Math.round(restantes)} horas`}
        </p>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
        <span>{formatearHoras(solicitud.horas_sin_confirmar)}</span>
        <span aria-hidden="true">·</span>
        <MessageSquare className="size-4" aria-hidden="true" />
        <span className={solicitud.num_respuestas > 0 ? 'font-medium text-foreground' : undefined}>
          {solicitud.num_respuestas}{' '}
          {solicitud.num_respuestas === 1 ? 'respuesta' : 'respuestas'}
        </span>
      </p>

      <Button
        variant="outline"
        className="mt-3 w-full"
        nativeButton={false}
        render={<Link href={`/responder/${solicitud.codigo}`} />}
      >
        Puedo ayudar
      </Button>

      {/* Discreto y pegado al botón: el aviso tiene que estar donde se
          decide, no en una página que nadie abre. */}
      <p className="mt-2 text-sm text-muted-foreground">
        {AVISO_CORTO}{' '}
        <Link href="/seguridad" className="underline">
          Cómo cuidarte
        </Link>
      </p>
    </li>
  )
}
