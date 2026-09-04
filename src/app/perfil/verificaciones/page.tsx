import Link from 'next/link'
import { BadgeCheck, Hash, IdCard, PhoneCall, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { CamposReferencia } from '@/components/campos-referencia'
import { SOBRE_LAS_INSIGNIAS } from '@/lib/honestidad'
import { ENTIDADES_MATRICULA, RESPONSABLE_SERVICIOS } from '@/lib/config'
import { CINTA, SOMBRA_CARTEL, TINTA_CINTA, type Familia } from '@/lib/familias'
import { cargarPerfil } from '../cargar'
import { SinCarne } from '../sin-carne'

export const metadata = { title: 'Verificaciones' }

/**
 * Una de las cuatro señales: qué es, en qué va y qué se puede hacer.
 *
 * El estado va en palabras dentro del sello —«Hecho», «1 de 2», «No
 * aplica»— y no como un punto de color: la regla 9 no admite que el estado
 * dependa de percibir un color, y aquí el público incluye a alguien mirando
 * un teléfono viejo a pleno sol.
 */
function Tarjeta({
  Icono,
  nombre,
  dice,
  estado,
  familia,
  accion,
}: {
  Icono: LucideIcon
  nombre: string
  dice: string
  estado: string
  familia: Familia
  accion?: { texto: string; href: string }
}) {
  return (
    <li className={`rounded-2xl bg-card p-4 ${SOMBRA_CARTEL[familia]}`}>
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${CINTA[familia]} ${TINTA_CINTA[familia]}`}
        >
          <Icono className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-xl leading-tight">{nombre}</h2>
          <p className="mt-1 text-base text-muted-foreground">{dice}</p>
        </div>
        <span className="font-heading shrink-0 rounded-full bg-secondary px-3 py-1 text-xs tracking-[0.085em] text-secondary-foreground uppercase">
          {estado}
        </span>
      </div>

      {accion && (
        <Link
          href={accion.href}
          className="pulsable shadow-canto mt-3 inline-flex min-h-12 items-center rounded-full bg-card px-4 text-base font-semibold text-enlace"
        >
          {accion.texto}
        </Link>
      )}
    </li>
  )
}

/**
 * Pantalla 22 · Qué tienes comprobado.
 *
 * ⚠ Esta pantalla no existía en ninguna parte. Las cuatro señales estaban
 * repartidas: las referencias en el formulario de la ficha, los servicios
 * confirmados solo en la ficha PÚBLICA, y el teléfono y la matrícula
 * únicamente del lado del administrador. Quien trabaja no tenía dónde ver
 * en qué iba lo suyo.
 *
 * Arriba va `SOBRE_LAS_INSIGNIAS` entero, que es lo que dice que ninguna
 * de las cuatro significa «confiable». Sin eso, una pantalla que agrupa
 * cuatro sellos se lee como un examen aprobado.
 */
export default async function VerificacionesPage() {
  const { supabase, user, proveedor, referencias, oficios } = await cargarPerfil()

  if (!proveedor) {
    return (
      <SinCarne
        titulo="Verificaciones"
        porque="Las señales que se comprueban —tu teléfono y tus referencias— son de la ficha. Sin ficha no hay nada que comprobar todavía."
      />
    )
  }

  const { data: servidor } = await supabase
    .from('servidores')
    .select('*')
    .eq('perfil_id', user.id)
    .maybeSingle()

  const confirmadas = referencias.filter((r) => r.estado === 'confirmada').length
  // ⚠ Una referencia rechazada o que no contesta se le enseñaba igual que
  // una pendiente: solo se contaban las confirmadas, así que quien esperaba
  // seguía esperando algo que ya se había decidido. Se dicen aparte.
  const cerradas = referencias.filter(
    (r) => r.estado === 'rechazada' || r.estado === 'no_contesta',
  ).length
  const entidad = servidor
    ? (ENTIDADES_MATRICULA.find((e) => e.valor === servidor.entidad_matricula)?.etiqueta ??
      servidor.entidad_matricula)
    : null

  return (
    <main className="animar-pantalla mx-auto max-w-lg px-4 py-6">
      <CabeceraPantalla titulo="Verificaciones" volver="/perfil" />

      <p className="text-base text-muted-foreground">
        Ninguna de estas señales dice que seas confiable, y tu ficha lo aclara.
        Lo que hacen es dar algo concreto que mirar.
      </p>

      <p className="mt-3 text-base text-muted-foreground">{SOBRE_LAS_INSIGNIAS}</p>

      <ul className="mt-4 space-y-3">
        <Tarjeta
          Icono={PhoneCall}
          nombre="Teléfono"
          dice={
            proveedor.telefono_verificado
              ? `Alguien de ${RESPONSABLE_SERVICIOS} llamó a tu número y contestaste tú. No hay SMS automático.`
              : `Alguien de ${RESPONSABLE_SERVICIOS} va a llamar a tu número para confirmar que contestas tú. No hay SMS automático, así que no llega ningún código.`
          }
          estado={proveedor.telefono_verificado ? 'Hecho' : 'En cola'}
          familia={proveedor.telefono_verificado ? 'verde' : 'amarillo'}
          accion={
            proveedor.telefono_verificado
              ? undefined
              : { texto: 'Revisar mi número', href: '/perfil/datos' }
          }
        />

        <Tarjeta
          Icono={Users}
          nombre="Referencias"
          dice={
            referencias.length === 0
              ? 'Es el contacto de un cliente al que ya le trabajaste. La fundación lo llama una vez. Ese dato queda cifrado y no aparece en tu ficha.'
              : `Diste ${referencias.length} ${referencias.length === 1 ? 'contacto' : 'contactos'} de clientes anteriores. ${confirmadas === 0 ? 'Todavía no hemos podido confirmar ninguno.' : `${confirmadas === 1 ? 'Uno confirmó' : `${confirmadas} confirmaron`} que les prestaste el servicio.`}${cerradas > 0 ? ` ${cerradas === 1 ? 'Uno no' : `${cerradas} no`} se pudo confirmar: puedes dar otro contacto.` : ''}`
          }
          estado={
            referencias.length === 0
              ? 'Sin dar'
              : `${confirmadas} de ${referencias.length}`
          }
          familia={confirmadas > 0 ? 'verde' : 'amarillo'}
        />

        <Tarjeta
          Icono={Hash}
          nombre="Servicios confirmados"
          dice={
            proveedor.servicios_confirmados === 0
              ? 'Cuántas personas usaron el código que les diste al terminar. Es lo único que no depende de nosotros.'
              : `${proveedor.servicios_confirmados} ${proveedor.servicios_confirmados === 1 ? 'persona usó' : 'personas usaron'} el código que les diste al terminar. Es lo único que no depende de nosotros.`
          }
          estado={String(proveedor.servicios_confirmados)}
          familia={proveedor.servicios_confirmados > 0 ? 'verde' : 'azul'}
          accion={{ texto: 'Dar un código', href: '/perfil/codigos' }}
        />

        <Tarjeta
          Icono={servidor?.verificado ? BadgeCheck : IdCard}
          nombre="Matrícula profesional"
          dice={
            servidor
              ? servidor.verificado
                ? `Una persona revisó que tu número de ${entidad} aparece en el registro. Eso es todo lo que dice el sello: que el número existe.`
                : servidor.numero_matricula
                  ? `Registraste tu matrícula de ${entidad}. Una persona la revisa a mano contra el registro de la entidad.`
                  : 'Ya declaraste tu profesión. Si tienes matrícula de una entidad con registro consultable, agrégala aquí abajo.'
              : 'Si tienes matrícula de una entidad con registro consultable —COPNIA, CPNAA, COLPSIC, ReTHUS o SIRNA— una persona revisa que el número exista. Los oficios del directorio no la piden.'
          }
          estado={
            !servidor
              ? 'No aplica'
              : servidor.verificado
                ? 'Hecho'
                : servidor.numero_matricula
                  ? 'En cola'
                  : 'Falta agregarla'
          }
          familia={servidor?.verificado ? 'verde' : servidor ? 'amarillo' : 'azul'}
          accion={
            servidor?.verificado
              ? undefined
              : {
                  texto: servidor ? 'Corregir mi matrícula' : 'Tengo matrícula',
                  href: '/perfil/matricula',
                }
          }
        />
      </ul>

      {/* Aquí y no en el formulario de la ficha: una referencia es una de
          las cuatro señales, y este es el sitio donde alguien viene a ver
          por qué le falta una. */}
      <div className="mt-8">
        <CamposReferencia referencias={referencias} oficios={oficios} />
      </div>
    </main>
  )
}
