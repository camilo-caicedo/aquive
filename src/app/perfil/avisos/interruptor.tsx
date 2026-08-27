'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, Share } from 'lucide-react'
import { activarAvisos, avisosActivosAqui, desactivarAvisos } from '@/lib/avisos'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

type Estado = 'cargando' | 'activo' | 'inactivo' | 'trabajando' | 'ios' | 'error'

/**
 * Los avisos de este dispositivo, tipo por tipo.
 *
 * ⚠ El prototipo (pantalla 24) dibuja un interruptor por tipo de aviso, y
 * eso hoy sería mentira: `push_ofertadores` guarda una suscripción por
 * navegador y no tiene ninguna columna que diga qué tipos quiere quien la
 * creó. Cinco interruptores que hacen lo mismo enseñan a no creerle a
 * ninguno.
 *
 * Así que hay un interruptor —el del dispositivo, que es el que de verdad
 * existe— y debajo la lista de qué llega con él encendido, cada uno con su
 * estado en palabras. Cuando la tabla tenga columnas por tipo, cada fila se
 * convierte en su propio interruptor y esta pantalla no cambia de forma.
 */
// ⚠ Esta lista dice qué llega DE VERDAD, y llevaba tiempo sin decirlo. Los
// tres primeros salían como «Llega» y no llegaba ninguno: nadie enviaba —
// `notificarOfertadores` no tenía un solo importador y el chat no avisaba— y
// uno de ellos era del flujo acompañado, que el ADR 0007 retiró.
//
// Una pantalla que promete un aviso que no existe hace que quien lo espera
// no vuelva a mirar. Si mañana se enchufa otro, se cambia el `hay` aquí.
const TIPOS: { nombre: string; detalle: string; hay: boolean }[] = [
  {
    nombre: 'Alguien pidió algo en tus municipios',
    detalle:
      'El aviso dice el municipio y la categoría, nunca quién pidió ni qué escribió.',
    hay: true,
  },
  {
    nombre: 'Mensaje nuevo en un chat',
    detalle:
      'Dice que hay un mensaje, no lo que dice: un aviso se lee en la pantalla bloqueada.',
    hay: true,
  },
  {
    nombre: 'Alguien respondió a lo que pediste',
    detalle: 'Sin decir quién ni qué ofrece: eso se lee dentro, con tu cuenta.',
    hay: true,
  },
  {
    nombre: 'Alguien usó tu código',
    detalle: 'Cuando entra una calificación nueva.',
    hay: false,
  },
  {
    nombre: 'Novedades de AquíVe',
    detalle: 'Cambios en la plataforma.',
    hay: false,
  },
]

export function InterruptorAvisos({ municipios }: { municipios: number }) {
  const [estado, setEstado] = useState<Estado>('cargando')

  useEffect(() => {
    let cancelado = false
    async function leer() {
      const activo = await avisosActivosAqui()
      if (!cancelado) setEstado(activo ? 'activo' : 'inactivo')
    }
    leer()
    return () => {
      cancelado = true
    }
  }, [])

  async function activar() {
    setEstado('trabajando')
    const r = await activarAvisos()
    setEstado(r === 'activado' ? 'activo' : r === 'ios' ? 'ios' : 'error')
  }

  async function apagar() {
    setEstado('trabajando')
    await desactivarAvisos()
    setEstado('inactivo')
  }

  const activo = estado === 'activo'
  const ocupado = estado === 'trabajando' || estado === 'cargando'

  return (
    <div className="space-y-4">
      <section className="shadow-canto rounded-2xl bg-card p-4">
        <h2 className="font-heading text-xl leading-tight">
          {activo ? 'Los avisos están activos aquí' : 'Activa los avisos'}
        </h2>
        <p className="mt-1 text-base text-muted-foreground">
          Sin ellos tienes que entrar a mirar si alguien te escribió. En iPhone
          hay que agregar AquíVe a la pantalla de inicio para que funcionen.
        </p>

        {estado === 'ios' && (
          <Alert variant="warning" className="mt-3">
            <Share className="size-5" />
            <AlertDescription>
              En iPhone los avisos solo funcionan si agregas AquíVe a tu pantalla
              de inicio: toca <strong>Compartir</strong> y luego{' '}
              <strong>Agregar a pantalla de inicio</strong>.
            </AlertDescription>
          </Alert>
        )}

        {activo && (
          <Alert className="mt-3">
            <BellRing className="size-5" />
            <AlertDescription>
              Activados en este dispositivo. En otro teléfono hay que activarlos
              otra vez.
            </AlertDescription>
          </Alert>
        )}

        {estado === 'error' && (
          <p className="mt-3 text-base text-muted-foreground">
            No pudimos activar los avisos. Puedes seguir entrando a mirar cuando
            quieras.
          </p>
        )}

        <div className="mt-3">
          {activo ? (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={ocupado}
              onClick={apagar}
            >
              <BellOff className="size-5" aria-hidden="true" />
              Desactivar en este dispositivo
            </Button>
          ) : (
            <Button className="w-full sm:w-auto" disabled={ocupado} onClick={activar}>
              <Bell className="size-5" aria-hidden="true" />
              {estado === 'trabajando' ? 'Activando…' : 'Activar'}
            </Button>
          )}
        </div>
      </section>

      <div>
        <p className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
          Qué te llega
        </p>
        <ul className="shadow-canto mt-2 divide-y divide-border rounded-2xl bg-card">
          {TIPOS.map((t) => (
            <li key={t.nombre} className="flex min-h-16 items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium">{t.nombre}</span>
                <span className="block text-base text-muted-foreground">
                  {t.detalle}
                </span>
              </span>
              <span
                className={`font-heading shrink-0 rounded-full px-3 py-1 text-xs tracking-[0.085em] uppercase ${
                  !t.hay
                    ? 'bg-muted text-foreground'
                    : activo
                      ? 'bg-ok-suave text-foreground'
                      : 'bg-accent text-accent-foreground'
                }`}
              >
                {!t.hay ? 'Todavía no' : activo ? 'Llega' : 'Apagado'}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-base text-muted-foreground">
          Hoy se encienden y se apagan todos juntos: la suscripción es de este
          navegador y no guarda qué tipos quieres. Los de «Alguien pidió algo»
          son de{' '}
          {municipios === 1 ? 'tu municipio' : `tus ${municipios} municipios`}.
        </p>
      </div>

      <p className="text-base text-muted-foreground">
        Los avisos van al navegador, no a tu teléfono como número: no guardamos
        tu número para esto. Se borran cuando se borra lo que avisan.
      </p>
    </div>
  )
}
