import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const qrcode = require('qrcode-generator')

const URL_APP = 'https://aquive.vercel.app'
const SALIDA = process.argv[2]
const LADO = Number(process.argv[3] ?? 1080)

// --- codificador PNG mínimo (solo zlib de Node) ---
const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

// Corrección de errores alta (H): tolera un QR impreso, arrugado o sucio.
const qr = qrcode(0, 'H')
qr.addData(URL_APP)
qr.make()

const modulos = qr.getModuleCount()
const MARGEN = 4 // zona de silencio mínima que exige el estándar
const celda = Math.floor(LADO / (modulos + MARGEN * 2))
const lado = celda * (modulos + MARGEN * 2)

// Casi negro con matiz cálido: máximo contraste para que escanee con
// poca luz y en cámaras viejas, sin salirse de la paleta.
const OSCURO = [26, 18, 8]
const CLARO = [255, 255, 255]

const raw = Buffer.alloc((lado * 3 + 1) * lado)
let p = 0
for (let y = 0; y < lado; y++) {
  raw[p++] = 0
  const fila = Math.floor(y / celda) - MARGEN
  for (let x = 0; x < lado; x++) {
    const col = Math.floor(x / celda) - MARGEN
    const dentro = fila >= 0 && fila < modulos && col >= 0 && col < modulos
    const [r, g, b] = dentro && qr.isDark(fila, col) ? OSCURO : CLARO
    raw[p++] = r
    raw[p++] = g
    raw[p++] = b
  }
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(lado, 0)
ihdr.writeUInt32BE(lado, 4)
ihdr[8] = 8
ihdr[9] = 2
writeFileSync(
  SALIDA,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
)

console.log(`url=${URL_APP} modulos=${modulos} celda=${celda}px lado=${lado}px -> ${SALIDA}`)
