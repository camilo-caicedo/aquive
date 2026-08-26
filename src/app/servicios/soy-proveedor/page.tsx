import Link from 'next/link'
import { BadgeCheck, Check, ChevronRight, Eye, Hash, Pencil } from 'lucide-react'
import { MarcoFlujo } from '@/components/marco-flujo'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { Carne } from '@/components/carne'
import { PuertaCerrada } from '@/components/puerta-cerrada'
import { MiUbicacion } from '@/components/mi-ubicacion'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios, nombreConDepartamento } from '@/lib/municipios'
import { RESPONSABLE_SERVICIOS } from '@/lib/config'
import { GRUPOS, zonaLegible } from '@/lib/servicios'
import type { GrupoOficio, MiProveedor } from '@/lib/types'
import { servidor } from '@/orpc/local'
import { FormularioProveedor } from './formulario-proveedor'

export const metadata = { title: 'Mi ficha' }

export default async function SoyProveedorPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Esta pantalla ya explicaba por qué hace falta cuenta y ya nombraba la
  // tercera puerta —el alta asistida—, que es lo que el módulo necesita
  // para no dejar fuera a quien no tiene Google. Lo que le faltaba es
  // volver: al entrar caía en la portada y había que buscar esto otra vez.
  if (!user) {
    return (
      <MarcoFlujo titulo="Ofrecer mi trabajo" volver="/servicios">
        <PuertaCerrada
          titulo="Para publicar tu ficha hace falta una cuenta"
          porque="Tu ficha lleva tu nombre y tu teléfono, y se queda publicada hasta que tú la borres: tiene que poder volver a ella solo quien la creó."
          seConserva="Al entrar vuelves justo aquí."
          destino="/servicios/soy-proveedor"
          alternativa={`¿No tienes cuenta de Google o no quieres crear una? Una organización aliada puede registrarte y darte un enlace propio para que manejes tu ficha. Pregunta en el punto de ${RESPONSABLE_SERVICIOS} más cercano.`}
        />
      </MarcoFlujo>
    )
  }

  const [{ data: mio }, { data: oficios }, { data: zonas }, municipios] =
    await Promise.all([
      supabase.rpc('mi_proveedor', {}),
      supabase.from('catalogo_oficios').select('*').eq('activo', true).order('orden'),
      // Todas las zonas de una vez y se filtran en el cliente al elegir
      // municipio. Hoy son 37 filas —solo Cali—; si algún día se siembran
      // varias ciudades, esto pasa a una consulta por municipio.
      supabase.from('zonas').select('*').eq('activa', true).order('orden'),
      listarMunicipios(supabase),
    ])

  const proveedor = (mio as MiProveedor | null) ?? null

  // ─────────────────────────────────────────────────────────────────
  // Pantalla 14 · Sin ficha todavía: el alta, con su índice numerado.
  // Es un flujo y lo envuelve el propio formulario con su MarcoFlujo.
  // Sin <main> ni h1 aquí, o se verían dos títulos.
  // ─────────────────────────────────────────────────────────────────
  if (!proveedor) {
    return (
      <FormularioProveedor
        proveedor={null}
        municipios={municipios ?? []}
        oficios={oficios ?? []}
        zonas={zonas ?? []}
      />
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // Pantalla 15 · Con ficha: el carné publicado.
  //
  // Aquí ya no se edita. Editar es lo que hacen las pantallas de
  // `/perfil`, cada una con su sección; esto es lo que se entra a MIRAR
  // —cómo te ven— y por eso es un destino, con su cromo y su barra.
  // ─────────────────────────────────────────────────────────────────

  // El punto propio se lee de la TABLA y no de la vista pública: quien se
  // quitó del mapa tiene que poder ver el suyo para volver a ponerlo, y la
  // vista —con razón— se lo esconde a todo el mundo.
  const ubicacion = await servidor.servicios.miUbicacion()

  const municipio = municipios?.find((m) => m.codigo_dane === proveedor.municipio)
  const publicados = proveedor.oficios.filter((o) => o.publicado)
  const escondidos = proveedor.oficios.filter((o) => !o.publicado)
  const grupos = [...new Set(publicados.map((o) => GRUPOS[o.grupo as GrupoOficio]))]
  const donde = zonaLegible(
    zonas?.find((z) => z.id === proveedor.zona_id)?.nombre ?? null,
    proveedor.zona_texto
  )

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <CabeceraPantalla titulo="Mi ficha" volver="/perfil" />

      {/* La cinta dice lo único que quien acaba de publicar quiere saber:
          dónde sale. Verde salvia con texto negro, que es relleno y no
          letra de color. */}
      {proveedor.suspendido ? (
        <div className="rounded-2xl bg-accent p-4 text-accent-foreground">
          <p className="text-base">
            <span className="font-semibold">Tu ficha está suspendida</span> y no
            aparece en el directorio. Escríbenos si crees que fue un error.
          </p>
        </div>
      ) : publicados.length > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl bg-ok-suave p-4 text-foreground">
          <Check className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
          <p className="text-base">
            <span className="font-semibold">Publicada.</span> Apareces en{' '}
            {grupos.join(' y ')}
            {donde ? ` y en las búsquedas de ${donde}` : ''}.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-accent p-4 text-accent-foreground">
          <p className="text-base">
            <span className="font-semibold">Tu ficha todavía no se ve.</span>{' '}
            {proveedor.telefono_verificado
              ? 'Falta una referencia confirmada.'
              : `Alguien de ${RESPONSABLE_SERVICIOS} tiene que llamarte para verificar tu teléfono. Es lo único que comprobamos antes de publicar una ficha.`}
          </p>
        </div>
      )}

      <div className="mt-4">
        <Carne
          id={proveedor.id}
          nombre={proveedor.nombre_visible}
          municipio={municipio ? nombreConDepartamento(municipio) : null}
          grupo={proveedor.oficios[0]?.grupo ?? null}
          telefonoVerificado={proveedor.telefono_verificado}
          referenciasConfirmadas={proveedor.referencias_confirmadas}
          serviciosConfirmados={proveedor.servicios_confirmados}
          esMicroempresa={proveedor.tipo === 'microempresa'}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href={`/servicios/${proveedor.id}`}
          className="shadow-canto flex min-h-12 items-center justify-center gap-2 rounded-full bg-card px-4 text-base font-semibold"
        >
          <Eye className="size-5" aria-hidden="true" />
          Ver como cliente
        </Link>
        <Link
          href="/perfil/datos"
          className="shadow-canto flex min-h-12 items-center justify-center gap-2 rounded-full bg-card px-4 text-base font-semibold"
        >
          <Pencil className="size-5" aria-hidden="true" />
          Editar
        </Link>
      </div>

      <nav aria-label="Mi ficha" className="mt-6 flex flex-col gap-2">
        <Link
          href="/perfil/codigos"
          className="shadow-canto flex min-h-16 items-center gap-3 rounded-2xl bg-card px-4 py-3 transition-colors hover:bg-muted"
        >
          <span className="bg-familia-rojo flex size-10 shrink-0 items-center justify-center rounded-full text-foreground">
            <Hash className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-medium">Dar un código</span>
            <span className="block text-base text-muted-foreground">
              Para que te califiquen al terminar
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>

        <Link
          href="/perfil/verificaciones"
          className="shadow-canto flex min-h-16 items-center gap-3 rounded-2xl bg-card px-4 py-3 transition-colors hover:bg-muted"
        >
          <span className="bg-familia-verde flex size-10 shrink-0 items-center justify-center rounded-full text-foreground">
            <BadgeCheck className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-medium">Verificaciones</span>
            <span className="block text-base text-muted-foreground">
              {proveedor.telefono_verificado
                ? `${proveedor.referencias_confirmadas} ${proveedor.referencias_confirmadas === 1 ? 'referencia confirmada' : 'referencias confirmadas'}`
                : 'Falta verificar tu teléfono'}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      </nav>

      {/* Qué oficio no aparece y por qué. Dicho con el nombre del oficio,
          no como una regla general: quien lee «regla de riesgo alto» y no
          sabe cuál de los suyos es, no puede hacer nada. */}
      {escondidos.length > 0 && (
        <p className="mt-4 rounded-2xl bg-accent p-4 text-base text-accent-foreground">
          «{escondidos[0].nombre}»
          {escondidos.length > 1 ? ` y ${escondidos.length - 1} más` : ''} no
          {escondidos.length > 1 ? ' aparecen' : ' aparece'} todavía: es un oficio
          de riesgo alto y necesita una referencia confirmada además del teléfono
          verificado.
        </p>
      )}

      {/* La ubicación va aparte y con su propia casilla: el consentimiento
          de publicar dónde estás es otra finalidad que el de publicar tu
          nombre (ADR 0004, artículo 9 de la Ley 1581). Aparte también en la
          pantalla, para que se lea como lo que es. */}
      <div className="mt-6">
        <MiUbicacion
          latitudInicial={ubicacion?.latitud ?? null}
          longitudInicial={ubicacion?.longitud ?? null}
          aceptadoInicial={ubicacion?.acepto ?? false}
        />
      </div>
    </main>
  )
}
