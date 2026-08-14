import type { NextRequest } from 'next/server'

export const COOKIE_PASO = 'mantenimiento_paso'

/**
 * La ventana de mantenimiento está ABIERTA salvo que se apague a
 * propósito con `MANTENIMIENTO=0`.
 *
 * El valor por defecto es deliberado: si la variable se pierde en un
 * despliegue, la aplicación queda cerrada y no a medio funcionar. Es
 * preferible mostrar "volvemos pronto" que dejar publicar solicitudes
 * contra un esquema a medio migrar.
 */
export function enMantenimiento(): boolean {
  return process.env.MANTENIMIENTO !== '0'
}

/**
 * Quien conoce `MANTENIMIENTO_LLAVE` puede seguir navegando: es la única
 * forma de verificar los cambios en producción antes de reabrir.
 *
 * La llave se entrega una vez por query (`?llave=...`) y se cambia de
 * inmediato por una cookie, para que no quede en el historial, ni en el
 * `Referer` hacia terceros, ni en los registros del servidor.
 */
export function tienePaso(request: NextRequest): boolean {
  const llave = process.env.MANTENIMIENTO_LLAVE
  if (!llave) return false
  return request.cookies.get(COOKIE_PASO)?.value === llave
}

export function llaveEnLaUrl(request: NextRequest): boolean {
  const llave = process.env.MANTENIMIENTO_LLAVE
  if (!llave) return false
  return request.nextUrl.searchParams.get('llave') === llave
}

// Sin Tailwind ni archivos externos: esta respuesta se arma en el proxy,
// antes de que exista una página, y tiene que verse bien aunque el resto
// de la aplicación esté caída o a medio desplegar.
//
// Lleva el nombre en su capitalización real y una línea de qué es AquíVe
// a propósito. Google rechazó la verificación de la marca OAuth porque su
// revisor entró durante una ventana de mantenimiento y encontró una
// página que no explicaba el propósito de la aplicación y mostraba el
// nombre en mayúsculas. Cualquier revisión externa —Google, Turnstile,
// quien sea— puede caer en una de estas ventanas: que la página diga
// siempre quién es y para qué sirve.
const PAGINA = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Volvemos pronto · AquíVe</title>
<link rel="icon" href="/favicon-32.png">
<style>
  :root { color-scheme: light }
  * { box-sizing: border-box }
  body {
    margin: 0;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background: #f5ead8;
    color: #201e1d;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 1rem;
    line-height: 1.6;
  }
  main {
    max-width: 32rem;
    width: 100%;
    background: #f9f4ed;
    border: 1px solid #dcd3c4;
    border-radius: 1rem;
    padding: 2rem 1.5rem;
    text-align: center;
  }
  /* Sin "text-transform: uppercase" —sin acentos graves aquí: esto vive
     dentro de un literal de plantilla y cerrarían la cadena—. Renderizaba
     AQUÍVE, y Google rechazó
     la verificación de marca porque no coincidía con "AquíVe" de la
     pantalla de consentimiento. El nombre tiene que verse tal cual. */
  .marca {
    display: inline-block;
    font-size: 1.125rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    color: #8c491a;
  }
  .que-es { margin-top: 0.5rem; font-size: 1rem; color: #645c50 }
  h1 { margin: 0.75rem 0 0; font-size: 1.75rem; line-height: 1.25 }
  p { margin: 1rem 0 0; font-size: 1.0625rem }
  .apagado { color: #645c50 }
  .aviso {
    margin-top: 1.5rem;
    padding: 1rem;
    border-radius: 0.75rem;
    background: #ffe1d0;
    border: 1px solid #f6a06b;
    text-align: left;
  }
  .aviso strong { display: block; margin-bottom: 0.25rem }
  .urgencias { margin-top: 1.5rem; font-size: 1rem }
  .urgencias a {
    display: inline-block;
    margin-top: 0.5rem;
    min-height: 48px;
    padding: 0.75rem 1.25rem;
    border-radius: 999px;
    background: #8c491a;
    color: #f9f4ed;
    font-weight: 600;
    text-decoration: none;
  }
</style>
</head>
<body>
<main>
  <span class="marca">AquíVe</span>
  <p class="que-es">Conecta a quien necesita insumos tras el sismo del 10 de
  agosto de 2026 en Colombia con quien puede darlos.</p>
  <h1>Estamos haciendo un ajuste</h1>
  <p>La página vuelve a funcionar en un rato. No hace falta que hagas nada:
  vuelve a entrar más tarde.</p>
  <p class="apagado">Durante este rato no se pueden publicar solicitudes ni
  responderlas.</p>

  <div class="aviso">
    <strong>Tu solicitud sigue guardada</strong>
    Si ya publicaste una, no se borró. El enlace que guardaste vuelve a
    servir apenas terminemos.
  </div>

  <p class="urgencias">Si es una emergencia, no esperes a que volvamos:<br>
  <a href="tel:123">Llamar al 123</a></p>
</main>
</body>
</html>`

export function respuestaMantenimiento(request: NextRequest): Response {
  // 503 y no 200: le dice a buscadores y monitoreo que esto es temporal,
  // así nadie desindexa el sitio por una ventana de media hora.
  const cabeceras = {
    'Retry-After': '3600',
    'Cache-Control': 'no-store',
  }

  // Una petición de datos que recibe HTML falla de forma confusa. Mejor
  // un JSON que el cliente ya sabe leer.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return Response.json(
      { error: 'La página está en mantenimiento. Intenta más tarde.' },
      { status: 503, headers: cabeceras }
    )
  }

  return new Response(PAGINA, {
    status: 503,
    headers: { ...cabeceras, 'Content-Type': 'text/html; charset=utf-8' },
  })
}
