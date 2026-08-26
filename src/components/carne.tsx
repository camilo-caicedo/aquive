import { InsigniasProveedor } from '@/components/insignias-proveedor'
import { CINTA, SOMBRA_CARTEL, TINTA_CINTA, familiaDe } from '@/lib/familias'
import { GRUPOS } from '@/lib/servicios'
import type { GrupoOficio } from '@/lib/types'

/**
 * El identificador del carné.
 *
 * Se deriva del `uuid` que la ficha ya tiene: sin columna nueva, sin migración
 * y estable para siempre. Y NO es correlativo a propósito — un `SR-000247`
 * publica cuánta gente hay registrada, que no es asunto de quien mira una
 * ficha, y deja un hueco visible cada vez que alguien se borra.
 */
export function idCarne(id: string): string {
  return `SR-${id.replaceAll('-', '').slice(0, 6).toUpperCase()}`
}

/**
 * El carné del prestador. Pantallas 04, 14, 15 y 16 del prototipo.
 *
 * Es la misma pieza en los cuatro sitios a propósito: quien acaba de darse de
 * alta ve exactamente lo que verá publicado, y quien mira su perfil reconoce
 * lo que ya vio. Un carné que se dibuja distinto en cada pantalla deja de
 * funcionar como identificación.
 *
 * El sello dice la verdad y no adorna: sin teléfono verificado se lee «Sin
 * verificar» sobre aviso, no un espacio en blanco. Regla de producto 6 —nada
 * nace verificado— y regla de interfaz 9: el estado nunca depende solo del
 * color.
 */
export function Carne({
  id,
  nombre,
  municipio,
  grupo,
  telefonoVerificado,
  referenciasConfirmadas = 0,
  serviciosConfirmados = 0,
  esMicroempresa = false,
}: {
  id: string
  nombre: string
  /** «Cali, Valle del Cauca». Nunca más fino que el municipio. */
  municipio: string | null
  /** El grupo del primer oficio: da el color de familia. */
  grupo: string | null
  telefonoVerificado: boolean
  referenciasConfirmadas?: number
  serviciosConfirmados?: number
  esMicroempresa?: boolean
}) {
  const familia = familiaDe(grupo)
  const etiquetaGrupo = grupo ? (GRUPOS[grupo as GrupoOficio] ?? null) : null

  return (
    <div className={`overflow-hidden rounded-2xl bg-card ${SOMBRA_CARTEL[familia]}`}>
      <div
        className={`flex items-center justify-between gap-2 px-4 py-2 ${CINTA[familia]} ${TINTA_CINTA[familia]}`}
      >
        <span className="font-heading text-xs tracking-[0.085em] uppercase">
          Carné de prestador
        </span>
        {/* Monoespaciada, como todos los códigos del sitio: se lee en voz alta
            por teléfono sin confundir un cero con una O. */}
        <span className="font-mono text-sm font-medium">{idCarne(id)}</span>
      </div>

      <div className="p-4">
        <p className="font-heading text-xl leading-tight">{nombre}</p>
        {municipio && (
          <p className="mt-0.5 text-base text-muted-foreground">{municipio}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {telefonoVerificado ? (
            <InsigniasProveedor
              mostrar="telefono"
              telefonoVerificado
              referenciasConfirmadas={referenciasConfirmadas}
              esMicroempresa={esMicroempresa}
            />
          ) : (
            /* Se dice, no se calla. Un carné sin sello y sin explicación se
               lee como un carné normal, y este no lo es todavía. */
            <span className="bg-accent text-accent-foreground inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium">
              <span aria-hidden="true">!</span>
              Sin verificar
            </span>
          )}
          {etiquetaGrupo && (
            <span className="shadow-canto inline-flex min-h-8 items-center rounded-full bg-card px-3 text-sm">
              {etiquetaGrupo}
            </span>
          )}
        </div>

        {serviciosConfirmados > 0 && (
          <p className="mt-3 text-base text-muted-foreground">
            <span className="text-foreground font-semibold">{serviciosConfirmados}</span>{' '}
            {serviciosConfirmados === 1
              ? 'servicio confirmado'
              : 'servicios confirmados'}
          </p>
        )}
      </div>
    </div>
  )
}
