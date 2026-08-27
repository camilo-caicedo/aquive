import type { MetadataRoute } from 'next'

// Hasta agosto de 2026 esto no existía y `/robots.txt` devolvía un 404.
// No es solo higiene de buscador: hay rutas que llevan un secreto en el
// path y que no tienen por qué acabar en un índice.
//
// ⚠ `Disallow` no oculta nada — es una petición, y quien no la respete
// entra igual. Por eso las páginas que de verdad importan llevan además
// `robots: { index: false }` en su propio `metadata`. Esto es el cinturón;
// aquello, los tirantes.
export default function robots(): MetadataRoute.Robots {
  // Fuera de producción, nada se indexa.
  //
  // Vercel pone `X-Robots-Tag: noindex` en la URL que genera para cada
  // despliegue, pero NO en un alias propio: para Vercel, ponerle alias es
  // decir «esta dirección la controlo yo», y deja de tratarla como
  // efímera. Comprobado — `aquive-xxxx.vercel.app` la manda y
  // `aquive-test.vercel.app` no.
  //
  // Sin esto, abrir el acceso al preview deja indexable una copia entera
  // del sitio contra la base de pruebas, y quien buscara «AquíVe» podría
  // acabar publicando una solicitud de verdad en un entorno que se borra
  // cuando a uno le parece.
  if (process.env.VERCEL_ENV !== 'production') {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          // El token portador de una solicitud va en el path. Quien lo
          // tiene puede ver respuestas, renovar y borrar: no puede quedar
          // en la caché de un buscador.
          // El código de invitación de una organización, igual.
          '/unirse/',
          // Y la pantalla de habeas data, que también lleva el token.
          // Pantallas de sesión. No hay nada que indexar y sí un montón
          // de rutas que solo confunden a quien llega por un buscador.
          '/aliado',
          '/admin',
          '/registro',
          '/mis-solicitudes',
        ],
      },
    ],
  }
}
