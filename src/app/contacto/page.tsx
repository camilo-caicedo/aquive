import type { Metadata } from 'next'
import Link from 'next/link'

import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { Button } from '@/components/ui/button'
import { NADIE_TE_PIDE } from '@/lib/honestidad'
import {
  CORREO_CONTACTO,
  CORREO_HABEAS_DATA_SERVICIOS,
  RAZON_SOCIAL_RESPONSABLE,
  RESPONSABLE,
} from '@/lib/config'

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Por dónde hablar con AquíVe y con la Fundación Nodo Social.',
}

/**
 * Pantalla 39 · Contacto.
 *
 * ⚠ Dos de las cuatro filas del prototipo no tienen dato todavía. Están
 * declaradas en `null` y la pantalla omite la fila: imprimir «pendiente» o
 * un número de ejemplo en una pantalla de contacto es peor que no tener la
 * fila, porque alguien lo marca.
 *
 * TODO: pedírselo al responsable. Cuando lleguen, el sitio de estas dos
 * constantes es `src/lib/config.ts` junto a `CORREO_CONTACTO` — viven aquí
 * mientras esta sea la única pantalla que las nombra.
 */
const WHATSAPP_CONTACTO: string | null = null
const PUNTO_DE_ENCUENTRO: string | null = null

const FILAS: { etiqueta: string; valor: string | null; nota?: string; href?: string }[] = [
  {
    etiqueta: 'WhatsApp',
    valor: WHATSAPP_CONTACTO,
    // Cuando llegue el número, aquí va además
    // `href: 'https://wa.me/57' + solo los dígitos`.
  },
  {
    etiqueta: 'Correo',
    valor: CORREO_CONTACTO,
    href: `mailto:${CORREO_CONTACTO}`,
  },
  {
    etiqueta: 'Punto de encuentro',
    valor: PUNTO_DE_ENCUENTRO,
  },
  {
    etiqueta: 'Habeas data',
    valor: CORREO_HABEAS_DATA_SERVICIOS,
    href: `mailto:${CORREO_HABEAS_DATA_SERVICIOS}`,
    // Es el mismo buzón, y decirlo evita que alguien escriba dos veces
    // creyendo que la primera fue al sitio equivocado.
    nota: `El mismo buzón, atendido por ${RAZON_SOCIAL_RESPONSABLE || RESPONSABLE}. Escribe aquí para ver, corregir o borrar tus datos.`,
  },
]

export default function ContactoPage() {
  const filas = FILAS.filter((f) => f.valor)

  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Hablemos" volver="/inicio" />

      <ul className="space-y-3">
        {filas.map((f) => (
          <li key={f.etiqueta} className="shadow-canto rounded-2xl bg-card p-4">
            <p className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
              {f.etiqueta}
            </p>
            {f.href ? (
              <a
                href={f.href}
                className="mt-1 inline-flex min-h-12 items-center text-base break-all text-enlace underline underline-offset-4"
              >
                {f.valor}
              </a>
            ) : (
              <p className="mt-1 text-base">{f.valor}</p>
            )}
            {f.nota && <p className="mt-1 text-base text-muted-foreground">{f.nota}</p>}
          </li>
        ))}
      </ul>

      {/* Cartel amarillo con texto negro (10,38:1): es la frase que hay que
          reconocer meses después, cuando alguien intente cobrar por algo que
          aquí es gratis. */}
      <div className="mt-6 rounded-2xl bg-familia-amarillo p-4 text-foreground">
        <p className="font-heading text-base">Nadie de AquíVe te pide dinero</p>
        <p className="mt-2 text-base">{NADIE_TE_PIDE}</p>
      </div>

      <div className="mt-6">
        <Button
          className="w-full sm:w-auto"
          nativeButton={false}
          render={<Link href="/ayuda" />}
        >
          Preguntas frecuentes
        </Button>
      </div>
    </main>
  )
}
