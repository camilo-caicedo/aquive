import { redirect } from 'next/navigation'
import { CircleDot } from 'lucide-react'
import { DIAS, etiquetaFranja } from '@/lib/servicios'
import type { DiaSemana } from '@/lib/types'
import { FormularioProveedor } from '@/app/servicios/soy-proveedor/formulario-proveedor'
import { cargarPerfil } from '../cargar'

export const metadata = { title: 'Cuándo y dónde atiendo' }

/**
 * Qué día es hoy en Colombia, en la clave que usa la ficha.
 *
 * Con la zona horaria escrita y no con la del servidor: Vercel corre en
 * UTC, y sin esto a partir de las 7 de la noche la cinta le diría a alguien
 * de Cali que ya es mañana.
 */
function diaDeHoy(): DiaSemana {
  const nombre = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    weekday: 'short',
  }).format(new Date())
  const orden: DiaSemana[] = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']
  const indice = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(nombre)
  return orden[indice === -1 ? 0 : indice]
}

/**
 * Pantalla 19 · Cuándo y dónde atiendo.
 *
 * Los días, las franjas, la modalidad y la zona, que antes vivían
 * repartidos entre dos plegables del formulario largo. La cinta de arriba
 * es lo único nuevo, y es lo que convierte una lista de casillas en un
 * dato: dice si hoy, ahora, apareces como disponible.
 *
 * ⚠ La cinta habla de franjas y no de una hora exacta porque la ficha
 * guarda franjas —mañana, tarde, noche— y no horarios. Inventar «hasta las
 * 5 p. m.» sería escribir en pantalla un dato que no existe.
 */
export default async function DisponibilidadPage() {
  const { proveedor, municipios, oficios, zonas } = await cargarPerfil()

  if (!proveedor) redirect('/servicios/soy-proveedor')

  const hoy = diaDeHoy()
  const nombreHoy = DIAS.find((d) => d.valor === hoy)?.etiqueta.toLowerCase() ?? ''
  const trabajaHoy = proveedor.dias.length === 0 || proveedor.dias.includes(hoy)
  const franjas = proveedor.franjas.map(etiquetaFranja).join(' y ').toLowerCase()

  return (
    <FormularioProveedor
      proveedor={proveedor}
      municipios={municipios}
      oficios={oficios}
      zonas={zonas}
      titulo="Cuándo y dónde atiendo"
      volver="/perfil"
      secciones={['disponibilidad', 'zonas']}
      encabezado={
        <>
          <div
            className={`flex items-start gap-3 rounded-2xl p-4 ${
              trabajaHoy ? 'bg-ok-suave text-foreground' : 'bg-muted text-foreground'
            }`}
          >
            <CircleDot className="size-5 shrink-0 translate-y-0.5" aria-hidden="true" />
            <p className="text-base">
              Hoy es {nombreHoy} y{' '}
              {trabajaHoy ? (
                <>
                  <span className="font-semibold">apareces como disponible</span>
                  {franjas ? ` en la ${franjas}.` : '.'}
                  {proveedor.dias.length === 0 &&
                    ' No marcaste ningún día, así que tu ficha no dice cuáles trabajas.'}
                </>
              ) : (
                <>
                  <span className="font-semibold">no apareces como disponible</span>: no
                  marcaste este día.
                </>
              )}
            </p>
          </div>

          <p className="text-base text-muted-foreground">
            La zona es lo más fino que se publica: comuna o barrio. Nunca una
            dirección.
          </p>
        </>
      }
    />
  )
}
