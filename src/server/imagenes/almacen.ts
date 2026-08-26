import 'server-only'

// El almacén de objetos.
//
// ADR 0001 regla 5: se habla S3, no el cliente de Supabase, para que el mismo
// código sirva contra R2, MinIO o AWS cambiando variables de entorno.
//
// Mientras no existan credenciales S3 propias —las genera el responsable en el
// panel de Supabase, y son otras que la service role— se usa la API REST de
// Storage, que acepta la llave que ya tenemos. La forma de este módulo es la
// misma en los dos casos: `subir`, `descargar`, `mover`, `borrar`, `firmarSubida`.
// Cambiar de una a otra es reescribir ESTE archivo y nada más.

const BUCKET_CUARENTENA = 'cuarentena'
const BUCKET_PUBLICO = 'publico'

export const TOPE_BYTES = 2 * 1024 * 1024 // 2 MB, regla de producto 8

export const TIPOS_ACEPTADOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
] as const

function base() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Falta la configuración del almacén de imágenes.')
  return { url: `${url}/storage/v1`, key }
}

function cabeceras() {
  const { key } = base()
  return { apikey: key, Authorization: `Bearer ${key}` }
}

/**
 * Una URL firmada para que el cliente suba DIRECTO a cuarentena.
 *
 * El archivo no atraviesa una función del servidor (ADR 0001, regla 4): desde
 * un teléfono con señal mala, una subida que pasa por nuestra función es un
 * tiempo de espera agotado y una factura.
 */
export async function firmarSubida(ruta: string) {
  const { url } = base()
  const r = await fetch(`${url}/object/upload/sign/${BUCKET_CUARENTENA}/${ruta}`, {
    method: 'POST',
    headers: { ...cabeceras(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 600 }),
  })
  if (!r.ok) throw new Error(`No se pudo firmar la subida: ${r.status}`)
  const { url: firmada } = (await r.json()) as { url: string }
  return { ruta, url: `${base().url}${firmada}` }
}

export async function descargarDeCuarentena(ruta: string): Promise<Buffer> {
  const { url } = base()
  const r = await fetch(`${url}/object/${BUCKET_CUARENTENA}/${ruta}`, {
    headers: cabeceras(),
  })
  if (!r.ok) throw new Error(`No se pudo leer la imagen: ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

export async function subirAPublico(ruta: string, cuerpo: Buffer, tipo: string) {
  const { url } = base()
  const r = await fetch(`${url}/object/${BUCKET_PUBLICO}/${ruta}`, {
    method: 'POST',
    headers: { ...cabeceras(), 'Content-Type': tipo, 'x-upsert': 'true' },
    body: new Uint8Array(cuerpo),
  })
  if (!r.ok) throw new Error(`No se pudo publicar la imagen: ${r.status}`)
}

export async function borrar(bucket: 'cuarentena' | 'publico', ruta: string) {
  const { url } = base()
  await fetch(`${url}/object/${bucket}/${ruta}`, {
    method: 'DELETE',
    headers: cabeceras(),
  })
}

/** La URL pública de algo ya aprobado. */
export function urlPublica(ruta: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET_PUBLICO}/${ruta}`
}
