import { Plus } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { AccionPrincipal } from '@/components/accion-principal'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { ListaMisPublicaciones } from './lista-mis-publicaciones'

export const metadata = { title: 'Mis publicaciones' }

/**
 * Lo mío en donaciones.
 *
 * ⚠ Esta pantalla **no existía**, y con ella no existía forma de ver ni de
 * borrar lo que uno había publicado: `publicaciones_muro` solo se INSERTABA.
 * No había procedimiento, ni RPC, ni fila en el perfil. La interfaz prometía
 * lo contrario en tres sitios —«puedes borrarlas cuando quieras», «la vas a
 * encontrar en tu perfil»— y la regla de producto 3 dice que una publicación
 * vive «mientras su dueño la deje». Su dueño no tenía cómo dejarla: la única
 * salida era borrar la cuenta entera.
 *
 * La publicación lleva el nombre de esa persona y la versión de la
 * autorización que firmó. Retirar el nombre era ejercicio de habeas data sin
 * más vía que la PQR.
 *
 * Es un destino y no un flujo —se entra a mirar lo suyo—, así que conserva la
 * barra de abajo y lleva la vuelta arriba.
 */
export default async function MisPublicacionesPage() {
  const mias = await servidor.comunidad.misPublicaciones()

  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Mis publicaciones" volver="/donaciones" />

      <p className="text-base text-muted-foreground">
        Lo que has puesto en donaciones, con tu nombre puesto.
      </p>

      <ListaMisPublicaciones publicaciones={mias} />

      <AccionPrincipal
        etiqueta="Publicar una donación"
        Icono={Plus}
        href="/donaciones/publicar"
      />
    </main>
  )
}
