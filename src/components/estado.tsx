import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Una pantalla o un hueco que no tiene contenido: vacío, error, sin
 * permiso, cargando.
 *
 * Una frase, una acción y nada más. Estaban escritos ocho veces, cada uno
 * con su redacción y su tamaño de icono, y algunos decían dos cosas a la
 * vez —«no hay nada» y además tres consejos—.
 *
 * ⚠ 404 y «sin permiso» dicen lo mismo a propósito: contestar «no tienes
 * permiso» revela que ese recurso existe, y con un token en la URL eso es
 * un oráculo.
 */
export function Estado({
  Icono,
  titulo,
  detalle,
  accion,
}: {
  Icono?: LucideIcon
  titulo: string
  detalle?: ReactNode
  accion?: ReactNode
}) {
  return (
    // `lista-escalonada` reparte 40 ms entre los hijos y ya existe: el
    // icono entra, el título detrás, el detalle después. Es de los pocos
    // sitios donde la entrada puede notarse — un vacío se ve poco y se lee
    // entero, al revés que una lista de veinte tarjetas.
    <div className="lista-escalonada rounded-2xl border border-dashed border-border p-8 text-center">
      {Icono && (
        <Icono
          className="animar-entrada mx-auto size-8 text-muted-foreground"
          aria-hidden="true"
        />
      )}
      <p className="animar-entrada mt-2 text-lg font-medium">{titulo}</p>
      {detalle && (
        <p className="animar-entrada mt-1 text-base text-muted-foreground">{detalle}</p>
      )}
      {accion && (
        <div className="animar-entrada mt-4 flex flex-wrap justify-center gap-2">
          {accion}
        </div>
      )}
    </div>
  )
}
