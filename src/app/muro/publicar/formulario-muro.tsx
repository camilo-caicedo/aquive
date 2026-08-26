'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Copy } from 'lucide-react'

import { rpc } from '@/orpc/cliente'
import { MarcoFlujo } from '@/components/marco-flujo'
import { SubirImagen } from '@/components/subir-imagen'
import { Button } from '@/components/ui/button'
import { CATEGORIAS_MURO, NOMBRE_CATEGORIA_MURO, type Cara } from '@/contrato/comunidad'

/**
 * Publicar en el muro. Las dos caras, un formulario.
 *
 * La diferencia no es cosmética y se dice en pantalla: quien OFRECE publica
 * con su nombre y tiene que aceptarlo; quien NECESITA no da un solo dato y se
 * lleva un token, igual que una solicitud de insumos.
 */
export function FormularioMuro({
  cara,
  municipios,
}: {
  cara: Cara
  municipios: { codigo_dane: string; nombre: string; departamento: string | null }[]
}) {
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS_MURO)[number]>('hogar')
  const [titulo, setTitulo] = useState('')
  const [detalle, setDetalle] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [imagenId, setImagenId] = useState<string | null>(null)
  const [acepto, setAcepto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState<{ token: string | null } | null>(null)

  const ofrece = cara === 'ofrece'
  const puede =
    titulo.trim().length >= 3 && municipio !== '' && (!ofrece || acepto) && !enviando

  async function enviar() {
    setEnviando(true)
    setError(null)
    try {
      const r = await rpc.comunidad.publicarEnMuro({
        cara,
        categoria,
        titulo: titulo.trim(),
        detalle: detalle.trim() || undefined,
        municipio,
        imagen_id: imagenId ?? undefined,
        acepto_publicar_nombre: acepto,
      })
      setListo({ token: r.token })
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudo publicar. Inténtalo otra vez.')
    } finally {
      setEnviando(false)
    }
  }

  if (listo) {
    const url = listo.token
      ? `${globalThis.location?.origin ?? ''}/muro/mia/${listo.token}`
      : null

    return (
      <MarcoFlujo titulo="Listo" volver="/muro">
        <div className="shadow-canto rounded-2xl bg-card p-4">
          <h2 className="font-heading text-2xl">Tu publicación salió.</h2>

          {url ? (
            <>
              <p className="mt-2 text-base">
                Guarda este enlace. Es la única forma de volver a ella para
                borrarla, y no lo podemos recuperar: no guardamos de quién es.
              </p>
              <p className="mt-2 break-all font-mono text-sm">{url}</p>
              <div className="mt-3">
                <Button
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(url)}
                >
                  <Copy className="size-4" aria-hidden="true" />
                  Copiar enlace
                </Button>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Se borra sola a los 15 días.
              </p>
            </>
          ) : (
            <p className="mt-2 text-base">
              Aparece en el muro con tu nombre. Puedes borrarla cuando quieras.
            </p>
          )}

          {imagenId && (
            <p className="mt-3 text-base text-muted-foreground">
              La foto se ve cuando una persona la revise.
            </p>
          )}

          <div className="mt-4">
            <Button nativeButton={false} render={<Link href={`/muro?cara=${cara}`} />}>
              Ver el muro
            </Button>
          </div>
        </div>
      </MarcoFlujo>
    )
  }

  return (
    <MarcoFlujo
      titulo={ofrece ? 'Ofrecer algo' : 'Pedir lo que me falta'}
      volver={`/muro?cara=${cara}`}
    >
      <p className="text-base text-muted-foreground">
        {ofrece
          ? 'Aparece con tu nombre, para que quien lo necesite sepa con quién habla.'
          : 'Sin cuenta y sin dar tus datos. Te damos un enlace para volver.'}
      </p>

      <fieldset className="mt-6">
        <legend className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
          Qué es
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIAS_MURO.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={categoria === c}
              onClick={() => setCategoria(c)}
              className={`inline-flex min-h-12 items-center rounded-full px-4 text-base transition-colors ${
                categoria === c
                  ? 'bg-foreground font-semibold text-background'
                  : 'shadow-canto bg-card hover:bg-muted'
              }`}
            >
              {NOMBRE_CATEGORIA_MURO[c]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-6">
        <label
          htmlFor="titulo"
          className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase"
        >
          {ofrece ? 'Qué tienes para dar' : 'Qué necesitas'}
        </label>
        <input
          id="titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={140}
          placeholder={ofrece ? 'Nevera pequeña en buen estado' : 'Una cama sencilla'}
          className="bg-background focus-visible:ring-ring mt-2 min-h-14 w-full rounded-2xl px-4 text-base focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>

      <div className="mt-4">
        <label
          htmlFor="detalle"
          className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase"
        >
          Detalle (opcional)
        </label>
        <textarea
          id="detalle"
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          maxLength={300}
          rows={3}
          className="bg-background focus-visible:ring-ring mt-2 w-full resize-none rounded-2xl px-4 py-3 text-base focus-visible:ring-2 focus-visible:outline-none"
        />
        <p className="mt-1 text-sm text-muted-foreground">
          {detalle.length}/300 · Sin teléfonos ni correos: se acuerda por aquí.
        </p>
      </div>

      <div className="mt-4">
        <label
          htmlFor="municipio"
          className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase"
        >
          Municipio
        </label>
        <select
          id="municipio"
          value={municipio}
          onChange={(e) => setMunicipio(e.target.value)}
          className="bg-background focus-visible:ring-ring mt-2 min-h-14 w-full rounded-2xl px-4 text-base focus-visible:ring-2 focus-visible:outline-none"
        >
          <option value="">Elige uno</option>
          {municipios.map((m) => (
            <option key={m.codigo_dane} value={m.codigo_dane}>
              {m.nombre}
              {m.departamento ? ` · ${m.departamento}` : ''}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-muted-foreground">
          El municipio basta. No pedimos tu dirección.
        </p>
      </div>

      <div className="mt-6">
        <SubirImagen objetoTipo="muro" onSubida={setImagenId} />
      </div>

      {/* Solo la cara que ofrece publica nombre, así que solo ella pide
          autorización. Pedírsela a quien no publica ningún dato sería pedir
          permiso para nada. */}
      {ofrece && (
        <label className="mt-6 flex min-h-12 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={acepto}
            onChange={(e) => setAcepto(e.target.checked)}
            className="mt-1 size-5 shrink-0"
          />
          <span className="text-base">
            Autorizo que mi nombre aparezca junto a esta publicación, para que
            quien la necesite sepa con quién está hablando. Puedo borrarla
            cuando quiera.
          </span>
        </label>
      )}

      {error && (
        <p
          role="alert"
          className="bg-accent text-accent-foreground mt-4 rounded-xl px-4 py-3 text-base"
        >
          {error}
        </p>
      )}

      <div className="mt-6">
        <Button onClick={enviar} disabled={!puede} className="w-full">
          Publicar
        </Button>
      </div>
    </MarcoFlujo>
  )
}
