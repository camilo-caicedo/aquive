// Gemela de `public.contiene_pii(text)` en Postgres. Si cambia una, cambia
// la otra: son los dos lados del mismo control y ya se separaron una vez
// —el de aquí llevaba /i y el de allá no, así que `JUAN@GMAIL.COM` pasaba
// por la base y se bloqueaba en el cliente (CLAUDE.md regla 2).

// Correo, o usuario de red social con arroba.
const PATRON_ARROBA = /@[a-zA-Z0-9._-]{2,}/i

// Los separadores que la gente mete dentro de un número para que se lea
// mejor. La coma queda fuera a propósito: es la salida para escribir listas
// de números legítimas —"tallas 38, 40, 42"— sin que el filtro salte.
const SEPARADORES = /[\s.()-]/g

// Siete dígitos seguidos, ya sin separadores. Un celular colombiano tiene
// 10, un fijo 7 u 8, una cédula entre 8 y 10.
//
// El patrón anterior exigía dígitos CONTIGUOS, así que bloqueaba
// "3001234567" y dejaba pasar "+57 300 123 4567", "300 123 4567" y
// "79.123.456" — es decir, todas las formas en que la gente escribe un
// número de verdad.
const PATRON_DIGITOS = /\d{7,}/

export function contienePII(texto: string): boolean {
  if (PATRON_ARROBA.test(texto)) return true
  return PATRON_DIGITOS.test(texto.replace(SEPARADORES, ''))
}

// El mismo mensaje en los tres sitios que validan texto libre, con la
// salida incluida: sin decir cómo escribir una lista de tallas o de
// cantidades, la persona se queda atascada sin saber qué cambió.
export const MENSAJE_PII =
  'No incluyas teléfonos, correos ni números de identificación. Si son varias cantidades, sepáralas con comas.'

export function validarBarrio(barrio: string): string | null {
  const limpio = barrio.trim()
  if (limpio.length < 2 || limpio.length > 60) {
    return 'El barrio debe tener entre 2 y 60 caracteres'
  }
  if (contienePII(limpio)) {
    return MENSAJE_PII
  }
  return null
}

export function validarNota(nota: string): string | null {
  if (nota.length > 140) {
    return 'Máximo 140 caracteres'
  }
  if (contienePII(nota)) {
    return MENSAJE_PII
  }
  return null
}

// Gemela de `public.enlaces_validos` en Postgres. Si cambia una, cambia la
// otra — igual que `contienePII`.
//
// ⚠ LISTA BLANCA de un solo esquema, nunca lista negra. `javascript:`,
// `data:`, `vbscript:`, `blob:` y `file:` no se enumeran en ninguna parte:
// quedan fuera por no estar aquí. Una lista negra pierde siempre contra
// `java\tscript:` o `JaVaScRiPt:`.
//
// Se usa `URL` del navegador en vez de una expresión regular sola porque
// resuelve gratis dos cosas que a mano salen mal: pasa el host a punycode
// —lo que delata el homógrafo, «аquive.co» con «а» cirílica— y separa
// `username`, que es como se monta `https://real.org@evil.com`.
export function esEnlaceSeguro(url: string): boolean {
  if (url.length < 12 || url.length > 200) return false
  // Solo ASCII imprimible: cierra el homógrafo antes de mirar nada más.
  if (/[^ -~]/.test(url)) return false
  if (/[\s<>"']/.test(url)) return false
  if (url.includes('@')) return false

  try {
    const u = new URL(url)
    // `http://` también queda fuera: el público entra por wifi de albergue,
    // y una página en claro es reescribible en tránsito.
    if (u.protocol !== 'https:') return false
    if (u.username !== '' || u.password !== '') return false
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(u.hostname)) {
      return false
    }
    return true
  } catch {
    return false
  }
}

export const MENSAJE_ENLACE =
  'La dirección debe empezar por https://, sin espacios y sin arroba.'

export function validarEnlace(etiqueta: string, url: string): string | null {
  const texto = etiqueta.trim()
  if (texto.length < 2 || texto.length > 40) {
    return 'El texto del botón debe tener entre 2 y 40 caracteres'
  }
  if (!esEnlaceSeguro(url.trim())) return MENSAJE_ENLACE
  return null
}

// El nombre de una cosa que alguien propone agregar al catálogo. Se aplica
// en los dos sitios donde existe ese campo —publicar y registro— y también
// del lado del servidor.
export function validarSugerencia(nombre: string): string | null {
  const limpio = nombre.trim()
  if (limpio.length < 2 || limpio.length > 60) {
    return 'El nombre debe tener entre 2 y 60 caracteres'
  }
  if (contienePII(limpio)) {
    return MENSAJE_PII
  }
  return null
}
