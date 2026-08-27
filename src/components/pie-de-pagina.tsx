import Link from 'next/link'
import { Phone } from 'lucide-react'
import { RESPONSABLE } from '@/lib/config'

const EMERGENCIAS = [
  { nombre: 'Emergencias', numero: '123' },
  { nombre: 'Cruz Roja', numero: '132' },
  { nombre: 'Defensa Civil', numero: '144' },
]

export function PieDePagina() {
  return (
    // El mismo gancho que la barra inferior: en una pantalla de flujo no
    // se dibuja. Las líneas de emergencia al final de un formulario a medio
    // llenar no son una salida, son ruido debajo del campo que se escribe.
    <footer data-pie-de-pagina className="mt-12 border-t border-border bg-secondary">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h2 className="font-heading text-lg">Líneas de emergencia</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {EMERGENCIAS.map((e) => (
            <li key={e.numero}>
              <a
                href={`tel:${e.numero}`}
                className="pulsable shadow-canto flex min-h-12 items-center gap-2 rounded-full bg-card px-3 text-base font-medium"
              >
                <Phone className="size-4" aria-hidden="true" />
                {e.nombre} {e.numero}
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-base font-medium">
          Esta plataforma no reemplaza a las autoridades.
        </p>

        {/* ⚠ Este párrafo declara quién opera esto y hasta cuándo, así que
            se cambia con el aviso de privacidad y los términos, nunca solo.

            Dos frases se cayeron el 20/08/2026, cuando la fundación pasó a
            ser la responsable: «proyecto personal, operado por una sola
            persona» y «no somos una ONG». La segunda era literalmente falsa
            —Nodo Social es una fundación— y era además la que sostenía el
            deslinde. Lo que hace ese trabajo ahora es la frase que queda:
            no entregamos ayuda, solo conectamos.

            Lo que NO cambió: que no reemplaza a las autoridades, que no
            entrega nada, y que la ayuda de emergencia es temporal. */}
        <p className="mt-4 text-base text-muted-foreground">
          AquíVe es una plataforma gratuita y sin ánimo de lucro, operada por{' '}
          {RESPONSABLE}. No entregamos ayuda ni la transportamos:
          solo conectamos a quien la necesita con quien puede darla. La ayuda
          de emergencia nació para el sismo del 10 de agosto de 2026 y dejará
          de operar cuando deje de ser útil.
        </p>

        <nav aria-label="Documentos legales" className="mt-4">
          <ul className="flex flex-wrap gap-x-4">
            {/* Ayuda va primera: es la puerta a la PQR y al soporte, y quien
                baja hasta el pie suele venir buscando a quién escribirle. */}
            <li>
              <Link href="/ayuda" className="inline-flex min-h-12 items-center text-base text-enlace underline underline-offset-4">
                Ayuda
              </Link>
            </li>
            <li>
              <Link href="/contacto" className="inline-flex min-h-12 items-center text-base text-enlace underline underline-offset-4">
                Contacto
              </Link>
            </li>
            <li>
              <Link href="/quienes-somos" className="inline-flex min-h-12 items-center text-base text-enlace underline underline-offset-4">
                Quiénes somos
              </Link>
            </li>
            {/* La PQR va aquí y no solo dentro de Ayuda: es el canal de
                habeas data (Ley 1581, arts. 14 y 15) y el sitio donde se
                busca un derecho es el pie, al lado del aviso de privacidad
                que lo menciona. */}
            <li>
              <Link href="/pqr" className="inline-flex min-h-12 items-center text-base text-enlace underline underline-offset-4">
                PQR y habeas data
              </Link>
            </li>
            <li>
              <Link href="/privacidad" className="inline-flex min-h-12 items-center text-base text-enlace underline underline-offset-4">
                Aviso de privacidad
              </Link>
            </li>
            <li>
              <Link href="/terminos" className="inline-flex min-h-12 items-center text-base text-enlace underline underline-offset-4">
                Términos de uso
              </Link>
            </li>
            <li>
              <Link href="/seguridad" className="inline-flex min-h-12 items-center text-base text-enlace underline underline-offset-4">
                Cómo cuidarte
              </Link>
            </li>
            <li>
              <Link href="/datos" className="inline-flex min-h-12 items-center text-base text-enlace underline underline-offset-4">
                Datos abiertos
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
