// El gato de AquíVe. Viene del Gato del Río: está en la orilla, quieto,
// mirando — que es lo que hace la plataforma. La nariz es un corazón porque
// esa es la parte de ayuda y entrega.
//
// Toma el color del texto donde se use (`currentColor`), y recorta ojos y
// nariz con el color de fondo, así el mismo componente sirve sobre papel y
// sobre terracota. Si el fondo no es `--background`, pásale el `hueco`
// correspondiente: `fill-card`, `fill-secondary`, `fill-primary`…
//
// Por debajo de 20 px la nariz se cierra y el gato se lee como una mancha.
// El mínimo es 16 px de alto (`size-4`).
export function Marca({
  className = 'size-9',
  hueco = 'fill-background',
}: {
  className?: string
  hueco?: string
}) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="AquíVe">
      <path
        d="M30.2 38.2 L26 12 L45.1 30.4 A28 28 0 0 1 54.9 30.4 L74 12 L69.8 38.2 A28 28 0 1 1 30.2 38.2 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="39" cy="53" r="4.8" className={hueco} />
      <circle cx="61" cy="53" r="4.8" className={hueco} />
      <path
        d="M50 73.5C44.2 68.6 42 66.2 42 64c0-2.4 1.8-3.8 3.8-3.8 1.6 0 3.1 1 4.2 2.4 1.1-1.4 2.6-2.4 4.2-2.4 2 0 3.8 1.4 3.8 3.8 0 2.2-2.2 4.6-8 9.5Z"
        className={hueco}
      />
    </svg>
  )
}
