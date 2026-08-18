import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { drenarAvisos } from '@/lib/backend/avisos'

// Lo dispara pg_cron vía pg_net cada minuto (ver v2-l1). No es público: solo
// entra quien trae el secreto en la cabecera, que sale del Vault y coincide
// con TAREA_SECRET. El secreto va en la cabecera, nunca en la URL (regla 6).
function secretoValido(recibido: string | null): boolean {
  const esperado = process.env.TAREA_SECRET
  if (!esperado || !recibido) return false
  const a = Buffer.from(recibido)
  const b = Buffer.from(esperado)
  // La longitud primero: timingSafeEqual lanza si los buffers no miden igual.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!secretoValido(request.headers.get('x-tarea-secret'))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const { procesados } = await drenarAvisos()
  return NextResponse.json({ procesados })
}
