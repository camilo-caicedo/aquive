/**
 * Los tres criterios del §6 del documento fuente, en barras y no en
 * estrellas.
 *
 * La escala es de 3 —mal, bien, muy bien— porque esto se toca de pie, con
 * prisa y en un teléfono viejo: cinco estrellas de 40 px de ancho se
 * fallan. Y el promedio va en pequeño, debajo del número de servicios
 * confirmados, que es la salvaguarda «volumen antes que promedio».
 *
 * Redundante a propósito: el valor va escrito además de dibujado, para
 * que no dependa solo del color ni del ancho de una barra.
 */
const NIVELES = ['—', 'Mal', 'Bien', 'Muy bien']

function etiqueta(valor: number | null) {
  if (valor == null) return NIVELES[0]
  return NIVELES[Math.round(valor)] ?? NIVELES[0]
}

function Criterio({ nombre, valor }: { nombre: string; valor: number | null }) {
  const porcentaje = valor == null ? 0 : Math.max(0, Math.min(1, (valor - 1) / 2)) * 100

  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-sm">{nombre}</span>
      <span
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${nombre}: ${etiqueta(valor)}`}
      >
        <span
          className="block h-full rounded-full bg-ok"
          style={{ width: `${porcentaje}%` }}
        />
      </span>
      <span className="w-20 shrink-0 text-right text-sm text-muted-foreground">
        {etiqueta(valor)}
      </span>
    </div>
  )
}

export function CriteriosResena({
  cumplimiento,
  trato,
  puntualidad,
}: {
  cumplimiento: number | null
  trato: number | null
  puntualidad: number | null
}) {
  return (
    <div className="space-y-2">
      <Criterio nombre="Cumplimiento" valor={cumplimiento} />
      <Criterio nombre="Trato" valor={trato} />
      <Criterio nombre="Puntualidad" valor={puntualidad} />
    </div>
  )
}
