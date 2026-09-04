import { Search } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { AccionPrincipal } from '@/components/accion-principal'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { ListaMias } from './lista-mias'

export const metadata = { title: 'Mis solicitudes' }

/**
 * Lo que he pedido. Pantalla 20.
 *
 * ⚠ Antes esto leía de `localStorage` la lista de tokens de este teléfono,
 * con un aviso en tarjeta que decía que si cambiabas de aparato lo perdías
 * todo. Desde el ADR 0006 lo suyo cuelga de la cuenta y se le pregunta al
 * servidor: el aviso sobra y el fallo que el README tenía abierto —la lista
 * que no siempre aparecía— desaparece con él.
 *
 * ⚠ Llevaba también una sección de Insumos, retirada por el ADR 0014 con el
 * módulo entero: ya no hay solicitud de insumos que pedir ni mostrar aquí.
 *
 * ⚠ ADR 0015: la solicitud es ahora una orden dirigida a un prestador. Ya
 * no se puede «pedir un servicio» sin más —hay que elegir a quién—, así que
 * la acción principal deja de llevar a un formulario y lleva a buscar: es
 * el mismo recorrido que ya usa esta aplicación (buscar → ficha → pedir).
 *
 * Sin sesión no rebota a `/login`: explica y ofrece entrar. Es la misma
 * regla que sigue `/perfil`.
 */
export default async function MisSolicitudesPage() {
  const servicios = await servidor.servicios.misSolicitudes()

  return (
    <main className="animar-pantalla mx-auto max-w-lg px-4 py-6">
      {/* El h1 repite la etiqueta de la fila del perfil (regla 8). */}
      <CabeceraPantalla titulo="Mis solicitudes" volver="/perfil" />

      <section>
        <h2 className="font-heading text-2xl">Servicios</h2>
        <p className="mt-1 text-base text-muted-foreground">
          Las que le pediste a un prestador. Solo caducan mientras nadie ha
          respondido: se borran solas a los 15 días y se renuevan desde aquí.
        </p>
        <ListaMias solicitudes={servicios} />
      </section>

      <AccionPrincipal etiqueta="Buscar prestador" Icono={Search} href="/categorias" />
    </main>
  )
}
