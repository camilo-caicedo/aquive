import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { servidor } from '@/orpc/local'
import { ColaPqr } from './cola-pqr'

export const metadata = { title: 'PQR' }

/**
 * La cola de habeas data. Mínimo legal 3, Ley 1581 de 2012 arts. 14 y 15.
 *
 * ⚠ Esta pantalla **no existía**. `/pqr` sabía escribir y nadie sabía leer:
 * el contrato tenía un solo procedimiento, `crear`, y las columnas
 * `estado`, `respuesta` y `respondida_at` no las tocaba nadie. El `CHECK`
 * `pqr_respondida_con_respuesta` era inalcanzable por construcción.
 *
 * Los plazos son de la ley y corren desde que la persona escribe, la mire
 * alguien o no: diez días hábiles una consulta, quince un reclamo. Por eso
 * la cola va en el primer grupo del índice —lo que espera a alguien— y no
 * en el de contenido.
 */
export default async function PqrAdminPage() {
  const pqr = await servidor.pqr.cola()
  const abiertas = pqr.filter((p) => p.estado === 'abierta')

  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="PQR" volver="/admin">
        <p className="mt-1 text-base text-muted-foreground">
          {abiertas.length === 0
            ? 'Nada sin responder'
            : `${abiertas.length} sin responder`}
        </p>
      </CabeceraPantalla>

      <p className="text-base text-muted-foreground">
        Peticiones, quejas, reclamos y sugerencias. El plazo es de la ley y
        corre desde que la persona escribe: diez días hábiles una consulta,
        quince un reclamo. Quien escribió vuelve con su código, que aquí no
        se puede ver — de él solo se guarda el hash.
      </p>

      <ColaPqr pqr={pqr} />
    </main>
  )
}
