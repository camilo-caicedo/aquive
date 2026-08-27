import Link from 'next/link'
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  ClipboardList,
  Clock,
  Hash,
  IdCard,
  KeyRound,
  ListOrdered,
  ShoppingBag,
  Smartphone,
  Star,
  UserPen,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { InsigniasProveedor } from '@/components/insignias-proveedor'
import { SeccionPlegable } from '@/components/seccion-plegable'
import { CerrarSesion } from '@/app/registro/cerrar-sesion'
import { ListaLocal } from '@/app/mis-solicitudes/lista-local'
import { ListaServicios } from '@/app/mis-solicitudes/lista-servicios'
import { createClient } from '@/lib/supabase/server'
import { servidor } from '@/orpc/local'
import { listarMunicipios, nombreConDepartamento } from '@/lib/municipios'
import { CINTA, TINTA_CINTA, type Familia } from '@/lib/familias'
import { GRUPOS } from '@/lib/servicios'
import type { MiProveedor } from '@/lib/types'
import type { MisServicios } from '@/components/panel-servicios-proveedor'
import type { MiReferencia } from '@/components/campos-referencia'
import { codigosSinUsar, promedioResenas } from './cargar'

export const metadata = { title: 'Perfil' }

/** Los cuatro gajos de la sombrilla, en el orden en que se recorren. */
const FAMILIAS: Familia[] = ['azul', 'amarillo', 'verde', 'rojo']

/**
 * Una fila del menú. Glifo, nombre y pista numérica.
 *
 * La pista es el único dato de la fila y por eso es un número con su
 * palabra —«1 sin responder»— y no un punto de color: quien mira esto de
 * pie tiene que saber qué le falta sin abrir las nueve pantallas.
 */
