import Link from 'next/link'
import { Plus } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { AccionPrincipal } from '@/components/accion-principal'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { ListaMios } from './lista-mios'

export const metadata = { title: 'Lo que vendo' }

/**
 * Lo mío en «Hecho en el barrio».
 *
 * ⚠ Sin ficha de prestador no hay nada que enseñar, y se dice por qué en vez
 * de rebotar a `/login`: quien llega aquí ya está dentro, lo que le falta es
 * la ficha, y echarlo a una pantalla de acceso no se lo explica.
 *
 * Es un destino y no un flujo —se entra a mirar lo suyo—, así que conserva la
 * barra de abajo y lleva la vuelta arriba.
 */
export default async function MisProductosPage() {
  const mios = await servidor.comunidad.misProductos()

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Lo que vendo" volver="/barrio" />

      <p className="text-base text-muted-foreground">
        Lo que tienes puesto en Productos. Aparece con tu nombre y con el
        contacto de tu ficha.
      </p>

      <ListaMios productos={mios} />

      {mios.length === 0 && (
        <p className="mt-4 text-base text-muted-foreground">
          Para vender aquí hace falta tener tu ficha publicada: es la que lleva
          tu nombre y por donde te escriben.{' '}
          <Link
            href="/servicios/soy-proveedor"
            className="text-enlace underline underline-offset-4"
          >
            Ármala
          </Link>
          .
        </p>
      )}

      <AccionPrincipal etiqueta="Vender algo" Icono={Plus} href="/barrio/publicar" />
    </main>
  )
}
