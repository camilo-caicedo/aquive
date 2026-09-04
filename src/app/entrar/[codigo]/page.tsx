import { redirect } from 'next/navigation'
import Link from 'next/link'

import { db } from '@/db/cliente'
import { canjear } from '@/server/cuentas/alta'
import { MarcoFlujo } from '@/components/marco-flujo'

export const metadata = { title: 'Entrar', robots: { index: false, follow: false } }

/**
 * La puerta de quien no tiene cuenta de Google (ADR 0006).
 *
 * Un admin le dio de alta y le entregó un código en un papel o por
 * WhatsApp. Aquí lo cambia por una sesión.
 *
 * ⚠ El código va en el PATH, nunca en query string (regla de interfaz 9).
 * Un query string se cuela en los logs del servidor, en el `Referer` que el
 * navegador manda al siguiente sitio y en el historial compartido.
 *
 * ⚠ Y por eso mismo esta ruta no se indexa: `robots` lo dice, aunque un
 * código válido no se pueda adivinar —son 32 bytes—.
 *
 * El enlace de Supabase que crea la sesión se pide EN ESTE MOMENTO y no al
 * dar de alta: caduca en una hora, así que generarlo antes sería entregar
 * un papel que ya no sirve.
 */
export default async function EntrarConCodigo({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  const { codigo } = await params
  const sesion = await canjear(db, decodeURIComponent(codigo))

  if (sesion) redirect(sesion.url)

  return (
    <MarcoFlujo titulo="Ese código no sirve" volver="/">
      <p className="text-base">
        Puede que esté mal copiado, o que te hayan dado uno nuevo y este haya
        dejado de servir. Cada persona tiene uno solo: el último que le dieron.
      </p>
      <p className="mt-4 text-base text-muted-foreground">
        Vuelve al punto de Nodo Social donde te dieron de alta y pide otro.
        Quien te atendió puede generarlo en el momento.
      </p>
      <p className="mt-4 text-base">
        ¿Tienes cuenta de Google?{' '}
        <Link href="/login" className="text-enlace underline underline-offset-4">
          Entra por aquí
        </Link>
        .
      </p>
    </MarcoFlujo>
  )
}