function Fila({
  href,
  Icono,
  nombre,
  pista,
  familia,
}: {
  href: string
  Icono: LucideIcon
  nombre: string
  pista?: string
  familia: Familia
}) {
  return (
    <li>
      <Link
        href={href}
        className="shadow-canto flex min-h-16 items-center gap-3 rounded-2xl bg-card px-4 py-3 transition-colors hover:bg-muted"
      >
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${CINTA[familia]} ${TINTA_CINTA[familia]}`}
        >
          <Icono className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-lg font-medium">{nombre}</span>
        {pista && (
          <span className="shrink-0 text-base text-muted-foreground">{pista}</span>
        )}
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  )
}

/**
 * El centro de «lo mío». Pantalla 16 del prototipo.
 *
 * ⚠ Sin sesión NO rebota a `/login`. Quien publicó una solicitud sin cuenta
 * es el rol central del sitio, y echarlo de su propio perfil es exactamente
 * lo que esta pantalla vino a arreglar: sin sesión enseña lo que este
 * teléfono tiene guardado, que es todo lo suyo que existe.
 */
export default async function PerfilPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ─────────────────────────────────────────────────────────────────
  // Sin cuenta: lo que vive en este teléfono, y nada más.
  // ─────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 py-6">
        <CabeceraPantalla titulo="Perfil" />

        <div className="flex items-start gap-3 rounded-2xl bg-secondary p-4 text-secondary-foreground">
          <Smartphone className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
          <p className="text-base">
            Estas solicitudes viven solo en este teléfono. Si lo cambias o borras
            los datos del navegador, se pierden: guarda el enlace de cada una.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <SeccionPlegable
            titulo="Solicitudes de servicios"
            resumen="Oficios que pediste en el directorio. Duran 15 días, renovables."
            resumenSiempre
            abierta
          >
            <ListaServicios />
          </SeccionPlegable>

          <SeccionPlegable
            titulo="Solicitudes de ayuda"
            resumen="Insumos que pediste. Se borran solas a las 72 horas."
            resumenSiempre
          >
            <ListaLocal />
          </SeccionPlegable>
        </div>

        <nav aria-label="Perfil" className="mt-8">
          <ul className="flex flex-col gap-2">
            <Fila
              href="/login"
              Icono={KeyRound}
              nombre="Entrar con una cuenta"
              pista="Para ofrecer"
              familia="azul"
            />
          </ul>
        </nav>

        <p className="mt-3 text-base text-muted-foreground">
          Solo hace falta cuenta para ofrecer tu trabajo. Para pedir, no.
        </p>
      </main>
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // Con cuenta: la cabecera de identidad y el menú de diez filas.
  // ─────────────────────────────────────────────────────────────────
  const [
    { data: mio },
    { data: servicios },
    { data: refs },
    municipios,
    { data: perfilOfertador },
    misProductos,
  ] = await Promise.all([
      supabase.rpc('mi_proveedor', {}),
      supabase.rpc('mis_servicios', {}),
      supabase.rpc('mis_referencias', {}),
      listarMunicipios(supabase),
      // ¿Tiene también perfil de ofertador? Es el rol del módulo de
      // emergencia, distinto del de prestador. Sus dos vistas vivían tras
      // unas pestañas que este menú reemplaza, y sin esto se quedarían sin
      // ninguna puerta.
      supabase.from('perfiles').select('id').eq('id', user.id).maybeSingle(),
      // Lo que tiene puesto en «Hecho en el barrio». Va por el contrato,
      // que ya filtra por la ficha de quien llama.
      servidor.comunidad.misProductos(),
    ])

  const proveedor = (mio as MiProveedor | null) ?? null
  const esOfertador = Boolean(perfilOfertador)
  const misServicios = (servicios as unknown as MisServicios | null) ?? {
    codigos: [],
    resenas: [],
  }
  const referencias = (refs as unknown as MiReferencia[]) ?? []

  const sinResponder = misServicios.resenas.filter((r) => !r.replica && !r.oculta).length
  const sinUsar = codigosSinUsar(misServicios.codigos).length
  const refsPendientes = referencias.filter((r) => r.estado === 'pendiente').length
  const promedio = promedioResenas(misServicios.resenas)
  const municipio = municipios.find((m) => m.codigo_dane === proveedor?.municipio)
  const primerOficio = proveedor?.oficios[0]

  // Qué falta comprobar, contado igual que lo cuenta /perfil/verificaciones.
  const verificacionesPendientes =
    (proveedor && !proveedor.telefono_verificado ? 1 : 0) + refsPendientes

  // Las filas del menú, en orden y ya filtradas. El color lo pone el
  // recorrido de abajo, no cada una.
  const filas: { href: string; Icono: LucideIcon; nombre: string; pista?: string }[] = [
    { href: '/perfil/datos', Icono: UserPen, nombre: 'Mis datos y contacto' },
    {
      href: '/perfil/oficios',
      Icono: ListOrdered,
      nombre: 'Mis oficios y precios',
      pista: proveedor ? String(proveedor.oficios.length) : undefined,
    },
    // Detrás de los oficios y sus precios, que es lo más parecido que hay:
    // las dos son cosas que esa persona ofrece con un precio. Solo si tiene
    // ficha — sin ella no se puede vender aquí, y una fila que lleva a «no
    // tienes nada» no dice qué falta.
    ...(proveedor
      ? [
          {
            href: '/barrio/mios',
            Icono: ShoppingBag,
            nombre: 'Mis productos',
            pista:
              misProductos.length > 0
                ? `${misProductos.length} publicado${misProductos.length === 1 ? '' : 's'}`
                : undefined,
          },
        ]
      : []),
    { href: '/perfil/disponibilidad', Icono: Clock, nombre: 'Cuándo y dónde atiendo' },
    { href: '/mis-solicitudes', Icono: ClipboardList, nombre: 'Mis solicitudes' },
    // Las dos vistas del módulo de emergencia. Solo salen si esa persona
    // tiene ese rol: son de quien OFRECE ayuda, que es otro papel que el de
    // prestar un servicio. Vivían tras unas pestañas que se retiraron al
    // llegar este menú, y sin estas dos filas se habrían quedado sin
    // ninguna puerta.
    ...(esOfertador
      ? [
          {
            href: '/registro?ver=respuestas',
            Icono: ClipboardList,
            nombre: 'Mis respuestas',
          },
          { href: '/registro', Icono: UserRound, nombre: 'Mi perfil de ayuda' },
        ]
      : []),
    {
      href: '/perfil/resenas',
      Icono: Star,
      nombre: 'Reseñas recibidas',
      pista: sinResponder > 0 ? `${sinResponder} sin responder` : undefined,
    },
    {
      href: '/perfil/verificaciones',
      Icono: BadgeCheck,
      nombre: 'Verificaciones',
      pista:
        verificacionesPendientes > 0
          ? `${verificacionesPendientes} pendiente${verificacionesPendientes === 1 ? '' : 's'}`
          : undefined,
    },
    {
      href: '/perfil/codigos',
      Icono: Hash,
      nombre: 'Códigos que generé',
      pista: sinUsar > 0 ? `${sinUsar} sin usar` : undefined,
    },
    { href: '/perfil/avisos', Icono: Bell, nombre: 'Avisos' },
    { href: '/perfil/privacidad', Icono: KeyRound, nombre: 'Privacidad y cuenta' },
    { href: '/servicios/soy-proveedor', Icono: IdCard, nombre: 'Mi ficha publicada' },
  ]


  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <CabeceraPantalla titulo="Perfil" />

      {proveedor ? (
        <section className="shadow-canto rounded-2xl bg-card p-4">
          <h2 className="font-heading text-2xl leading-tight">
            {proveedor.nombre_visible}
          </h2>
          <p className="mt-0.5 text-base text-muted-foreground">
            {[
              primerOficio?.nombre ?? (primerOficio ? GRUPOS[primerOficio.grupo] : null),
              proveedor.zona_texto,
              municipio ? nombreConDepartamento(municipio) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>

          <div className="mt-3">
            <InsigniasProveedor
              telefonoVerificado={proveedor.telefono_verificado}
              referenciasConfirmadas={proveedor.referencias_confirmadas}
              esMicroempresa={proveedor.tipo === 'microempresa'}
            />
          </div>

          {/* Los tres contadores del prototipo. Volumen primero y promedio
              después, y en ese orden a propósito: es la regla de producto 5
              — una sola reseña mala no puede hundir a quien vive de esto. */}
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {[
              {
                n: String(proveedor.servicios_confirmados),
                que:
                  proveedor.servicios_confirmados === 1
                    ? 'servicio confirmado'
                    : 'servicios confirmados',
              },
              {
                n: promedio ? promedio.nota.toLocaleString('es-CO') : '—',
                que: promedio
                  ? `promedio de ${promedio.cuantas}`
                  : 'sin calificaciones',
              },
              {
                n: String(sinUsar),
                que: sinUsar === 1 ? 'código sin usar' : 'códigos sin usar',
              },
            ].map((c) => (
              <div key={c.que} className="rounded-2xl bg-background p-3">
                <dt className="sr-only">{c.que}</dt>
                <dd>
                  <span className="font-heading block text-2xl leading-none">{c.n}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{c.que}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : (
        <section className="shadow-cartel-amarillo rounded-2xl bg-card p-4">
          <h2 className="font-heading text-xl leading-tight">
            Todavía no tienes carné de prestador
          </h2>
          <p className="mt-1 text-base text-muted-foreground">
            Con él apareces en el directorio y quien necesite tu trabajo te
            encuentra. Publicarlo no cuesta nada.
          </p>
          <Link
            href="/servicios/soy-proveedor"
            className="mt-3 inline-flex min-h-12 items-center rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground"
          >
            Armar mi carné
          </Link>
        </section>
      )}

      {/* ⚠ El color NO se declara fila por fila. Declarado a mano salían
          tres verdes seguidos y dos amarillos pegados, porque las filas
          que aparecen dependen de quién mire —hay dos que solo salen si
          tiene ficha y dos si ofrece ayuda— y a ojo no se puede prever qué
          queda junto a qué.

          Aquí se recorren los cuatro gajos de la sombrilla en orden,
          después de quitar las que no van. Así ninguna toca a otra de su
          color y la secuencia es la misma para todo el mundo.

          El color sigue sin significar nada por sí solo (regla 9): lo que
          dice qué es cada fila es su nombre, y la pista numérica va en
          palabras. */}
      <nav aria-label="Perfil" className="mt-6">
        <ul className="flex flex-col gap-2">
          {filas.map((fila, indice) => (
            <Fila key={fila.href} {...fila} familia={FAMILIAS[indice % FAMILIAS.length]} />
          ))}
        </ul>
      </nav>

      <div className="mt-6">
        <CerrarSesion />
      </div>
    </main>
  )
}
