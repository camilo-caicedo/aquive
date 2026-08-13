import Link from 'next/link'
import { Phone } from 'lucide-react'

const EMERGENCIAS = [
  { nombre: 'Emergencias', numero: '123' },
  { nombre: 'Cruz Roja', numero: '132' },
  { nombre: 'Defensa Civil', numero: '144' },
]

export function PieDePagina() {
  return (
    <footer className="mt-12 border-t border-border bg-secondary">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h2 className="text-base font-bold">Líneas de emergencia</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {EMERGENCIAS.map((e) => (
            <li key={e.numero}>
              <a
                href={`tel:${e.numero}`}
                className="flex min-h-12 items-center gap-2 rounded-lg border border-border bg-background px-3 text-base font-medium"
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

        <p className="mt-4 text-base text-muted-foreground">
          AquíVe es un proyecto personal, gratuito y temporal, hecho para la
          emergencia del sismo del 10 de agosto de 2026. No somos una entidad
          de socorro ni una ONG, y no entregamos ayuda: solo conectamos.
        </p>

        <nav aria-label="Documentos legales" className="mt-4">
          <ul className="flex flex-wrap gap-x-4">
            <li>
              <Link href="/privacidad" className="inline-flex min-h-12 items-center text-base underline">
                Aviso de privacidad
              </Link>
            </li>
            <li>
              <Link href="/terminos" className="inline-flex min-h-12 items-center text-base underline">
                Términos de uso
              </Link>
            </li>
            <li>
              <Link href="/datos" className="inline-flex min-h-12 items-center text-base underline">
                Datos abiertos
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
