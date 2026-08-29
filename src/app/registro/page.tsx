import { redirect } from 'next/navigation'

/**
 * Puerta vieja.
 *
 * Aquí vivía el asistente de tres pasos que empezaba preguntando «¿Qué vas a
 * ofrecer?». Se fue con el módulo de insumos (ADR 0014) y lo reemplaza
 * `/empezar`, que pide dos cosas y no presupone ninguna (ADR 0015).
 *
 * ⚠ Se queda una release, y no por nostalgia: quien salió a Google justo
 * antes del despliegue lleva `/registro` guardado en `sessionStorage` como
 * destino y vuelve con él. `lib/destino.ts` todavía lo acepta por lo mismo.
 * Las dos cosas se retiran juntas.
 */
export default function RegistroPage() {
  redirect('/empezar')
}
