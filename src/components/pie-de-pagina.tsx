import Link from 'next/link'
import { Phone } from 'lucide-react'

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

        {/* ⚠ Este párrafo declara quién opera esto y hasta cuándo, así que
            se cambia con el aviso de privacidad y los términos, nunca solo.
            Decía que el proyecto ENTERO era temporal y para el sismo, y eso
            dejó de ser cierto: el directorio de servicios nació de mediano
            plazo. Lo que sigue siendo temporal es la ayuda de emergencia, y
            ahí se dice con las mismas palabras que usa /privacidad.

            Lo que NO cambió, y no puede cambiar sin mirar de nuevo la
            responsabilidad civil: que lo opera una persona natural, que no
            es una entidad de socorro y que no entrega nada. */}
        <p className="mt-4 text-base text-muted-foreground">
          AquíVe es un proyecto personal y gratuito, operado por una sola
          persona. No somos una entidad de socorro ni una ONG, y no
          entregamos ayuda: solo conectamos. La ayuda de emergencia nació
          para el sismo del 10 de agosto de 2026 y dejará de operar cuando
          deje de ser útil.
        </p>

        <nav aria-label="Documentos legales" className="mt-4">
          <ul className="flex flex-wrap gap-x-4">
            <li>
              <Link href="/como-funciona" className="inline-flex min-h-12 items-center text-base underline">
                Cómo funciona
              </Link>
            </li>
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
              <Link href="/seguridad" className="inline-flex min-h-12 items-center text-base underline">
                Cómo cuidarte
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
