/**
 * El ancho y el alto de destino al comprimir en el cliente, dado un original.
 *
 * Aparte de `subir-imagen.tsx` (que es `.tsx`, y un archivo con JSX no lo
 * puede correr `node` directo) para que esta cuenta tenga una comprobación
 * ejecutable sin navegador ni framework.
 *
 * Tiene que dar el mismo resultado que el `resize` de sharp en
 * `src/server/imagenes/recorrido.ts`: `fit: 'inside'` (cabe dentro del
 * cuadrado sin recortar) y `withoutEnlargement: true` (no agranda lo que ya
 * es más pequeño).
 */
export function calcularDimensionesDestino(
  anchoOriginal: number,
  altoOriginal: number,
  ladoMaximo: number,
): { ancho: number; alto: number } {
  if (anchoOriginal <= ladoMaximo && altoOriginal <= ladoMaximo) {
    return { ancho: anchoOriginal, alto: altoOriginal }
  }
  const escala = ladoMaximo / Math.max(anchoOriginal, altoOriginal)
  return {
    ancho: Math.round(anchoOriginal * escala),
    alto: Math.round(altoOriginal * escala),
  }
}
