import { redirect } from 'next/navigation'

/**
 * «Cómo funciona» se fundió con «Ayuda».
 *
 * Eran dos destinos que contestan la misma pregunta —«¿cómo hago esto?»— y
 * quien busca cómo borrar sus datos no sabía cuál de los dos abrir. Ahora hay
 * una sola página de ayuda, con las preguntas cortas arriba y la explicación
 * larga debajo.
 *
 * La ruta se queda redirigiendo: lleva meses en el pie de página, en enlaces
 * repartidos por el sitio y probablemente en algún volante. Un 404 aquí manda
 * a alguien a suponer que la explicación desapareció.
 */
export default function ComoFuncionaPage() {
  redirect('/ayuda')
}
