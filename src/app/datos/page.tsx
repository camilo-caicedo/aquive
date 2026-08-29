import { BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Alert, AlertDescription } from '@/components/ui/alert'

export const metadata = { title: 'Datos abiertos' }

export default async function DatosPage() {
  const supabase = await createClient()

  // El rastro anónimo que sobrevive al borrado, ya agregado por la vista:
  // municipio, oficio y si alguien respondió. Sin texto, sin barrio, sin nada
  // que permita reconstruir quién pidió qué.
  const [{ data: servicios }, { data: oficios }] = await Promise.all([
    supabase.from('datos_servicios').select('*'),
    supabase.from('catalogo_oficios').select('id, nombre'),
  ])

  const nombreOficio = new Map((oficios ?? []).map((o) => [o.id, o.nombre]))

  // La vista agrupa por municipio y por oficio; aquí se colapsa a oficio,
  // que es lo que dice algo en una lista: «cuántas veces se buscó una
  // modista» se entiende, «cuántas en el municipio 76001» no.
  const porOficio = Object.values(
    (servicios ?? []).reduce<Record<string, { oficio: string; solicitudes: number; con_respuesta: number }>>(
      (acumulado, fila) => {
        const previo = acumulado[fila.oficio] ?? {
          oficio: fila.oficio,
          solicitudes: 0,
          con_respuesta: 0,
        }
        acumulado[fila.oficio] = {
          oficio: fila.oficio,
          solicitudes: previo.solicitudes + Number(fila.solicitudes),
          con_respuesta: previo.con_respuesta + Number(fila.con_respuesta),
        }
        return acumulado
      },
      {}
    )
  ).sort((a, b) => b.solicitudes - a.solicitudes)


  return (
    <main className="animar-pantalla mx-auto max-w-3xl px-4 py-6">
      <p className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
        Datos abiertos
      </p>
      <h1 className="font-heading mt-2 flex items-center gap-2 text-3xl">
        <BarChart3 className="size-6" aria-hidden="true" />
        Qué se necesitó y dónde
      </h1>
      <p className="mt-2 max-w-prose text-base text-muted-foreground">
        Cuando una solicitud se borra, queda solo este rastro anónimo:
        municipio, oficio y si alguien respondió. No hay nombres, ni
        direcciones, ni forma de reconstruir quién pidió qué.
      </p>

      {/* ⚠ Aquí había además una mitad de `metricas`, la del módulo de
          insumos, con sus categorías y su mediana de primera respuesta. Se
          fue con su tabla (ADR 0014). Lo que queda es el rastro del
          directorio de oficios, que no comparte ni una columna con aquella —
          mezclar los dos conteos daba un número que no significaba nada. */}
      <section className="mt-8">
        <h2 className="font-heading text-2xl">Servicios que se buscaron</h2>
        <p className="mt-1 max-w-prose text-base text-muted-foreground">
          Cuántas veces se pidió cada trabajo, en qué municipio, y si alguien
          respondió.
        </p>

        {porOficio.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center text-base text-muted-foreground">
            Todavía no hay datos. Aparecerán cuando las primeras solicitudes de
            servicio se cierren o venzan.
          </p>
        ) : (
          <ul className="mt-4 space-y-1">
            {porOficio.map((o) => (
              <li
                key={o.oficio}
                className="flex flex-wrap justify-between gap-2 border-b border-border py-2 text-base"
              >
                <span>{nombreOficio.get(o.oficio) ?? o.oficio}</span>
                <span className="text-muted-foreground">
                  {o.solicitudes}{' '}
                  {o.solicitudes === 1 ? 'solicitud' : 'solicitudes'} ·{' '}
                  {o.con_respuesta} con respuesta
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Alert className="mt-8">
        <AlertDescription>
          Estos datos son públicos a propósito. Son el aporte que sobrevive al
          proyecto cuando deje de operar.
        </AlertDescription>
      </Alert>
    </main>
  )
}
