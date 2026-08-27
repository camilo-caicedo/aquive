'use client'

import { useState } from 'react'
import Link from 'next/link'

import { rpc } from '@/orpc/cliente'
import { MarcoFlujo } from '@/components/marco-flujo'
import { SubirImagen } from '@/components/subir-imagen'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from '@/components/ui/combobox'
import { CATEGORIAS_MURO, NOMBRE_CATEGORIA_MURO, type Cara } from '@/contrato/comunidad'

/**
 * Publicar en el muro. Las dos caras, un formulario.
 *
 * La diferencia no es cosmética y se dice en pantalla: quien OFRECE publica
 * con su nombre y tiene que aceptarlo; quien NECESITA no da un solo dato y se
 * lleva un token, igual que una solicitud de insumos.
 */
type MunicipioMuro = {
  codigo_dane: string
  nombre: string
  departamento: string | null
}

export function FormularioMuro({
  cara,
  municipios,
  acopios,
}: {
  cara: Cara
  municipios: MunicipioMuro[]
  /** Los centros donde se puede dejar (ADR 0008). Vacío = no hay ninguno. */
  acopios: { id: string; nombre: string; direccion: string | null }[]
}) {
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS_MURO)[number]>('hogar')
  const [titulo, setTitulo] = useState('')
  const [detalle, setDetalle] = useState('')
  const [municipio, setMunicipio] = useState('')
  // El Combobox trabaja con el objeto, no con el código: el estado sigue
  // siendo el código porque es lo que se envía.
  const municipioElegido = municipios.find((m) => m.codigo_dane === municipio)
  const [acopioId, setAcopioId] = useState('')
  const [imagenId, setImagenId] = useState<string | null>(null)
  const [acepto, setAcepto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)

  const ofrece = cara === 'ofrece'
  const puede =
    titulo.trim().length >= 3 && municipio !== '' && (!ofrece || acepto) && !enviando

  async function enviar() {
    setEnviando(true)
    setError(null)
    try {
      await rpc.comunidad.publicarEnMuro({
        cara,
        categoria,
        titulo: titulo.trim(),
        detalle: detalle.trim() || undefined,
        municipio,
        imagen_id: imagenId ?? undefined,
        acopio_id: acopioId || undefined,
        acepto_publicar_nombre: acepto,
      })
      setListo(true)
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
    return (
      <MarcoFlujo titulo="Listo" volver="/muro">
        <div className="shadow-canto rounded-2xl bg-card p-4">
          <h2 className="font-heading text-2xl">Tu publicación salió.</h2>

          {/* Ya no hay enlace que guardar: desde el ADR 0006 la publicación
              cuelga de la cuenta, así que se vuelve a ella desde el perfil
              como todo lo demás. Antes había que copiar un token en un papel
              y perderlo era perder la publicación. */}
          <p className="mt-2 text-base">
            {ofrece
              ? 'Aparece en el muro con tu nombre. Puedes borrarla cuando quieras.'
              : 'La vas a encontrar en tu perfil. Se borra sola a los 15 días.'}
          </p>

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
          className="bg-card border border-input focus-visible:ring-ring mt-2 min-h-14 w-full rounded-2xl px-4 text-base focus-visible:ring-2 focus-visible:outline-none"
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
          className="bg-card border border-input focus-visible:ring-ring mt-2 w-full resize-none rounded-2xl px-4 py-3 text-base focus-visible:ring-2 focus-visible:outline-none"
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
        <Combobox
          items={municipios}
          value={municipioElegido ?? null}
          onValueChange={(m: MunicipioMuro | null) =>
            setMunicipio(m?.codigo_dane ?? '')
          }
          itemToStringLabel={(m: MunicipioMuro) =>
            m.departamento ? `${m.nombre} · ${m.departamento}` : m.nombre
          }
          isItemEqualToValue={(a: MunicipioMuro, b: MunicipioMuro) =>
            a.codigo_dane === b.codigo_dane
          }
        >
          <ComboboxTrigger id="municipio" aria-label="Municipio" className="mt-2">
            <ComboboxValue placeholder="Elige uno" />
          </ComboboxTrigger>
          <ComboboxContent>
            <ComboboxInput showTrigger={false} placeholder="Escribe para buscar" />
            <ComboboxEmpty>No encontramos ese lugar.</ComboboxEmpty>
            <ComboboxList>
              {(m: MunicipioMuro) => (
                <ComboboxItem key={m.codigo_dane} value={m}>
                  <span className="flex min-w-0 flex-col">
                    <span>{m.nombre}</span>
                    {m.departamento && (
                      <span className="text-sm text-muted-foreground">
                        {m.departamento}
                      </span>
                    )}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <p className="mt-1 text-sm text-muted-foreground">
          El municipio basta. No pedimos tu dirección.
        </p>
      </div>

      {/* Solo para quien OFRECE, y solo donde hay centros. Quien pide no
          entrega nada, así que la pregunta no le toca. */}
      {ofrece && acopios.length > 0 && (
        <div className="mt-4">
          <label
            htmlFor="acopio"
            className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase"
          >
            Dónde lo entregas (opcional)
          </label>
          <select
            id="acopio"
            value={acopioId}
            onChange={(e) => setAcopioId(e.target.value)}
            className="bg-card border border-input focus-visible:ring-ring mt-2 min-h-14 w-full rounded-2xl px-4 text-base focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="">Lo acuerdo con quien lo necesite</option>
            {acopios.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
                {a.direccion ? ` · ${a.direccion}` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-muted-foreground">
            Si eliges un punto, lo dejas ahí y quien lo necesite lo recoge ahí.
            Así no tienes que dar tu dirección ni encontrarte con nadie.
          </p>
        </div>
      )}

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
