import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, MapPin } from 'lucide-react'

import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { servidor } from '@/orpc/local'
import { listarMunicipios, mapaDeNombres } from '@/lib/municipios'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Aliados',
  description:
    'Las organizaciones aliadas que llevan un centro de acopio de AquíVe.',
}

const TIPO_ETIQUETA: Record<string, string> = {
  fundacion: 'Fundación',
  corporacion: 'Corporación',
  entidad_publica: 'Entidad pública',
  junta: 'Junta de acción comunal',
  otra: 'Organización aliada',
}

/**
 * `/aliados`, pública y nueva (ADR 0016 y CLAUDE.md § Pantallas · Acopio).
 *
 * ⚠ No existe una tabla de «aliados» con logo, descripción o sitio web —
 * `organizaciones` (`db/esquema.ts`) solo tiene nombre, tipo, municipios y
 * los datos operativos del punto de acopio. Esa es la misma fuente que ya
 * usa `/acopios` (`servidor.acopios.lista`), así que esta pantalla la reusa
 * en vez de inventar una segunda consulta: no se rellena con logos que no
 * existen, y si el día de mañana hay más datos por organización, van en esa
 * tabla y esta pantalla los muestra.
 *
 * La diferencia con `/acopios` es el ángulo: aquella responde «¿dónde dejo
 * una donación?» con mapa, dirección y horario; esta responde «¿quiénes son
 * los aliados?» con el nombre, el tipo de organización y dónde trabajan, y
 * enlaza a `/acopios` para quien de verdad va a ir a entregar algo.
 *
 * TODO cliente: si hay aliados que el responsable quiera destacar con más
 * que su nombre y tipo —logo, una frase de qué hacen—, esos campos no
 * existen todavía y hay que decidir dónde se guardan antes de mostrarlos.
 */
export default async function AliadosPage() {
  const supabase = await createClient()
  const [aliados, municipios] = await Promise.all([
    servidor.acopios.lista({}),
    listarMunicipios(supabase),
  ])
  const nombreMunicipio = mapaDeNombres(municipios)

  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Aliados" volver="/inicio" />

      <p className="max-w-prose text-base text-muted-foreground">
        Organizaciones que llevan un centro de acopio de AquíVe. Un
        administrador las da de alta después de revisar su certificado de
        existencia y su NIT: no se registran solas.
      </p>

      {aliados.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-base text-muted-foreground">
          Todavía no hay aliados publicados.
        </p>
      ) : (
        <ul className="revelar mt-6 space-y-3">
          {aliados.map((a) => (
            <li key={a.id} className="shadow-canto rounded-2xl bg-card p-4">
              <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Building2 className="size-5" aria-hidden="true" />
              </span>
              <h2 className="font-heading mt-3 text-lg leading-tight">{a.nombre}</h2>
              <p className="mt-1 text-base text-muted-foreground">
                {TIPO_ETIQUETA[a.tipo] ?? TIPO_ETIQUETA.otra}
              </p>
              <p className="mt-2 flex items-start gap-2 text-base">
                <MapPin
                  className="size-5 shrink-0 translate-y-0.5 text-muted-foreground"
                  aria-hidden="true"
                />
                {a.municipios.map((m) => nombreMunicipio.get(m) ?? m).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-base">
        ¿Buscas dónde dejar una donación?{' '}
        <Link href="/acopios" className="text-enlace underline underline-offset-4">
          Mira los puntos de entrega
        </Link>
        .
      </p>

      <p className="mt-4 text-sm text-muted-foreground">
        Aparecer aquí no es un aval de AquíVe sobre lo que hagan con lo que
        reciben.
      </p>
    </main>
  )
}
