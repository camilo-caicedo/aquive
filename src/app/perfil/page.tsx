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
import { listarMunicipios, nombreConDepartamento } from '@/lib/municipios'
import { CINTA, TINTA_CINTA, type Familia } from '@/lib/familias'
import { GRUPOS } from '@/lib/servicios'
import type { MiProveedor } from '@/lib/types'
import type { MisServicios } from '@/components/panel-servicios-proveedor'
import type { MiReferencia } from '@/components/campos-referencia'
import { codigosSinUsar, promedioResenas } from './cargar'

export const metadata = { title: 'Perfil' }

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

      <nav aria-label="Perfil" className="mt-6">
        <ul className="flex flex-col gap-2">
          <Fila
            href="/perfil/datos"
            Icono={UserPen}
            nombre="Mis datos y contacto"
            familia="azul"
          />
          <Fila
            href="/perfil/oficios"
            Icono={ListOrdered}
            nombre="Mis oficios y precios"
            pista={proveedor ? String(proveedor.oficios.length) : undefined}
            familia="amarillo"
          />
          <Fila
            href="/perfil/disponibilidad"
            Icono={Clock}
            nombre="Cuándo y dónde atiendo"
            familia="verde"
          />
          <Fila
            href="/mis-solicitudes"
            Icono={ClipboardList}
            nombre="Mis solicitudes"
            familia="azul"
          />
          {/* Las dos vistas del módulo de emergencia. Solo salen si esa
              persona tiene ese rol: son de quien OFRECE ayuda, que es otro
              papel que el de prestar un servicio. Vivían tras unas pestañas
              que se retiraron al llegar este menú, y sin estas dos filas se
              habrían quedado sin ninguna puerta. */}
          {esOfertador && (
            <>
              <Fila
                href="/registro?ver=respuestas"
                Icono={ClipboardList}
                nombre="Mis respuestas"
                familia="verde"
              />
              <Fila
                href="/registro"
                Icono={UserRound}
                nombre="Mi perfil de ayuda"
                familia="verde"
              />
            </>
          )}
          <Fila
            href="/perfil/resenas"
            Icono={Star}
            nombre="Reseñas recibidas"
            pista={sinResponder > 0 ? `${sinResponder} sin responder` : undefined}
            familia="amarillo"
          />
          <Fila
            href="/perfil/verificaciones"
            Icono={BadgeCheck}
            nombre="Verificaciones"
            pista={
              verificacionesPendientes > 0
                ? `${verificacionesPendientes} pendiente${verificacionesPendientes === 1 ? '' : 's'}`
                : undefined
            }
            familia="verde"
          />
          <Fila
            href="/perfil/codigos"
            Icono={Hash}
            nombre="Códigos que generé"
            pista={sinUsar > 0 ? `${sinUsar} sin usar` : undefined}
            familia="rojo"
          />
          <Fila href="/perfil/avisos" Icono={Bell} nombre="Avisos" familia="azul" />
          <Fila
            href="/perfil/privacidad"
            Icono={KeyRound}
            nombre="Privacidad y cuenta"
            familia="rojo"
          />
          <Fila
            href="/servicios/soy-proveedor"
            Icono={IdCard}
            nombre="Mi ficha publicada"
            familia="amarillo"
          />
        </ul>
      </nav>

      <div className="mt-6">
        <CerrarSesion />
      </div>
    </main>
  )
}
