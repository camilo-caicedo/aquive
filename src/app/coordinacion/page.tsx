import { redirect } from 'next/navigation'

/**
 * La bandeja de las entregas acompañadas se mudó a `/mensajes`.
 *
 * Tenía celda propia en la barra, también llamada «Mensajes», así que quien
 * coordinaba una entrega veía dos celdas con el mismo nombre y ninguna de las
 * dos contenía todos sus hilos. Ahora hay una sola bandeja.
 *
 * La ruta se queda redirigiendo: está en enlaces guardados y en notificaciones
 * ya enviadas, y un 404 ahí manda a alguien a suponer que se perdió su
 * conversación.
 */
export default function CoordinacionPage() {
  redirect('/mensajes')
}
