'use client'

/**
 * A dónde vuelve alguien después de entrar con Google.
 *
 * ⚠ El destino NO viaja en la URL. La lista blanca del `next` del callback
 * —`/^\/unirse\/[a-z0-9-]{3,40}$/`— es exacta a propósito: con «cualquier
 * ruta relativa», `next=//evil.com` o `next=/\evil.com` convierten el
 * callback en un redirect abierto desde una dirección que la gente ya
 * considera de confianza. Ampliarla es abrir esa puerta.
 *
 * Así que el destino se guarda en `sessionStorage` antes de salir hacia
 * Google y se recoge al volver — el mismo patrón que `/unirse` ya usa con
 * su código de invitación, que tampoco puede viajar en el `redirectTo`.
 *
 * Y se valida igual al recogerlo: solo rutas internas conocidas. Que el
 * valor lo haya escrito esta misma aplicación no basta, porque
 * `sessionStorage` lo puede tocar cualquier script de la pestaña.
 */
const CLAVE = 'aquive:destino'

// Las rutas a las que tiene sentido volver después de entrar. Nada de
// comodines: cada una está aquí porque alguien llega a ella sin sesión y
// se le pide una.
const PERMITIDAS = [
  /^\/responder\/[A-Za-z0-9]{4,12}$/,
  /^\/servicios\/soy-proveedor$/,
  /^\/registro$/,
  /^\/aliado$/,
]

export function guardarDestino(ruta: string) {
  if (!PERMITIDAS.some((r) => r.test(ruta))) return
  try {
    sessionStorage.setItem(CLAVE, ruta)
  } catch {
    // Navegación privada: se pierde el destino y se cae en el de siempre.
  }
}

/** Lo devuelve y lo borra: sirve una vez. */
export function recogerDestino(): string | null {
  try {
    const ruta = sessionStorage.getItem(CLAVE)
    sessionStorage.removeItem(CLAVE)
    if (!ruta) return null
    return PERMITIDAS.some((r) => r.test(ruta)) ? ruta : null
  } catch {
    return null
  }
}
