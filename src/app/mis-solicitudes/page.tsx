import { Plus } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { AccionPrincipal } from '@/components/accion-principal'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { ListaMias } from './lista-mias'
import { ListaInsumos } from './lista-insumos'

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
 * ⚠ Y llevaba las dos mitades de la aplicación en el título y solo una en el
 * contenido: leía `misSolicitudes()` —servicios— y nunca `insumos.mias()`.
 * Publicar un insumo terminaba con un `router.push` A ESTA PANTALLA, donde
 * aterrizabas en «Todavía no has pedido ningún servicio». Los procedimientos
 * de insumos existían desde el ADR 0006 sin que nada los llamara.
 *
 * Las dos listas y no dos pestañas: son pocas, se leen juntas, y un
 * segmentado para dos cosas que no compiten es un nivel de navegación de más
 * (regla de interfaz 3).
 *
 * Sin sesión no rebota a `/login`: explica y ofrece entrar. Es la misma
 * regla que sigue `/perfil`.
 */
export default async function MisSolicitudesPage() {
  const [servicios, insumos] = await Promise.all([
    servidor.servicios.misSolicitudes(),
    servidor.insumos.mias(),
  ])

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      {/* El h1 repite la etiqueta de la fila del perfil (regla 8). */}
      <CabeceraPantalla titulo="Mis solicitudes" volver="/perfil" />

      <section>
        <h2 className="font-heading text-2xl">Servicios</h2>
        <p className="mt-1 text-base text-muted-foreground">
          Los que has pedido. Duran 15 días y se renuevan desde aquí.
        </p>
        <ListaMias solicitudes={servicios} />
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-2xl">Insumos</h2>
        <p className="mt-1 text-base text-muted-foreground">
          Lo que has pedido en el módulo de ayuda. Dura 72 horas.
        </p>
        <ListaInsumos solicitudes={insumos} />
      </section>

      <AccionPrincipal
        etiqueta="Pedir un servicio"
        Icono={Plus}
        href="/servicios/publicar"
      />
    </main>
  )
}
