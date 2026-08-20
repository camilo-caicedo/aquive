import Link from 'next/link'
import { Plus } from 'lucide-react'
import { AccionPrincipal } from '@/components/accion-principal'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { Info, Inbox, ShieldAlert, Stethoscope, CircleAlert, Briefcase } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AVISO_SERVICIOS, NO_PAGUES_POR_ADELANTADO } from '@/lib/honestidad'
import { listarMunicipios, mapaDeNombres } from '@/lib/municipios'
import { GRUPOS, MODALIDADES, MODOS_PRECIO } from '@/lib/servicios'
import { TarjetaProveedor } from '@/components/tarjeta-proveedor'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SelectFiltro } from '@/components/select-filtro'
import { HojaFiltros, GrupoChips } from '@/components/hoja-filtros'
import { PestanasServicios } from '@/components/pestanas-servicios'
import type { MiProveedor, ModalidadServicio, ModoPrecio } from '@/lib/types'

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

  const [
    { data: proveedores },
    { data: oficiosCatalogo },
    { data: municipiosLista },
    todos,
    { data: mio },
  ] = await Promise.all([
    query,
    supabase.from('oficios_con_proveedores').select('*').order('orden'),
    supabase.from('municipios_con_proveedores').select('*').order('nombre'),
    listarMunicipios(supabase),
    // Sin sesión devuelve null y no cuesta nada. Con sesión es lo que
    // convierte «Ofrecer mi trabajo» en «Mi ficha»: quien ya la publicó
    // no tenía por dónde volver a ella, y el botón le seguía ofreciendo
    // crear una que ya existe.
    supabase.rpc('mi_proveedor', {}),
  ])

  const miFicha = (mio as MiProveedor | null) ?? null
  const misOficiosEscondidos =
    miFicha?.oficios.filter((o) => !o.publicado).length ?? 0

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

  // El href de cada chip es la URL sin ESE filtro. Quitar el municipio se
  // lleva también la zona: una comuna sin su ciudad no filtra nada, y
  // dejarla colgada devolvía una lista vacía sin explicación.
  const aplicados: Record<string, string | null> = {
    oficio: params.oficio ?? null,
    municipio,
    zona,
    modalidad,
    modo,
  }
  function sinFiltro(quitar: string) {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(aplicados)) {
      if (!v || k === quitar) continue
      if (quitar === 'municipio' && k === 'zona') continue
      sp.set(k, v)
    }
    const qs = sp.toString()
    return qs ? `/servicios?${qs}` : '/servicios'
  }

  const nombreOficio = new Map((oficiosCatalogo ?? []).map((o) => [o.id, o.nombre]))
  const nombreZona = new Map((zonas ?? []).map((z) => [z.id, z.nombre]))

  const chipsAplicados = (
    [
      ['oficio', params.oficio ? nombreOficio.get(params.oficio) : null],
      ['municipio', municipio ? nombreMunicipio.get(municipio) : null],
      ['zona', zona ? nombreZona.get(zona) : null],
      ['modalidad', MODALIDADES.find((m) => m.valor === modalidad)?.etiqueta ?? null],
      ['modo', MODOS_PRECIO.find((m) => m.valor === modo)?.etiqueta ?? null],
    ] as const
  )
    .filter(([, etiqueta]) => !!etiqueta)
    .map(([clave, etiqueta]) => ({
      clave,
      etiqueta: etiqueta as string,
      href: sinFiltro(clave),
    }))

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
      <CabeceraPantalla titulo="Servicios">
        <PestanasServicios activa="oficios" />
        <HojaFiltros
          action="/servicios"
          id="hoja-filtros-servicios"
          titulo="Filtrar oficios"
          aplicados={chipsAplicados}
        >
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

          {/* Si no se dice, el desplegable recortado parece un error. */}
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <Info className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
            <span>
              Las listas de oficios y municipios solo muestran los que ya tienen a
              alguien registrado.
            </span>
          </p>

          {/* Las tres listas cortas pasan a chips: un toque en vez de abrir un
              desplegable, elegir y cerrarlo. */}
          {(zonas?.length ?? 0) > 0 && (
            <GrupoChips
              name="zona"
              label="Dónde"
              todos="Toda la ciudad"
              valorInicial={zona ?? ''}
              opciones={(zonas ?? []).map((z) => ({ valor: z.id, etiqueta: z.nombre }))}
              nota="Solo las zonas donde ya hay alguien registrado."
            />
          )}
          <GrupoChips
            name="modalidad"
            label="Cómo atiende"
            todos="En cualquier parte"
            valorInicial={modalidad ?? ''}
            opciones={MODALIDADES.map((m) => ({ valor: m.valor, etiqueta: m.etiqueta }))}
          />
          <GrupoChips
            name="modo"
            label="Precio"
            todos="Cualquier precio"
            valorInicial={modo ?? ''}
            opciones={MODOS_PRECIO.map((m) => ({ valor: m.valor, etiqueta: m.etiqueta }))}
          />
        </HojaFiltros>

        {/* La otra vista del módulo, como interruptor. Era un enlace de
            texto perdido entre tres botones. */}
        <div className="riel -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
          <Link
            href="/servicios/solicitudes"
            aria-pressed="false"
            className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 text-base text-foreground transition-colors hover:bg-muted"
          >
            <Inbox className="size-4" aria-hidden="true" />
            Quién está pidiendo
          </Link>
          {!miFicha && (
            <Link
              href="/servicios/soy-proveedor"
              className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 text-base text-foreground transition-colors hover:bg-muted"
            >
              <Briefcase className="size-4" aria-hidden="true" />
              Ofrecer mi trabajo
            </Link>
          )}
        </div>
      </CabeceraPantalla>

      <p className="text-base text-muted-foreground">
        Gente que trabaja por su cuenta y negocios pequeños. Acuerdas el precio
        y el trabajo directamente con la persona: la plataforma no participa ni
        cobra nada.
      </p>



      {/* Dónde está lo suyo, dicho apenas entra. Sin esto, quien ya
          publicó su ficha no tenía forma de saber si aparece ni por dónde
          volver a ella: el botón le seguía ofreciendo crear una. */}
      {/* Cinta accionable, no una nota gris al final de tres botones: dice
          qué pasa y lleva a arreglarlo de un toque. Quien ya publicó su
          ficha no tenía forma de saber si aparece ni por dónde volver. */}
      {miFicha && (
        <div
          className={`mt-4 flex items-center gap-3 rounded-2xl px-4 py-3 ${
            miFicha.suspendido || misOficiosEscondidos > 0
              ? 'border border-primary/30 bg-accent text-accent-foreground'
              : 'bg-card shadow-sm'
          }`}
        >
          {(miFicha.suspendido || misOficiosEscondidos > 0) && (
            <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
          )}
          <p className="min-w-0 flex-1 text-base">
            {miFicha.suspendido
              ? 'Tu ficha está suspendida y no aparece en el directorio.'
              : misOficiosEscondidos > 0
                ? `${
                    misOficiosEscondidos === 1
                      ? 'Uno de tus oficios no aparece'
                      : `${misOficiosEscondidos} de tus oficios no aparecen`
                  } todavía.`
                : 'Tu ficha está publicada.'}
          </p>
          <Button
            variant="outline"
            className="shrink-0"
            nativeButton={false}
            render={<Link href="/servicios/soy-proveedor" />}
          >
            {miFicha.suspendido || misOficiosEscondidos > 0 ? 'Revisar' : 'Ver y editar'}
          </Button>
        </div>
      )}


      <p className="mt-4 text-sm text-muted-foreground">{AVISO_SERVICIOS}</p>

      <p className="mt-4 text-base font-semibold">
        {proveedores?.length ?? 0}{' '}
        {proveedores?.length === 1 ? 'persona' : 'personas'}
        {hayFiltro && (
          <span className="font-normal text-muted-foreground"> con estos filtros</span>
        )}
      </p>

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

      {/* Puente al otro lado del sitio. Estaba en la portada, que se lo
          quedaba entero para explicar dos cosas que no eran suyas; aquí es
          donde de verdad se busca. Lo que importa de este texto es la
          diferencia de vida útil, que es lo que sostiene la promesa de
          borrado del tablero. */}
      <section className="mt-8 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:p-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Stethoscope className="size-6" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h2 className="font-heading text-2xl">¿Necesitas un profesional?</h2>
          <p className="mt-1 text-base text-muted-foreground">
            Psicología, revisión de tu casa, atención médica, asesoría jurídica. Cada quien declara su matrícula; a algunos ya les revisamos que ese número exista en el registro, y esos aparecen de primeros.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          nativeButton={false}
          render={<Link href="/servidores?ver=profesionales" />}
        >
          Ver profesionales
        </Button>
      </section>
      <AccionPrincipal
        etiqueta="Necesito un servicio"
        Icono={Plus}
        href="/servicios/publicar"
      />
    </main>
  )
}
