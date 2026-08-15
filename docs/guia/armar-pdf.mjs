// Arma la version imprimible A PARTIR del html publicado, no de una copia
// a mano: si la guia cambia, se vuelve a correr esto y el PDF sigue el
// mismo texto. Una sola fuente de verdad.
//
// El archivo del artefacto no trae esqueleto —el publicador lo envuelve—,
// asi que aqui se le pone: <style> al head, marcado al body.
import { readFileSync, writeFileSync } from 'node:fs'

const dir = new URL('.', import.meta.url).pathname.replace(/^\//, '')
const fuente = readFileSync(dir + 'guia-aliado.html', 'utf8')

const sinTitulo = fuente.replace(/<title>[\s\S]*?<\/title>/, '')
const estilos = [...sinTitulo.matchAll(/<style>[\s\S]*?<\/style>/g)].join('\n')
const marcado = sinTitulo.replace(/<style>[\s\S]*?<\/style>/g, '')

const estilosImpresion = `
<style>
  /* En papel no hay tema del sistema que valga: siempre el claro. Los
     tokens claros viven en :root, y el data-theme="light" del <html>
     impide que entren los bloques oscuros. */
  @page {
    size: A4;
    margin: 16mm 15mm 18mm;
  }

  @media print {
    body {
      padding: 0;
      font-size: 10.5pt;
      /* Fondo blanco, no el papel crema. El fondo de la pagina nunca llega
         al borde —las impresoras no imprimen a sangre— asi que el crema
         salia como un bloque pegado sobre una hoja blanca. El color se
         queda donde significa algo: las cajas y los avisos. */
      background: #fff;
      /* Sin esto el navegador se come esos fondos y los avisos quedan como
         parrafos sueltos, que es justo lo que no pueden ser. */
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .hoja { max-width: none; gap: 1.5rem; }
    h1 { font-size: 24pt; }
    h2 { font-size: 14pt; }
    h3 { font-size: 11pt; }

    /* Solo lo que se lee de una vez. La seccion entera era demasiado
       grueso: una que no cabia saltaba completa y dejaba media hoja en
       blanco. Una caja partida en dos hojas si es ilegible. */
    .caja, .aviso, .bien, ol.pasos > li, table, footer {
      break-inside: avoid;
    }
    h2, h3, header { break-after: avoid; }

    /* Tres columnas de 15rem no caben en A4 con margenes. */
    .rejilla { grid-template-columns: repeat(2, 1fr); }

    a { text-decoration: none; }
  }
</style>
`

writeFileSync(
  dir + 'guia-aliado-imprimible.html',
  `<!doctype html>
<html lang="es" data-theme="light">
<head>
<meta charset="utf-8">
<title>Coordinar entregas en AquíVe</title>
${estilos}
${estilosImpresion}
</head>
<body>
${marcado}
</body>
</html>`
)

console.log('estilos encontrados:', estilos.length > 0)
console.log('marcado encontrado:', marcado.includes('class="hoja"'))
