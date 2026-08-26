import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { PanelServiciosProveedor } from '@/components/panel-servicios-proveedor'
import { SOBRE_LAS_RESENAS } from '@/lib/honestidad'
import { cargarPerfil, promedioResenas } from '../cargar'

export const metadata = { title: 'Reseñas recibidas' }

/**
 * Pantalla 21 · Lo que dicen de tu trabajo.
 *
 * Los dos números, y en este orden: el volumen en grande y el promedio en
 * pequeño. Es la regla de producto 5 dibujada —«una sola reseña mala no
 * puede hundir a alguien que vive de esto»—, y la explicación va debajo
 * porque un número grande sin decir por qué es grande se lee como una nota.
 *
 * Esto vivía en `panel-servicios-proveedor.tsx` sin ninguno de los dos
 * números: solo la lista de reseñas.
 */
export default async function ResenasPage() {
  const { proveedor, servicios, misOficios } = await cargarPerfil()

  const promedio = promedioResenas(servicios.resenas)
  const confirmados = proveedor?.servicios_confirmados ?? 0

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <CabeceraPantalla titulo="Reseñas" volver="/perfil" />

      <section className="shadow-cartel-amarillo rounded-2xl bg-card p-4">
        <p className="font-heading text-5xl leading-none">{confirmados}</p>
        <p className="mt-1 text-lg">
          {confirmados === 1 ? 'servicio confirmado' : 'servicios confirmados'}
        </p>

        <p className="mt-3 text-base text-muted-foreground">
          {promedio
            ? `${promedio.cuantas} ${promedio.cuantas === 1 ? 'calificación' : 'calificaciones'} · promedio ${promedio.nota.toLocaleString('es-CO')} de 5`
            : 'Todavía nadie te ha calificado.'}
        </p>
      </section>

      <p className="mt-3 text-base text-muted-foreground">
        El número grande es cuántos trabajos se confirmaron con tu código, no la
        nota. Una sola reseña mala no hunde a quien vive de esto, y por eso lo
        que primero se ve en tu ficha es cuántas veces trabajaste.
      </p>

      <p className="mt-3 text-base text-muted-foreground">{SOBRE_LAS_RESENAS}</p>

      <div className="mt-6">
        <PanelServiciosProveedor
          datos={servicios}
          oficios={misOficios}
          mostrar="resenas"
        />
      </div>
    </main>
  )
}
