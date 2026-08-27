import { Plus } from 'lucide-react'

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
 * Sin sesión no rebota a `/login`: explica y ofrece entrar. Es la misma
 * regla que sigue `/perfil`.
 */
export default async function MisSolicitudesPage() {
  const solicitudes = await servidor.servicios.misSolicitudes()

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      {/* El h1 repite la etiqueta de la fila del perfil (regla 8). */}
      <CabeceraPantalla titulo="Mis solicitudes" volver="/perfil" />

      <p className="text-base text-muted-foreground">
        Los servicios que has pedido. Duran 15 días y se renuevan desde aquí.
      </p>

      <ListaMias solicitudes={solicitudes} />

      <AccionPrincipal
        etiqueta="Pedir un servicio"
        Icono={Plus}
        href="/servicios/publicar"
      />
    </main>
  )
}
