'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { HeartHandshake } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FECHA_LEGALES } from '@/lib/config'
import {
  AVISO_ACOMPANAMIENTO_DATOS,
  AVISO_ACOMPANAMIENTO_SIN_VUELTA,
  type AliadoDelMunicipio,
} from '@/lib/acompanamiento'
import { TIPOS_DOCUMENTO, validarDocumento, validarTelefono } from '@/lib/validacion'
import type { TipoDocumento } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * El único sitio del proyecto donde se le piden datos personales a quien
 * pide ayuda, y por eso el único que puede equivocarse de verdad.
 *
 * Empieza cerrado, detrás de un enlace y no de un botón: regla R, elegir
 * el Flujo 2 no puede ser el camino de menor resistencia. Quien no lo
 * abra se queda en Flujo 1, que es lo correcto por defecto.
 *
 * No hay camino de vuelta desde aquí (§7). Se dice antes de pedir nada.
 */
export function Acompanamiento({
  token,
  aliado,
  flujo,
  organizacion,
}: {
  token: string
  aliado: AliadoDelMunicipio | null
  flujo: 'directo' | 'acompanado'
  organizacion: string | null
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [documentoTipo, setDocumentoTipo] = useState<TipoDocumento>('CC')
  const [documento, setDocumento] = useState('')
  const [telefono, setTelefono] = useState('')
  const [autorizo, setAutorizo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ya acompañada: se dice y se acabó. No se le vuelven a mostrar los
  // datos que entregó — mostrarlos no le sirve de nada y multiplica los
  // sitios por donde pueden salir.
  if (flujo === 'acompanado') {
    return (
      <section className="mt-8">
        <div className="rounded-xl border border-ok/30 bg-ok-suave p-4">
          <p className="flex items-start gap-2 text-base text-ok">
            <HeartHandshake className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
            <span>
              {organizacion ?? 'Una fundación'} está acompañando esta
              solicitud. Ellos coordinan la entrega contigo.
            </span>
          </p>
        </div>
      </section>
    )
  }

  // Sin fundación en ese municipio no hay nada que ofrecer, y no se
  // menciona: contar lo que no existe solo hace sentir que falta algo.
  if (!aliado) return null

  const errorDocumento = documento ? validarDocumento(documentoTipo, documento) : null
  const errorTelefono = telefono ? validarTelefono(telefono) : null
  const puedeEnviar =
    nombre.trim().length >= 3 &&
    documento.trim().length > 0 &&
    !errorDocumento &&
    !errorTelefono &&
    autorizo &&
    !enviando

  async function activar() {
    if (!puedeEnviar || !aliado) return
    setEnviando(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('activar_acompanamiento', {
      p_token: token,
      p_organizacion_id: aliado.id,
      p_nombre: nombre.trim(),
      p_documento_tipo: documentoTipo,
      p_documento: documento.trim(),
      p_autorizacion_version: FECHA_LEGALES,
      p_telefono: telefono.trim() || null,
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    // La activación va directo a Supabase —lleva nombre, documento y
    // teléfono, y no tienen por qué pasar por Vercel—. Lo que sí pasa por
    // una ruta es el aviso a quienes ya habían ofrecido ayuda, porque las
    // suscripciones push no son legibles para el navegador.
    await fetch('/api/acompanamiento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => {})

    router.refresh()
  }

  return (
    <section className="mt-8">
      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex min-h-12 items-center gap-1.5 text-left text-base text-muted-foreground underline"
        >
          <HeartHandshake className="size-4 shrink-0" aria-hidden="true" />
          ¿Prefieres que una fundación coordine la entrega?
        </button>
      ) : (
        <div className="space-y-4 rounded-xl border border-border p-4">
          <div>
            <h2 className="font-heading text-2xl">Que {aliado.nombre} te acompañe</h2>
            <p className="mt-2 text-base text-muted-foreground">
              {AVISO_ACOMPANAMIENTO_DATOS}
            </p>
          </div>

          <Alert variant="warning">
            <AlertDescription>{AVISO_ACOMPANAMIENTO_SIN_VUELTA}</AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="acomp-nombre" className="mb-1">
              Tu nombre completo
            </Label>
            <Input
              id="acomp-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              autoComplete="name"
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-base font-medium">Tipo de documento</legend>
            {/* Sin TI ni RC, y no es un olvido: esta plataforma no recibe
                documentos de menores de edad (regla O). Un CHECK de la base
                los rechaza aunque alguien los mande a mano. */}
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_DOCUMENTO.map((t) => (
                <Button
                  key={t.valor}
                  type="button"
                  variant={documentoTipo === t.valor ? 'default' : 'outline'}
                  onClick={() => setDocumentoTipo(t.valor)}
                >
                  {t.valor}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {TIPOS_DOCUMENTO.find((t) => t.valor === documentoTipo)?.etiqueta}
            </p>
          </fieldset>

          <div>
            <Label htmlFor="acomp-documento" className="mb-1">
              Número de documento
            </Label>
            <Input
              id="acomp-documento"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              maxLength={20}
              inputMode="numeric"
            />
            {errorDocumento && (
              <p className="mt-1 text-sm text-destructive">{errorDocumento}</p>
            )}
          </div>

          <div>
            <Label htmlFor="acomp-telefono" className="mb-1">
              Teléfono (opcional)
            </Label>
            <Input
              id="acomp-telefono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              maxLength={20}
              inputMode="tel"
              autoComplete="tel"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              Para que la fundación te avise de la entrega. Solo lo ve ella.
            </p>
            {errorTelefono && <p className="mt-1 text-sm text-destructive">{errorTelefono}</p>}
          </div>

          <label className="flex items-start gap-2 text-base">
            <input
              type="checkbox"
              checked={autorizo}
              onChange={(e) => setAutorizo(e.target.checked)}
              className="mt-1 size-5 shrink-0"
            />
            <span>
              Autorizo que {aliado.nombre} trate estos datos para coordinar la
              entrega, según la{' '}
              <Link href="/privacidad" className="underline">
                política de privacidad
              </Link>{' '}
              del {FECHA_LEGALES}.
            </span>
          </label>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button disabled={!puedeEnviar} onClick={activar}>
              {enviando ? 'Guardando…' : 'Sí, que me acompañen'}
            </Button>
            <Button variant="outline" disabled={enviando} onClick={() => setAbierto(false)}>
              Ahora no
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
