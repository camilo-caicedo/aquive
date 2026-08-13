// Se ve mientras el servidor responde. Importa: buena parte del público
// entra con señal mala, y una pantalla en blanco parece que se dañó.
export default function Cargando() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      <div className="mt-8 h-7 w-56 animate-pulse rounded-lg bg-muted" />
      <ul className="mt-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-44 animate-pulse rounded-xl bg-muted" />
        ))}
      </ul>
    </main>
  )
}
