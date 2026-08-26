import { BadgeCheck, Store, Users } from 'lucide-react'

/**
 * Las insignias de una ficha del directorio.
 *
 * Ninguna dice «confiable» y ninguna es una recomendación. Cada una
 * nombra un hecho comprobable y la ficha explica al lado qué NO significa
 * (`SOBRE_LAS_INSIGNIAS` en honestidad.ts).
 *
 * `Sin verificar` se pinta y no se omite, con el mismo peso visual que el
 * resto: un perfil sin insignias tiene que leerse como «nadie lo revisó»,
 * no como «no aplica». Mismo criterio que la matrícula en /servidores.
 */
export function InsigniasProveedor({
  telefonoVerificado,
  referenciasConfirmadas,
  esMicroempresa,
  serviciosConfirmados,
  mostrar = 'todas',
}: {
  telefonoVerificado: boolean
  referenciasConfirmadas: number
  esMicroempresa: boolean
  serviciosConfirmados?: number
  /**
   * Qué parte pintar. La tarjeta del directorio pone el sello del
   * teléfono en la línea del nombre —es lo primero que se mira al
   * comparar dos fichas— y el resto abajo, con los precios.
   */
  mostrar?: 'todas' | 'telefono' | 'resto'
}) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {mostrar !== 'resto' &&
        (telefonoVerificado ? (
        <li className="inline-flex items-center gap-1.5 rounded-full border border-ok/30 bg-ok-suave px-2.5 py-0.5 text-sm font-medium text-foreground">
          <BadgeCheck className="size-4 shrink-0" aria-hidden="true" />
          Teléfono verificado
        </li>
      ) : (
        <li className="inline-flex items-center gap-1.5 rounded-full border border-enlace/25 bg-accent px-2.5 py-0.5 text-sm font-medium text-accent-foreground">
          <span aria-hidden="true">!</span> Sin verificar
        </li>
      ))}

      {mostrar !== 'telefono' && referenciasConfirmadas > 0 && (
        <li className="inline-flex items-center gap-1.5 rounded-full border border-ok/30 bg-ok-suave px-2.5 py-0.5 text-sm font-medium text-foreground">
          <Users className="size-4 shrink-0" aria-hidden="true" />
          {referenciasConfirmadas === 1
            ? '1 referencia'
            : `${referenciasConfirmadas} referencias`}
        </li>
      )}

      {mostrar !== 'telefono' && esMicroempresa && (
        <li className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-sm">
          <Store className="size-4 shrink-0" aria-hidden="true" />
          Negocio registrado
        </li>
      )}

      {/* Volumen antes que promedio (§6 del documento fuente): el número
          de servicios va con las insignias y la nota promedio se queda
          abajo, en pequeño. Al revés, una sola reseña mala hunde a
          alguien que vive de esto. */}
      {mostrar !== 'telefono' && serviciosConfirmados != null && serviciosConfirmados > 0 && (
        <li className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-sm">
          {serviciosConfirmados === 1
            ? '1 servicio confirmado'
            : `${serviciosConfirmados} servicios confirmados`}
        </li>
      )}
    </ul>
  )
}
