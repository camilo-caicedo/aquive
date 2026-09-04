import { db } from '@/db/cliente'
import { barrerHuerfanas } from '@/server/imagenes/recorrido'

/**
 * La limpieza periódica. La llama Vercel Cron.
 *
 * Hoy hace una sola cosa —barrer las imágenes huérfanas— y es la que no puede
 * hacer Postgres solo: borrar un archivo del almacén de objetos es una
 * petición HTTP, no un `DELETE`. El vencimiento de solicitudes y hilos sí lo
 * sigue haciendo la base, que es donde debe estar.
 *
 * Una huérfana es una imagen subida que nunca se enlazó a una publicación:
 * alguien empezó a escribir, subió una foto y se fue. Sin esto, cada abandono
 * deja un archivo pagando almacenamiento para siempre.
 *
 * Autenticada. Sin ello cualquiera podría dispararla, y aunque el daño sería
 * pequeño —borra lo que ya iba a borrarse— un endpoint que escribe y está
 * abierto es un endpoint abierto.
 *
 * ⚠ Acepta DOS llaves, y no es por comodidad: Vercel Cron manda
 * `Authorization: Bearer $CRON_SECRET`, que es una variable suya, y aquí
 * solo se comprobaba `MANTENIMIENTO_LLAVE`, que es la del modo
 * mantenimiento y sirve para otra cosa. Salvo que las dos tuvieran el mismo
 * valor por casualidad, la tarea respondía 401 todos los días a las 4 y las
 * imágenes huérfanas no se barrieron nunca.
 *
 * Se conservan las dos: `CRON_SECRET` para la tarea programada y
 * `MANTENIMIENTO_LLAVE` para poder dispararla a mano desde una terminal, que
 * es lo que `.env.local.example` describe.
 */
export async function GET(peticion: Request) {
  const dada = peticion.headers.get('authorization')?.replace(/^Bearer /, '')
  const validas = [process.env.CRON_SECRET, process.env.MANTENIMIENTO_LLAVE].filter(
    Boolean,
  )

  if (validas.length === 0 || !dada || !validas.includes(dada)) {
    return new Response('No autorizado', { status: 401 })
  }

  const { borradas } = await barrerHuerfanas(db)

  // Sin cuerpos de petición en el registro (regla de producto 9): solo el
  // número, que no identifica a nadie.
  return Response.json({ imagenes_huerfanas_borradas: borradas })
}
