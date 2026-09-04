// Genera las fotos de las doce categorías de oficio desde el arte del
// cliente.
//
//   node scripts/fotos-categorias.mjs "C:/ruta/a/la/carpeta"
//
// Se corre cuando llega tanda nueva de fotos, que es casi nunca. Por eso no
// está en los `scripts` del package.json, igual que `iconos.mjs`.
//
// ⚠ Los originales NO se versionan. Llegan a 1080×1080 y pesan unos 2 MB
// cada uno; doce serían 24 MB en el repositorio para servir menos de uno.
// Lo que se versiona es la salida de aquí. Si hace falta rehacerlas con
// otro tamaño, hay que volver a pedirle los originales al cliente — está
// dicho a propósito, porque la alternativa es cargar el repositorio con
// arte que solo sirve para volver a comprimirlo.
//
// El lado de 800 px no es una preferencia: la tarjeta más grande que pinta
// una de estas fotos ocupa media pantalla de teléfono, y a 2× eso son unos
// 800 px. Más grande es gastar los datos de alguien que está mirando esto
// desde un plan prepago.

import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const destino = join(raiz, 'public/categorias')

const LADO = 800
const CALIDAD = 78

// Nombre del archivo que manda el cliente → slug del grupo de oficio.
//
// Los slugs son los de `src/lib/familias.ts`, y el nombre visible de cada
// uno está en `src/contrato/servicios.ts`. Si un slug no aparece aquí, su
// tarjeta cae a la cinta de color: eso es correcto y no hay que forzar una
// foto que no ilustre lo que dice el nombre.
//
// Dos de estas seis no se llaman como su categoría, así que queda escrito
// por qué van donde van:
//
//   · `arreglos` es un hombre cambiando una lámpara del techo dentro de una
//     casa. Eso es «Arreglos de la casa» —`construccion`—, no «Confección y
//     arreglos», que tiene su propia foto de máquina de coser.
//   · `domicilios` es la entrega de un pedido de comida en la puerta. En
//     AquíVe no hay categoría «domicilios»: el reparto de comida cuelga de
//     «Comida». Ojo si algún día llega una foto de mensajería en moto —está
//     en la hoja de contacto del cliente—, porque esa sí sería
//     `transporte`, y entonces conviene revisar cuál de las dos ilustra
//     mejor cada una.
const POR_ARCHIVO = {
  // Primer lote, con nombre. El cliente lo mandó el 3 de septiembre de 2026.
  'aseo.png': 'aseo',
  'arreglos.png': 'construccion',
  'confeccion.png': 'confeccion',
  'cuidados.png': 'cuidado',
  'domicilios.png': 'comida',
  'trasteos.png': 'transporte',

  // Segundo lote, el 4 de septiembre, con las doce numeradas y sin nombre.
  // Se identificaron mirándolas. Las seis últimas repiten el primer lote —son
  // la misma toma— así que da igual de cuál de los dos se generen.
  '2.png': 'belleza', //  peluquería
  '3.png': 'construccion', //  arreglando un mueble: mismo sitio que la lámpara
  '4.png': 'ensenanza', //  clase particular con libros
  '5.png': 'eventos', //  montaje de mesa para una fiesta
  '6.png': 'digital', //  atención con computador
  '7.png': 'otros', //  trabajo manual sin oficio reconocible: sirve de cajón
  '8.png': 'aseo',
  '9.png': 'comida',
  '10.png': 'confeccion',
  '11.png': 'construccion',
  '12.png': 'cuidado',
  '13.png': 'transporte',

  // Tercer lote, el 4 de septiembre. `reparacion` tenía una foto prestada
  // —alguien arreglando un mueble— porque en los dos primeros no había
  // ninguna del oficio de verdad. Esta sí: un celular y una cafetera
  // abiertos sobre la mesa, que es exactamente lo que dice el catálogo.
  'reparaciones.png': 'reparacion',
}

const origen = process.argv[2]
if (!origen) {
  console.error(
    'Falta la carpeta con las fotos.\n' +
      '  node scripts/fotos-categorias.mjs "C:/ruta/a/la/carpeta"'
  )
  process.exit(1)
}

await mkdir(destino, { recursive: true })

const enCarpeta = new Set(await readdir(origen))
let hechas = 0

for (const [archivo, slug] of Object.entries(POR_ARCHIVO)) {
  if (!enCarpeta.has(archivo)) {
    console.warn(`· ${archivo} no está en la carpeta. Se salta: ${slug} queda con su color.`)
    continue
  }

  // `cover` y no `inside`: la tarjeta es cuadrada y una foto con franjas
  // vacías a los lados se ve como un error, no como una decisión. Estas
  // llegan ya cuadradas, así que el recorte no quita nada; queda por si la
  // próxima tanda no viene así.
  const webp = await sharp(join(origen, archivo))
    .rotate()
    .resize(LADO, LADO, { fit: 'cover', position: 'attention' })
    .webp({ quality: CALIDAD })
    .toBuffer()

  await writeFile(join(destino, `${slug}.webp`), webp)
  console.log(`${slug}.webp  ←  ${archivo}  (${Math.round(webp.length / 1024)} KB)`)
  hechas++
}

console.log(`\n${hechas} de 12 categorías con foto. El resto cae a su cinta de color.`)
