import {
  BadgeCheck,
  PhoneCall,
  HeartHandshake,
  Flag,
  Lightbulb,
  Building2,
  ClipboardList,
  Wrench,
  Users,
  ScrollText,
} from 'lucide-react'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { createClient } from '@/lib/supabase/server'
import type { IndiceAdmin } from '@/lib/types'
import { ColaTrabajo } from './cola-trabajo'

export const metadata = { title: 'Administración' }

/** Une trozos de detalle saltándose los que no aplican. */
function detalle(...partes: (string | null)[]) {
  const vivas = partes.filter(Boolean)
  return vivas.length > 0 ? vivas.join(' · ') : undefined
}

/**
 * El índice de administración.
 *
 * Nivel 2 de cuatro: la puerta es el escudo del encabezado, esto es el
 * índice, cada cola tiene su ruta y el caso vive dentro de la cola.
 *
 * ⚠ La comprobación de administrador NO está aquí: vive en el layout del
 * segmento, para que las nueve rutas la compartan y ninguna se quede sin
 * ella.
 */
export default async function AdminPage() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('panel_admin_indice')
  const n = data as unknown as IndiceAdmin | null

  const v = (x: number | undefined) => x ?? 0
  // El número del encabezado es la suma del primer grupo y nada más: es
  // cuánta gente está esperando, no cuánto trabajo hay.
  const esperando =
    v(n?.matriculas) + v(n?.telefonos) + v(n?.hilos_sin_fundacion) + v(n?.reportes)

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Administración" volver="/">
        <p className="mt-1 text-base text-muted-foreground">
          {esperando === 0
            ? 'Nada esperando a nadie'
            : `${esperando} ${esperando === 1 ? 'cosa' : 'cosas'} por atender`}
        </p>
      </CabeceraPantalla>

      <ColaTrabajo
        grupos={[
          {
            titulo: 'Esperando a alguien',
            colas: [
              {
                href: '/admin/matriculas',
                Icono: BadgeCheck,
                etiqueta: 'Matrículas por verificar',
                detalle: 'Comprobar el número en el registro de la entidad',
                cuantas: v(n?.matriculas),
                gajo: 'azul',
                espera: true,
              },
              {
                href: '/admin/servicios',
                Icono: PhoneCall,
                etiqueta: 'Teléfonos por verificar',
                detalle: 'Llamar y confirmar que contesta esa persona',
                cuantas: v(n?.telefonos),
                gajo: 'amarillo',
                espera: true,
              },
              {
                href: '/admin/aliados',
                Icono: HeartHandshake,
                etiqueta: 'Hilos sin fundación',
                detalle: 'Dos personas esperando a que alguien decida',
                cuantas: v(n?.hilos_sin_fundacion),
                gajo: 'rojo',
                espera: true,
              },
              {
                href: '/admin/reportes',
                Icono: Flag,
                etiqueta: 'Reportes',
                detalle: 'Contenido que alguien marcó como problemático',
                cuantas: v(n?.reportes),
                gajo: 'verde',
                espera: true,
              },
            ],
          },
          {
            titulo: 'Contenido',
            colas: [
              {
                href: '/admin/catalogo',
                Icono: Lightbulb,
                etiqueta: 'Catálogo',
                detalle: detalle(
                  `${v(n?.sugerencias)} ${v(n?.sugerencias) === 1 ? 'ítem sugerido' : 'ítems sugeridos'}`,
                  `${v(n?.items_activos)} en uso`
                ),
                cuantas: v(n?.sugerencias),
              },
              {
                href: '/admin/directorio',
                Icono: Building2,
                etiqueta: 'Directorio',
                detalle: detalle(
                  `${v(n?.entidades)} ${v(n?.entidades) === 1 ? 'entidad' : 'entidades'}`,
                  v(n?.entidades_retiradas) > 0
                    ? `${v(n?.entidades_retiradas)} ${v(n?.entidades_retiradas) === 1 ? 'retirada' : 'retiradas'}`
                    : null
                ),
              },
              {
                href: '/admin/solicitudes',
                Icono: ClipboardList,
                etiqueta: 'Solicitudes vivas',
                detalle: detalle(
                  `${v(n?.solicitudes_abiertas)} abiertas`,
                  `${v(n?.solicitudes_sin_respuestas)} sin respuestas`
                ),
              },
              {
                href: '/admin/servicios',
                Icono: Wrench,
                etiqueta: 'Servicios',
                detalle: detalle(
                  `${v(n?.resenas_ocultas)} ${v(n?.resenas_ocultas) === 1 ? 'calificación oculta' : 'calificaciones ocultas'}`,
                  `${v(n?.zonas_pendientes)} ${v(n?.zonas_pendientes) === 1 ? 'zona' : 'zonas'}`
                ),
                cuantas: v(n?.resenas_ocultas) + v(n?.zonas_pendientes),
              },
            ],
          },
          {
            titulo: 'Organizaciones',
            colas: [
              {
                href: '/admin/aliados',
                Icono: Users,
                etiqueta: 'Aliados',
                detalle: detalle(
                  `${v(n?.organizaciones)} ${v(n?.organizaciones) === 1 ? 'organización' : 'organizaciones'}`,
                  v(n?.organizaciones_inactivas) > 0
                    ? `${v(n?.organizaciones_inactivas)} inactiva`
                    : null
                ),
              },
              {
                href: '/admin/bitacora',
                Icono: ScrollText,
                etiqueta: 'Bitácora',
                detalle: 'Quién vio identidades y referencias',
              },
            ],
          },
        ]}
      />

      {/* Un aviso corto al pie y no encima de las colas (regla 1): lo
          primero de la pantalla tiene que ser un dato real, no un párrafo.
          Dice la diferencia que más se confunde aquí: esconder no es
          borrar. */}
      <p className="mt-6 rounded-2xl bg-accent p-4 text-base leading-relaxed text-accent-foreground">
        Ocultar una calificación es moderación reversible. Un reporte por
        extorsión termina en borrado de verdad, y de eso no hay vuelta.
      </p>
    </main>
  )
}
