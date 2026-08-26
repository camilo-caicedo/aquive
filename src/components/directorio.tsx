import Link from 'next/link'
import { Plus } from 'lucide-react'
import { AccionPrincipal } from '@/components/accion-principal'
import { Info, Inbox, ShieldAlert, Stethoscope, CircleAlert, Briefcase, MapPin } from 'lucide-react'
import { servidor } from '@/orpc/local'
import { AVISO_SERVICIOS, NO_PAGUES_POR_ADELANTADO } from '@/lib/honestidad'
import { GRUPOS, MODALIDADES, MODOS_PRECIO } from '@/lib/servicios'
import { NOMBRE_GRUPO } from '@/contrato/servicios'
import { TarjetaProveedor } from '@/components/tarjeta-proveedor'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SelectFiltro } from '@/components/select-filtro'
import { HojaFiltros, GrupoChips } from '@/components/hoja-filtros'
import { PestanasServicios } from '@/components/pestanas-servicios'
import { HeroPortada } from '@/components/hero-portada'
import { VueltaAlDestino } from '@/app/auth/vuelta'
import type { ModalidadServicio, ModoPrecio } from '@/lib/types'

/**
 * El directorio del rebusque.
 *
 * ⚠ Ya NO es la portada por sí solo. Vive aquí como componente y lo montan dos
 * rutas: `/directorio`, que es su URL canónica y la que indexa el buscador, y
 * `/` cuando hay sesión o cuando la URL trae filtros. Ver `src/app/page.tsx`.
 *
 * ⚠ Antes aquí estaba el tablero de solicitudes de la emergencia, que se
 * mudó a /solicitudes. El cambio es de enfoque y lo decidió el
 * responsable: pasó tiempo desde el sismo del 10 de agosto de 2026 y lo
 * que queda vivo es la reactivación económica. El módulo de emergencia
 * sigue entero y sigue siendo temporal — lo que cambia es cuál de los dos
 * recibe a quien llega.
 *
 * El héroe NO se fue con el tablero: la revisión de marca de Google exige
 * que la portada describa para qué sirve la aplicación. Vive en
 * `HeroPortada` y su texto tiene que seguir coincidiendo palabra por
 * palabra con `metadata.description` del layout.
 *
 * Los filtros viven en la URL y no en estado de cliente, igual que en
 * /servidores: así el enlace de «modistas en la comuna 3» se puede pegar
 * en un grupo de WhatsApp, que es como esto se va a difundir de verdad.
 */
