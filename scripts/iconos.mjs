// Genera los iconos de la aplicación desde el arte del diseñador.
//
// La fuente son los SVG de `docs/marca/Logo/SVG/`, no los PNG: los PNG de
// 4267 px están en `.gitignore` —59 MB que se regeneran— y este guion tiene
// que seguir corriendo en un clon limpio. Los SVG sí se versionan.
//
// Y los SVG no se sirven directo: el trazo de boceto son miles de paths y
// cada archivo pesa entre 300 y 700 KB. Como favicon eso es medio mega en
// cada carga, así que van a PNG con paleta.
//
//   node scripts/iconos.mjs
//
// Se corre cuando el diseñador manda arte nueva, que es casi nunca. Por eso
// no está en los `scripts` del package.json.

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = (nombre) => join(raiz, 'docs/marca/Logo/SVG', nombre)

// El crema del arte, medido sobre el SVG — NO es `--background` `#F5EEE2`
// del ADR 0002, es un par de puntos más cálido. La diferencia es invisible
// salvo justo aquí: el SVG enmascarable deja transparente por fuera de su
// cuadro crema, y rellenar con el token deja una costura cuadrada visible.
//
// Va como `flatten` en los seis: sin él el lanzador de Android pinta detrás
// del enmascarable lo que se le antoje, y Apple no maneja bien el alfa en el
// icono de la pantalla de inicio.
const CREMA = '#F3E8DF'

// La versión cuadrada a sangre, con letrero: es la correcta para
// `purpose: "any"` y para Apple.
const CUADRADO = svg('-_ICONO — VERSIÓN CUADRADA COMPLETO 1024X1024-05.svg')

const ICONOS = [
  // Los mini son arte propia, no el cuadrado reducido: a 16 px el dibujo
  // completo es una mancha. Llevan letrero — a ese tamaño las letras no se
  // leen, pero el lima distingue la pestaña de cualquier otra.
  { destino: 'public/favicon-16.png', px: 16, fuente: svg('-_ICONO MINI 16PX-21.svg') },
  { destino: 'public/favicon-32.png', px: 32, fuente: svg('-_ICONO MINI 32PX-17.svg') },
  { destino: 'public/icono-192.png', px: 192, fuente: CUADRADO },
  { destino: 'public/icono-512.png', px: 512, fuente: CUADRADO },
  { destino: 'public/apple-touch-icon.png', px: 180, fuente: CUADRADO },
  // Zona segura: el dibujo ocupa el 62 % central, dentro del círculo del
  // 80 % que recorta Android.
  {
    destino: 'public/icono-maskable-512.png',
    px: 512,
    fuente: svg('-_ICONO ENMASCARABLE ZONA SEGURA 626PX-09.svg'),
  },
]

// Un ICO puede llevar PNG crudos dentro, así que no hace falta librería:
// cabecera de 6 bytes, una entrada de 16 bytes por tamaño, y los PNG detrás.
// Lo entienden todos los navegadores y Windows desde Vista.
function empacarIco(pngs) {
  const cabecera = Buffer.alloc(6)
  cabecera.writeUInt16LE(0, 0) // reservado
  cabecera.writeUInt16LE(1, 2) // tipo: 1 = icono
  cabecera.writeUInt16LE(pngs.length, 4)

  const entradas = []
  let offset = 6 + pngs.length * 16

  for (const { px, datos } of pngs) {
    const entrada = Buffer.alloc(16)
    entrada.writeUInt8(px === 256 ? 0 : px, 0) // 0 significa 256
    entrada.writeUInt8(px === 256 ? 0 : px, 1)
    entrada.writeUInt8(0, 2) // colores de la paleta: 0 = sin paleta declarada
    entrada.writeUInt8(0, 3) // reservado
    entrada.writeUInt16LE(1, 4) // planos
    entrada.writeUInt16LE(32, 6) // bits por píxel
    entrada.writeUInt32LE(datos.length, 8)
    entrada.writeUInt32LE(offset, 12)
    entradas.push(entrada)
    offset += datos.length
  }

  return Buffer.concat([cabecera, ...entradas, ...pngs.map((p) => p.datos)])
}

function rasterizar(fuente, px, { palette = true, alfa = false } = {}) {
  const tuberia = sharp(fuente, { density: 600 })
    .resize(px, px)
    .flatten({ background: CREMA })

  // `flatten` deja el PNG en color type 2 (RGB sin alfa). Solo para el ICO
  // hay que devolverle el canal: ahí sí importa, ver abajo.
  if (alfa) tuberia.ensureAlpha()

  return (
    tuberia
      // `palette` baja el 512 de 125 KB a 40 KB sin diferencia visible: el
      // dibujo tiene pocos colores planos y trama negra.
      .png({ palette, quality: 90, effort: 9 })
      .toBuffer()
  )
}

const generados = []

for (const { destino, px, fuente } of ICONOS) {
  const datos = await rasterizar(fuente, px)
  const ruta = join(raiz, destino)
  await mkdir(dirname(ruta), { recursive: true })
  await writeFile(ruta, datos)
  generados.push([destino, datos.length])
}

// El .ico lleva los mismos dos dibujos, pero rasterizados otra vez en RGBA:
// el decodificador de Turbopack rechaza cualquier otra cosa dentro de un ICO
// —«The PNG is not in RGBA format!»— y el build se cae. Ni indexado ni RGB
// sin alfa. Son 2 KB más, contra un build roto.
const opcionesIco = { palette: false, alfa: true }
const ico = empacarIco([
  { px: 16, datos: await rasterizar(ICONOS[0].fuente, 16, opcionesIco) },
  { px: 32, datos: await rasterizar(ICONOS[1].fuente, 32, opcionesIco) },
])
await writeFile(join(raiz, 'src/app/favicon.ico'), ico)
generados.push(['src/app/favicon.ico', ico.length])

for (const [destino, bytes] of generados) {
  console.log(`${String(bytes).padStart(7)} B  ${destino}`)
}
