import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { MarcoFlujo } from '@/components/marco-flujo'
import { BorrarPerfil } from './borrar-perfil'
import { servidor } from '@/orpc/local'
import {
  AUTORIZACION_PROVEEDOR_VERSION,
  CONSENTIMIENTO_REFERENCIA_VERSION,
  CORREO_HABEAS_DATA_SERVICIOS,
  RESPONSABLE_SERVICIOS,
} from '@/lib/config'
import { SOMBRA_CARTEL, type Familia } from '@/lib/familias'
import { cargarPerfil } from '../cargar'
import { BorrarFicha } from './borrar-ficha'

export const metadata = { title: 'Privacidad y cuenta' }

const fecha = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(new Date(iso))

/**
 * Pantalla 25 · Privacidad y cuenta.
 *
 * Tres bloques. El tercero —borrar— era el único que existía, en la
 * pestaña «Ajustes» de `/registro`. Los otros dos son lo que convierte el
 * habeas data en algo que se puede mirar: qué hay tuyo aquí y cuánto vive
 * cada cosa, y qué autorizaste, con su versión y su fecha.
 */
export default async function PrivacidadPage() {
  const { supabase, user, proveedor, referencias } = await cargarPerfil()

  const [{ data: perfil }, ubicacion] = await Promise.all([
    supabase
      .from('perfiles')
      .select('acepto_publicacion, acepto_politica_at')
      .eq('id', user.id)
      .maybeSingle(),
    proveedor ? servidor.servicios.miUbicacion() : Promise.resolve(null),
  ])

  const primeraReferencia = referencias
    .map((r) => r.creada_at)
    .sort()[0]

  const datos: { que: string; vida: string; familia: Familia }[] = [
    ...(proveedor
      ? [
          {
            que: 'Tu ficha del directorio',
            vida: 'Permanente. Se va cuando tú la borras, no sola.',
            familia: 'amarillo' as const,
          },
        ]
      : []),
    ...(perfil
      ? [
          {
            que: 'Tu cuenta',
            vida: 'Permanente. Se va cuando la borras.',
            familia: 'azul' as const,
          },
        ]
      : []),
    {
      que: 'Tus solicitudes de servicio',
      vida: '15 días, renovables. Después se borran de verdad.',
      familia: 'verde',
    },
    {
      que: 'Tus conversaciones',
      vida: 'Mueren con el pedido o la entrega que las abrió. No hay bandeja histórica.',
      familia: 'azul',
    },
    {
      que: 'Tus referencias',
      vida: 'Cifradas. Nunca aparecen en una vista pública, y se van con tu ficha.',
      familia: 'rojo',
    },
    {
      que: 'Tus códigos de servicio',
      vida: 'El que nadie use muere a los 30 días.',
      familia: 'amarillo',
    },
    {
      que: 'Tu correo',
      vida: 'No lo guardamos. De tu cuenta solo queda un identificador interno.',
      familia: 'verde',
    },
  ]

  const autorizaciones: { nombre: string; version: string; cuando: string }[] = [
    ...(proveedor
      ? [
          {
            nombre: 'Publicar mi nombre, teléfono y oficios',
            // La versión y la fecha que ESTA persona aceptó, no las de hoy.
            // Antes se leían de una constante y del `creado_at`, que es
            // parecido pero no es lo mismo: si alguien pregunta qué autorizó,
            // la respuesta tiene que ser su fila.
            version: proveedor.autorizacion_version ?? AUTORIZACION_PROVEEDOR_VERSION,
            cuando: proveedor.autorizacion_at
              ? `Aceptada el ${fecha(proveedor.autorizacion_at)}`
              : `Tu ficha está publicada desde el ${fecha(proveedor.creado_at)}`,
          },
        ]
      : []),
    ...(ubicacion?.acepto
      ? [
          {
            nombre: 'Aparecer en el mapa con un punto',
            version: proveedor?.mapa_version ?? 'mapa-v1',
            cuando: proveedor?.mapa_at
              ? `Aceptada el ${fecha(proveedor.mapa_at)}. Puedes quitarte del mapa sin borrar la ficha.`
              : 'Aceptada. Puedes quitarte del mapa sin borrar la ficha.',
          },
        ]
      : []),
    ...(primeraReferencia
      ? [
          {
            nombre: 'Entregar contactos de referencia',
            version: CONSENTIMIENTO_REFERENCIA_VERSION,
            cuando: `Aceptada el ${fecha(primeraReferencia)}`,
          },
        ]
      : []),
    ...(perfil?.acepto_publicacion
      ? [
          {
            nombre: 'Publicar mi ficha de profesional con matrícula',
            version: 'perfil',
            cuando: `Aceptada el ${fecha(perfil.acepto_politica_at)}`,
          },
        ]
      : []),
  ]

  return (
    <MarcoFlujo titulo="Privacidad y cuenta" volver="/perfil">
      <section>
        <h2 className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
          Qué hay tuyo aquí
        </h2>
        <ul className="mt-2 space-y-2">
          {datos.map((d) => (
            <li key={d.que} className={`rounded-2xl bg-card p-4 ${SOMBRA_CARTEL[d.familia]}`}>
              <p className="text-base font-semibold">{d.que}</p>
              <p className="mt-0.5 text-base text-muted-foreground">{d.vida}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
          Autorizaciones que diste
        </h2>

        {autorizaciones.length === 0 ? (
          <p className="mt-2 text-base text-muted-foreground">
            Todavía no has autorizado publicar nada tuyo.
          </p>
        ) : (
          <ul className="shadow-canto mt-2 divide-y divide-border rounded-2xl bg-card">
            {autorizaciones.map((a) => (
              <li key={a.nombre} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 text-base font-medium">{a.nombre}</span>
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 font-mono text-sm text-secondary-foreground">
                    {a.version}
                  </span>
                </div>
                <p className="mt-0.5 text-base text-muted-foreground">{a.cuando}</p>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-2 text-base text-muted-foreground">
          Puedes retirar cualquiera de estas autorizaciones borrando lo que
          cubre. Para consultar, corregir o pedir supresión también puedes
          escribir a {CORREO_HABEAS_DATA_SERVICIOS}, y {RESPONSABLE_SERVICIOS}{' '}
          responde: 10 días hábiles una consulta, 15 un reclamo.
        </p>
      </section>

      {proveedor && (
        <section className="shadow-cartel-amarillo mt-8 rounded-2xl bg-card p-4">
          <h2 className="font-heading text-xl leading-tight">
            Borrar mi ficha del directorio
          </h2>
          <p className="mt-1 text-base text-muted-foreground">
            Sin borrar tu cuenta. Son dos cosas distintas.
          </p>
          <p className="mt-3 text-base">
            Se van tu ficha, tus oficios, tus referencias cifradas y las
            calificaciones que te escribieron. Es borrado real: no queda una
            copia esperando.
          </p>
          <div className="mt-3">
            <BorrarFicha />
          </div>
        </section>
      )}

      {/* Papel con la sombra desplazada en rojo pastel, como la pantalla 25
          del prototipo: la identidad la carga el cartel, no un contorno ni
          la letra en rojo —que sobre crema es justo lo que la paleta no
          aguanta—. */}
      <section className="shadow-cartel-rojo mt-4 rounded-2xl bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="bg-familia-rojo flex size-10 shrink-0 items-center justify-center rounded-full text-foreground">
            <Trash2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-xl leading-tight">
              Borrar mi cuenta y mis datos
            </h2>
            <p className="text-base text-muted-foreground">
              Inmediato y no se puede deshacer.
            </p>
          </div>
        </div>

        <p className="mt-3 text-base">
          Se borra tu perfil, tu matrícula y todas las respuestas que hayas
          enviado. También tu cuenta: no queda nada tuyo, ni el identificador de
          Google. Si alguien estaba esperando tu respuesta, dejará de verla.
        </p>

        <p className="mt-3 text-base text-muted-foreground">
          Queda una fila sin nombre en las métricas: qué categoría se pidió y en
          qué municipio. Nada más.
        </p>

        <div className="mt-3">
          <BorrarPerfil tienePerfil={!!perfil} />
        </div>

        <p className="mt-3 text-base text-muted-foreground">
          Ver también el{' '}
          <Link href="/privacidad" className="text-enlace underline">
            aviso de privacidad
          </Link>
          .
        </p>
      </section>
    </MarcoFlujo>
  )
}
