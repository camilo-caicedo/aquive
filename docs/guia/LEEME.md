# La guía del equipo aliado

`docs/guia_aquive.pdf` es lo que se le manda a una fundación cuando se le da
de alta. Cuatro páginas, A4: cómo entrar, cómo armar el equipo, cómo
coordinar una entrega y qué se puede hacer con los datos de la gente.

**El PDF no se edita.** Se edita `guia-aliado.html` y se vuelve a generar.

## Volver a generarlo

```bash
node docs/guia/armar-pdf.mjs
```

Eso escribe `guia-aliado-imprimible.html` al lado — el mismo contenido con
esqueleto HTML y reglas de impresión. Después, con el Chrome que ya está
instalado:

```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" \
  --headless --disable-gpu --no-pdf-header-footer \
  --run-all-compositor-stages-before-draw --virtual-time-budget=4000 \
  --print-to-pdf="docs/guia_aquive.pdf" \
  "file:///<ruta absoluta>/docs/guia/guia-aliado-imprimible.html"
```

Sin librerías de PDF: Chrome ya sabe imprimir y no hace falta traer nada.

## Por qué está así

- **El imprimible se arma desde el mismo HTML**, no de una copia a mano. Dos
  archivos con el mismo texto se desincronizan siempre, y aquí el texto
  describe cómo se manejan documentos de identidad.
- **En papel el fondo va blanco**, aunque en pantalla sea el papel crema del
  proyecto. El fondo de página nunca llega al borde —las impresoras no
  imprimen a sangre— así que el crema salía como un bloque pegado sobre una
  hoja blanca, y de paso gastaba tinta que nadie quiere gastar. El color se
  queda en las cajas y los avisos, que es donde significa algo.
- **La tipografía es del sistema**, no Caprasimo y Figtree. Vienen de Google
  Fonts y aquí no se puede enlazar un CDN, así que el contraste lo dan una
  serif y una sans que existen en cualquier máquina. La identidad la lleva
  el color, que sí es el del proyecto.

## Ojo antes de repartirla

La guía dice que hay un **contrato de transmisión de datos firmado**. Todavía
no lo está: es lo que falta de `PLAN-V2.md` §12, junto con el registro en el
RNBD. El borrador está en `docs/legal/CONTRATO-TRANSMISION.md`.

Y el contenido sale del código tal como está hoy. Si cambia el flujo del
aliado —las pestañas, los permisos, quién puede registrar una entrega— hay
que volver a generarla.

También está publicada como página web, para mandarla por enlace en vez de
como archivo: <https://claude.ai/code/artifact/884a60c1-9515-433c-b4f3-f7694d01b6b0>
