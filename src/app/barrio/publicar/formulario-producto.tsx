'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { rpc } from '@/orpc/cliente'
import { MarcoFlujo } from '@/components/marco-flujo'
import { SubirImagen } from '@/components/subir-imagen'
import { Button } from '@/components/ui/button'
import { useAviso } from '@/components/avisos'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  type MiProducto,
  NOMBRE_UNIDAD,
  UNIDADES_PRODUCTO,
  type UnidadProducto,
} from '@/contrato/comunidad'

type Modo = 'gratis' | 'aporte' | 'solidario' | 'normal'

const MODOS: { valor: Modo; etiqueta: string; ayuda: string }[] = [
  { valor: 'normal', etiqueta: 'Precio normal', ayuda: 'El que cobras siempre.' },
  {
    valor: 'solidario',
    etiqueta: 'Precio solidario',
    ayuda: 'Más barato para quien está sin trabajo.',
  },
  { valor: 'aporte', etiqueta: 'Lo que puedan dar', ayuda: 'Sin precio fijo.' },
  { valor: 'gratis', etiqueta: 'Gratis', ayuda: 'Lo regalas.' },
]

/**
 * Poner algo a la venta en «Hecho en el barrio».
 *
 * ⚠ El precio NO es un campo de texto. Es modo + un «desde» numérico +
 * una unidad de lista, que es la regla de producto 1: por un campo libre se
 * cuela un segundo teléfono, y de paso «$5.000 o negociable, llámame»
 * convierte una lista en un tablón de anuncios.
 *
 * Quien publica ya tiene ficha —lo exige el dominio, no esta pantalla—, así
 * que aquí no se vuelve a pedir el nombre ni el municipio: salen de ella. Es
 * también lo que hace que su autorización de nombre público, con su fecha,
 * siga siendo la misma y no haya que firmar otra.
 *
 * Sirve para poner algo y para corregirlo, con `producto` o sin él. Son la
 * misma pantalla porque son los mismos campos y las mismas reglas: dos
 * copias se separarían en la primera corrección que se hiciera en una sola.
 */