export async function Directorio({
  searchParams,
}: {
  searchParams: Promise<{
    oficio?: string
    grupo?: string
    municipio?: string
    zona?: string
    modalidad?: string
    modo?: string
  }>
}) {
  const params = await searchParams

  // Una sola llamada por el contrato (ADR 0001, regla 2). Antes eran siete
  // consultas sueltas desde aquí —las fichas, sus oficios, el catálogo de
  // oficios, los municipios con gente, los 1.100 municipios del país para
  // cruzar nombres, las zonas y mi propia ficha—, y cada una era algo que la
  // aplicación de Expo habría tenido que acordarse de repetir en el mismo
  // orden. La validación de los filtros también se fue: la hace el contrato,
  // así que un municipio que no sean cinco dígitos ya no llega a la consulta.
  const pedidos = {
    oficio: params.oficio || undefined,
    grupo: params.grupo || undefined,
    municipio: params.municipio || undefined,
    zona: params.zona || undefined,
    modalidad: MODALIDADES.some((m) => m.valor === params.modalidad)
      ? (params.modalidad as ModalidadServicio)
      : undefined,
    modo: MODOS_PRECIO.some((m) => m.valor === params.modo)
      ? (params.modo as ModoPrecio)
      : undefined,
  }

  const [directorio, miFicha] = await Promise.all([
    servidor.servicios.directorio(pedidos),
    servidor.servicios.miFicha(),
  ])

  const proveedores = directorio.filas
  const { oficios: oficiosCatalogo, municipios: municipiosLista, zonas } = directorio.facetas

  // Lo que quedó aplicado de verdad: el contrato descarta en silencio un
  // filtro mal formado, así que los chips tienen que leerse de ahí y no de la
  // URL, o se pintaría un chip que no está filtrando nada.
  const oficio = params.oficio && oficiosCatalogo.some((o) => o.id === params.oficio)
    ? params.oficio
    : null
  const grupo = params.grupo && NOMBRE_GRUPO[params.grupo] ? params.grupo : null
  const municipio = params.municipio && /^[0-9]{5}$/.test(params.municipio)
    ? params.municipio
    : null
  const zona = zonas.some((z) => z.id === params.zona) ? (params.zona as string) : null
  const modalidad = MODALIDADES.some((m) => m.valor === params.modalidad)
    ? (params.modalidad as ModalidadServicio)
    : null
  const modo = MODOS_PRECIO.some((m) => m.valor === params.modo)
    ? (params.modo as ModoPrecio)
    : null

  const misOficiosEscondidos = miFicha?.oficios_escondidos ?? 0

  // El href de cada chip es la URL sin ESE filtro. Quitar el municipio se
  // lleva también la zona: una comuna sin su ciudad no filtra nada, y
  // dejarla colgada devolvía una lista vacía sin explicación.
  const aplicados: Record<string, string | null> = {
    oficio,
    grupo,
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
    return qs ? `/?${qs}` : '/'
  }

  const nombreOficio = new Map(oficiosCatalogo.map((o) => [o.id, o.nombre]))
  const nombreZona = new Map(zonas.map((z) => [z.id, z.nombre]))
  const nombreMunicipio = new Map(municipiosLista.map((m) => [m.codigo_dane, m.nombre]))

  const chipsAplicados = (
    [
      ['oficio', oficio ? nombreOficio.get(oficio) : null],
      ['grupo', grupo ? NOMBRE_GRUPO[grupo] : null],
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

  // Con lo que se le PIDIÓ a la consulta, no con lo que se pudo pintar como
  // chip. Un ?oficio=inventado sí filtra —y no encuentra nada—, así que la
  // lista vacía tiene que decir «nadie coincide con estos filtros» y no
  // «todavía no hay nadie en el directorio», que sería falso habiendo cuatro.
  const hayFiltro = Object.values(pedidos).some(Boolean)

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <VueltaAlDestino />
      <HeroPortada />

      {/* ⚠ Aquí NO va `CabeceraPantalla`. Ese componente se pega al
          encabezado global con un margen negativo arriba, y en esta
          pantalla el héroe va delante: el título se metía por debajo de la
          tarjeta del héroe y quedaba tapado a media palabra.

          Y tampoco haría falta: el `h1` de esta pantalla es el del héroe,
          que la revisión de marca de Google exige que describa la
          aplicación. Dos `h1` en una página además no es un detalle de
          estilo. Desviación consciente de la regla 8 —el `h1` no repite la
          etiqueta de la barra— y es la única pantalla donde pasa. */}
      <section className="mt-8">
        <h2 className="font-heading text-3xl leading-tight font-extrabold tracking-tight">
          Servicios
        </h2>
        <p className="mt-1 text-base text-muted-foreground">
          Gente que vive de su oficio y quiere que la encuentren.
        </p>
        <PestanasServicios activa="oficios" />
        <HojaFiltros
          action="/"
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
              detalle: o.grupo ? GRUPOS[o.grupo as keyof typeof GRUPOS] : undefined,
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
              detalle: m.departamento ?? undefined,
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

        {/* ⚠ Aquí había también un «Quién está pidiendo». Se fue: esa lista
            es ahora un destino propio de la barra —«Solicitudes»— y tenerla
            además aquí eran dos puertas al mismo cuarto. Queda solo lo que
            no está en la barra: publicar la ficha propia. */}
        <div className="riel -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
          {/* El mapa conserva los filtros: «modistas en la comuna 3» se ve
              igual en lista y en mapa, y el enlace sigue sirviendo. */}
          <Link
            href={chipsAplicados.length > 0 ? `/mapa?${new URLSearchParams(
              Object.entries(aplicados).filter(([, v]) => Boolean(v)) as [string, string][],
            ).toString()}` : '/mapa'}
            className="shadow-canto inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-card px-4 text-base text-foreground transition-colors hover:bg-muted"
          >
            <MapPin className="size-4" aria-hidden="true" />
            Ver el mapa
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
      </section>

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
              ? 'bg-accent text-accent-foreground shadow-canto'
              : 'bg-card shadow-canto'
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

      {/* La única puerta a /servicios/confirmar. El código no viaja en
          ningún enlace ni en ningún QR: esto solo lleva al formulario donde
          se escribe a mano. Va ENCIMA de la lista porque quien llega con un
          papel en la mano no baja veinte fichas para encontrar dónde
          meterlo. */}
      <p className="mt-4 text-base text-muted-foreground">
        ¿Te hicieron un trabajo y te dieron un código?{' '}
        <Link href="/servicios/confirmar" className="underline">
          Califícalo aquí
        </Link>
      </p>

      <p className="mt-4 text-base font-semibold">
        {proveedores.length}{' '}
        {proveedores.length === 1 ? 'persona' : 'personas'}
        {hayFiltro && (
          <span className="font-normal text-muted-foreground"> con estos filtros</span>
        )}
      </p>

      {proveedores.length === 0 ? (
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
              render={<Link href="/" />}
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
            <TarjetaProveedor key={p.id} proveedor={p} />
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


      {/* Puente al otro lado del sitio. Estaba en la portada, que se lo
          quedaba entero para explicar dos cosas que no eran suyas; aquí es
          donde de verdad se busca. Lo que importa de este texto es la
          diferencia de vida útil, que es lo que sostiene la promesa de
          borrado del tablero. */}
      <section className="mt-8 flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-canto sm:flex-row sm:items-center sm:p-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Stethoscope className="size-6" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h2 className="font-heading text-2xl font-extrabold tracking-tight">
            ¿Necesitas un profesional?
          </h2>
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
