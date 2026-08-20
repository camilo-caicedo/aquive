import { Siluetas } from '@/components/estado'

// Se ve mientras el servidor responde. Importa: buena parte del público
// entra con señal mala, y una pantalla en blanco parece que se dañó.
//
// Siluetas de la forma que va a llegar, no la palabra «cargando»: se ve
// cuánto viene y dónde va a estar, así que al aparecer el contenido nada
// salta de sitio.
export default function Cargando() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <Siluetas cuantas={3} />
    </main>
  )
}
