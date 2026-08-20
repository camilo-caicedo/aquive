import Link from 'next/link'
import { Info, Inbox, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AVISO_SERVICIOS, NO_PAGUES_POR_ADELANTADO } from '@/lib/honestidad'
import { listarMunicipios, mapaDeNombres } from '@/lib/municipios'
import { GRUPOS, MODALIDADES, MODOS_PRECIO } from '@/lib/servicios'
import { TarjetaProveedor } from '@/components/tarjeta-proveedor'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SelectFiltro } from '@/components/select-filtro'
import { FormularioFiltros } from '@/components/formulario-filtros'
import { PestanasServicios } from '@/components/pestanas-servicios'
import type { ModalidadServicio, ModoPrecio } from '@/lib/types'

export const metadata = { title: 'Servicios' }

/**
 * El directorio del rebusque.
 *
 * Los filtros viven en la URL y no en estado de cliente, igual que en
 * /servidores: así el enlace de «modistas en la comuna 3» se puede pegar
 * en un grupo de WhatsApp, que es como esto se va a difundir de verdad.
 */
export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{
    oficio?: string
    municipio?: string
    zona?: string
    modalidad?: string
    modo?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Mismo cuidado que en /servidores: el municipio se valida antes de
  // llegar a un filtro de PostgREST. Cinco dígitos y nada más.
  const municipio =
    params.municipio && /^[0-9]{5}$/.test(params.municipio) ? params.municipio : null
  const zona =
    params.zona &&
    /^[0-9a-f-]{36}$/.test(params.zona)
      ? params.zona
      : null
  const modalidad = MODALIDADES.some((m) => m.valor === params.modalidad)
    ? (params.modalidad as ModalidadServicio)
    : null
  const modo = MODOS_PRECIO.some((m) => m.valor === params.modo)
    ? (params.modo as ModoPrecio)
    : null

  let query = supabase
    .from('proveedores_publicos')
    .select('*')
    // Verificados primero. Es el único dato comprobado que hay, y no es
    // una recomendación: la ficha lo explica.
    .order('telefono_verificado', { ascending: false })
    .order('servicios_confirmados', { ascending: false })
    .order('nombre_visible')

  if (params.oficio) query = query.contains('oficios', [params.oficio])
  if (municipio) query = query.eq('municipio', municipio)
  if (zona) query = query.eq('zona_id', zona)
  if (modalidad) query = query.contains('modalidad', [modalidad])
  if (modo) query = query.contains('modos', [modo])

  const [{ data: proveedores }, { data: oficiosCatalogo }, { data: municipiosLista }, todos] =
    await Promise.all([
      query,
      supabase.from('oficios_con_proveedores').select('*').order('orden'),
      supabase.from('municipios_con_proveedores').select('*').order('nombre'),
      listarMunicipios(supabase),
    ])

  const nombreMunicipio = mapaDeNombres(todos ?? [])

  // Las zonas solo se ofrecen cuando ya se filtró por municipio: un
  // desplegable con las comunas de Cali mezcladas con los barrios de otra
  // ciudad no significa nada.
  const { data: zonas } = municipio
    ? await supabase
        .from('zonas')
        .select('*')
        .eq('municipio', municipio)
        .eq('activa', true)
        .order('orden')
    : { data: null }

  // Los oficios de cada proveedor, con precio, en una sola consulta en
  // vez de una por tarjeta. Sale de la vista que aplica la regla S.
  const ids = (proveedores ?? []).map((p) => p.id)
  const { data: oficiosProveedor } = ids.length
    ? await supabase
        .from('proveedor_oficios_publicos')
        .select('*')
        .in('proveedor_id', ids)
    : { data: null }

  const porProveedor = new Map<string, NonNullable<typeof oficiosProveedor>>()
  for (const o of oficiosProveedor ?? []) {
    const lista = porProveedor.get(o.proveedor_id) ?? []
    lista.push(o)
    porProveedor.set(o.proveedor_id, lista)
  }

  const hayFiltro = !!(params.oficio || municipio || zona || modalidad || modo)

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading text-3xl">Servicios</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Gente de Cali que trabaja por su cuenta y negocios pequeños. Acuerdas
        el precio y el trabajo directamente con la persona: la plataforma no
        participa ni cobra nada.
      </p>

      <PestanasServicios activa="oficios" />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="flex-1 sm:flex-initial"
          nativeButton={false}
          render={<Link href="/servicios/publicar" />}
        >
          Necesito un servicio
        </Button>
        <Button
          variant="outline"
          className="flex-1 sm:flex-initial"
          nativeButton={false}
          render={<Link href="/servicios/solicitudes" />}
        >
          Quién está pidiendo
        </Button>
        <Button
          variant="outline"
          className="flex-1 sm:flex-initial"
          nativeButton={false}
          render={<Link href="/servicios/soy-proveedor" />}
        >
          Ofrecer mi trabajo
        </Button>
      </div>

      <FormularioFiltros
        action="/servicios"
        className="mt-4 flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <SelectFiltro
            name="oficio"
            label="Filtrar por oficio"
            placeholder="Todos los oficios"
            valorInicial={params.oficio ?? ''}
            conBusqueda
            opciones={(oficiosCatalogo ?? []).map((o) => ({
              valor: o.id,
              etiqueta: o.nombre,
              detalle: GRUPOS[o.grupo],
            }))}
          />
          <SelectFiltro
            name="municipio"
            label="Filtrar por municipio"
            placeholder="Todos los municipios"
            valorInicial={municipio ?? ''}
            conBusqueda
            opciones={(municipiosLista ?? []).map((m) => ({
              valor: m.codigo_dane,
              etiqueta: m.nombre,
              detalle: m.departamento,
            }))}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {(zonas?.length ?? 0) > 0 && (
            <SelectFiltro
              name="zona"
              label="Filtrar por zona"
              placeholder="Toda la ciudad"
              valorInicial={zona ?? ''}
              opciones={(zonas ?? []).map((z) => ({
                valor: z.id,
                etiqueta: z.nombre,
              }))}
            />
          )}
          <SelectFiltro
            name="modalidad"
            label="Dónde atiende"
            placeholder="En cualquier parte"
            valorInicial={modalidad ?? ''}
            opciones={MODALIDADES.map((m) => ({ valor: m.valor, etiqueta: m.etiqueta }))}
          />
          <SelectFiltro
            name="modo"
            label="Precio"
            placeholder="Cualquier precio"
            valorInicial={modo ?? ''}
            opciones={MODOS_PRECIO.map((m) => ({ valor: m.valor, etiqueta: m.etiqueta }))}
          />
        </div>
      </FormularioFiltros>

      {/* Si no se dice, el desplegable recortado parece un error. */}
      <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
        <Info className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
        <span>
          Las listas de oficios y municipios solo muestran los que ya tienen a
          alguien registrado.
        </span>
      </p>

      <p className="mt-4 text-sm text-muted-foreground">{AVISO_SERVICIOS}</p>

      {!proveedores || proveedores.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center">
          <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-base text-muted-foreground">
            {hayFiltro
              ? 'Nadie coincide con estos filtros todavía.'
              : 'Todavía no hay nadie en el directorio. Si trabajas por tu cuenta, puedes ser el primero.'}
          </p>
          {hayFiltro ? (
            <Button
              variant="outline"
              className="mt-4"
              nativeButton={false}
              render={<Link href="/servicios" />}
            >
              Ver todos
            </Button>
          ) : (
            <Button
              className="mt-4"
              nativeButton={false}
              render={<Link href="/servicios/soy-proveedor" />}
            >
              Ofrecer mi trabajo
            </Button>
          )}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {proveedores.map((p) => (
            <TarjetaProveedor
              key={p.id}
              proveedor={p}
              nombreMunicipio={nombreMunicipio.get(p.municipio)}
              oficios={porProveedor.get(p.id) ?? []}
            />
          ))}
        </ul>
      )}

      <Alert className="mt-6">
        <ShieldAlert className="size-4" aria-hidden="true" />
        <AlertDescription>
          {NO_PAGUES_POR_ADELANTADO}{' '}
          <Link href="/seguridad" className="underline">
            Cómo cuidarte
          </Link>
        </AlertDescription>
      </Alert>

      {/* La única puerta a /servicios/confirmar. El código no viaja en
          ningún enlace ni en ningún QR: esto solo lleva al formulario
          donde se escribe a mano. */}
      <p className="mt-4 text-sm text-muted-foreground">
        ¿Te hicieron un trabajo y te dieron un código?{' '}
        <Link href="/servicios/confirmar" className="underline">
          Califícalo aquí
        </Link>
        .
      </p>
    </main>
  )
}
