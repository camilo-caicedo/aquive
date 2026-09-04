/**
 * El hueco del slot `@modal` cuando no hay nada interceptado, que es casi
 * siempre. Sin este archivo, Next no sabe qué poner ahí en las rutas que
 * ningún interceptor cubre y responde 404.
 */
export default function SinModal() {
  return null
}
