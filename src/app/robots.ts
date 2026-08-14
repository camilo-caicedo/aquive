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
          '/solicitud/',
          // El código de invitación de una organización, igual.
          '/unirse/',
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
