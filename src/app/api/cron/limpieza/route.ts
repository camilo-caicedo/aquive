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
 * Autenticada con la misma llave que el resto del mantenimiento. Sin ella
 * cualquiera podría dispararla, y aunque el daño sería pequeño —borra lo que
 * ya iba a borrarse— un endpoint que escribe y está abierto es un endpoint
 * abierto.
 */
export async function GET(peticion: Request) {
  const llave = process.env.MANTENIMIENTO_LLAVE
  const dada = peticion.headers.get('authorization')?.replace(/^Bearer /, '')

  if (!llave || dada !== llave) {
    return new Response('No autorizado', { status: 401 })
  }

  const { borradas } = await barrerHuerfanas(db)

  // Sin cuerpos de petición en el registro (regla de producto 9): solo el
  // número, que no identifica a nadie.
  return Response.json({ imagenes_huerfanas_borradas: borradas })
}