export function FormularioProducto({ producto }: { producto?: MiProducto }) {
  const router = useRouter()
  const avisar = useAviso()
  const [nombre, setNombre] = useState(producto?.nombre ?? '')
  const [detalle, setDetalle] = useState(producto?.detalle ?? '')
  const [modo, setModo] = useState<Modo>(producto?.modo ?? 'normal')
  const [precio, setPrecio] = useState(
    producto?.precio_desde == null ? '' : String(producto.precio_desde),
  )
  const [unidad, setUnidad] = useState<UnidadProducto | ''>(producto?.unidad ?? '')
  const [imagenId, setImagenId] = useState<string | null>(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Gratis no lleva precio; los otros tres lo llevan opcional, y si lo
  // llevan tiene que traer su unidad — «desde $3.500» a secas no dice de qué.
  const llevaPrecio = modo !== 'gratis'
  const precioNumero = precio.replace(/\D/g, '')
  const parEsValido =
    !llevaPrecio || precioNumero === '' ? unidad === '' || precioNumero !== '' : unidad !== ''

  const puede = nombre.trim().length >= 2 && parEsValido && !enviando && !subiendoFoto

  async function enviar() {
    setEnviando(true)
    setError(null)
    const campos = {
      nombre: nombre.trim(),
      detalle: detalle.trim() || undefined,
      modo,
      precio_desde:
        llevaPrecio && precioNumero !== '' ? Number(precioNumero) : undefined,
      unidad: llevaPrecio && unidad !== '' ? unidad : undefined,
      imagen_id: imagenId ?? undefined,
    }
    try {
      if (producto) {
        await rpc.comunidad.editarProducto({ id: producto.id, ...campos })
      } else {
        await rpc.comunidad.publicarProducto(campos)
      }
      avisar(producto ? 'Producto guardado' : 'Producto publicado')
      router.push('/barrio/mios')
      router.refresh()
    } catch (e) {
      const motivo =
        e && typeof e === 'object' && 'data' in e
          ? ((e.data as { motivo?: string } | undefined)?.motivo ?? null)
          : null
      setError(motivo ?? 'No se pudo publicar. Inténtalo otra vez.')
      setEnviando(false)
    }
  }

  return (
    <MarcoFlujo
      titulo={producto ? 'Corregirlo' : 'Vender algo'}
      volver={producto ? '/barrio/mios' : '/barrio'}
      accion={
        <Button className="w-full" disabled={!puede} onClick={enviar}>
          {enviando ? 'Guardando…' : producto ? 'Guardar' : 'Publicar'}
        </Button>
      }
    >
      <p className="text-base text-muted-foreground">
        Aparece con tu nombre y con los datos de tu ficha, que es por donde te
        van a escribir. El precio es información: AquíVe no cobra comisión y no
        recibe el pago.
      </p>

      <div className="mt-6">
        <label
          htmlFor="nombre"
          className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase"
        >
          Qué vendes
        </label>
        <input
          id="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={140}
          placeholder="Tamales de pollo"
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
          {detalle.length}/300 · Sin teléfonos ni correos: ya están en tu ficha.
        </p>
      </div>

      <fieldset className="mt-6">
        <legend className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
          Cómo lo cobras
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {MODOS.map((m) => (
            <button
              key={m.valor}
              type="button"
              aria-pressed={modo === m.valor}
              onClick={() => setModo(m.valor)}
              className={`inline-flex min-h-12 items-center rounded-full px-4 text-base transition-colors ${
                modo === m.valor
                  ? 'bg-foreground font-semibold text-background'
                  : 'shadow-canto bg-card hover:bg-muted'
              }`}
            >
              {m.etiqueta}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {MODOS.find((m) => m.valor === modo)?.ayuda}
        </p>
      </fieldset>

      {llevaPrecio && (
        <div className="mt-4">
          <span className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
            Desde cuánto (opcional)
          </span>
          <div className="mt-2 flex gap-2">
            <div className="flex-1">
              <label htmlFor="precio" className="sr-only">
                Precio desde
              </label>
              <input
                id="precio"
                inputMode="numeric"
                value={precio}
                onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ''))}
                placeholder="3500"
                className="bg-card border border-input focus-visible:ring-ring min-h-14 w-full rounded-2xl px-4 text-base focus-visible:ring-2 focus-visible:outline-none"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="unidad" className="sr-only">
                Por unidad
              </label>
              {/* Lista cerrada, no texto: «la libra» y «x libra» son lo
                  mismo escrito de dos formas, y así la lista no se puede
                  ordenar ni comparar. */}
              {/* Con el desplegable de la aplicación, no el del sistema:
                  un `<select>` nativo dentro de la hoja abre la lista del
                  teléfono y se ve como si fuera de otra aplicación. */}
              <Select
                value={unidad}
                onValueChange={(v) => setUnidad((v ?? '') as UnidadProducto | '')}
              >
                <SelectTrigger id="unidad">
                  <SelectValue placeholder="Por…">
                    {(v: string) => NOMBRE_UNIDAD[v as UnidadProducto] ?? 'Por…'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Por…</SelectItem>
                  {UNIDADES_PRODUCTO.map((u) => (
                    <SelectItem key={u} value={u}>
                      {NOMBRE_UNIDAD[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {!parEsValido && (
            <p className="mt-1 text-sm text-muted-foreground">
              El precio va con su unidad: «desde $3.500 la unidad».
            </p>
          )}
        </div>
      )}

      <div className="mt-6">
        <SubirImagen objetoTipo="producto" onSubida={setImagenId} onEstadoSubida={setSubiendoFoto} />
        <p className="mt-1 text-sm text-muted-foreground">
          Máximo 2 MB. Una persona la revisa antes de que se vea: si tiene datos
          de alguien, un documento o a un menor, no se publica.
          {producto ? ' Si no subes otra, se queda la que ya tenía.' : ''}
        </p>
      </div>

      {error && (
        <p className="bg-accent text-accent-foreground mt-4 rounded-2xl p-4 text-base">
          {error}
        </p>
      )}

      {!producto && (
      <p className="mt-4 text-base text-muted-foreground">
        ¿Todavía no tienes ficha?{' '}
        <Link href="/servicios/soy-proveedor" className="text-enlace underline underline-offset-4">
          Ármala primero
        </Link>
        : es la que lleva tu nombre y tu contacto.
      </p>
      )}
    </MarcoFlujo>
  )
}
