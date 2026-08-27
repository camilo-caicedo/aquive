# Marca · identidad adoptada

**Estado: adoptada por el ADR 0002** (`docs/decisiones/0002-identidad-visual-carreta.md`).

La identidad de la carreta reemplaza a la del gato. Los tokens, la tabla de
contraste y las fuentes están decididos en ese ADR — **léelo antes de tocar
`globals.css` o un componente**, porque la regla que importa no está en el
manual: solo el negro y el azul son color de texto, los otros cuatro son
relleno.

El flujo nuevo y el cambio de alcance van aparte, en el ADR 0003, que sigue en
**propuesta** con tres decisiones pendientes.

## Qué hay aquí

| Archivo | Qué es |
| --- | --- |
| `Manual-de-Marca-AquiVe.pdf` | Manual completo, 11 páginas, exportado del pptx. |
| `AquiVe-Flujo.dc.html` | Prototipo de las 40 pantallas. Copia del proyecto «Nuevo flujo AquiVe». |
| `isotipo-carrito.png` | Isotipo suelto. 1033×1033, fondo blanco. |

> El prototipo es un `.dc.html`: corre sobre el runtime de Claude Design
> (`sc-if`, `{{ }}`, `DCLogic`). **Es referencia visual y de flujo, no código
> para portar.** Ninguna de esas etiquetas tiene equivalente en el repo.

## Lo que dice el manual

### Posicionamiento

«Plataforma digital para la economía del rebusque.» La marca se reposiciona
entera sobre Servicios. El módulo de emergencia no aparece en el manual.

Personalidad: cercana y popular, digital pero no fría, colombiana y auténtica.

### Concepto del logo

Sombrilla (el vendedor y su presencia física en la calle), carrito (trabajo,
comercio, movilidad) y letrero («AQUÍ VE», evocando los avisos fluorescentes).

### Paleta

| Color | HEX | Uso según el manual |
| --- | --- | --- |
| Azul | `#2860A8` | Identidad / sombrilla |
| Amarillo | `#F4C542` | Sombrilla / acentos |
| Verde | `#38B58C` | Sombrilla / categorías |
| Rojo pastel | `#E86F87` | Acentos |
| Lima fluorescente | `#B8F000` | Letrero |
| Negro | `#1D1D1B` | Tipografía / contornos |
| Crema | `#F5EEE2` | Fondos |

Principales: azul, amarillo, blanco. Secundarios: negro, lima.

El lima es el color diferencial: «usar para llamar la atención, **nunca como
color dominante**». Sí en botones destacados, estados «Disponible»,
notificaciones, letrero del logo. No como color dominante de la interfaz.

### Tipografía

- **Marca:** sans serif condensada, Bold/Extra Bold, mayúsculas, con apariencia
  de stencil o cartel hecho a mano.
- **Digital:** Montserrat / Poppins / Archivo. Montserrat Black en títulos,
  Poppins en textos.

### Estilo visual

Ilustración tipo sketch: contornos negros ligeramente irregulares con hatching,
color plano de la paleta, pocos degradados, formas orgánicas. Sin efectos
digitales genéricos.

### Normas de uso

Área de seguridad mínima de ¼ de la altura del isotipo. Tamaño mínimo 30 mm en
impresión, 15 mm el isotipo. **Versión simplificada por debajo de 32 px
digitales.** No estirar, no rotar, no recolorear, no poner elementos encima.

## Choques con el núcleo invariante

Anotados cuando entró el manual. Los cuatro están resueltos: el 2 y el 3 en el
ADR 0002, el 4 en el ADR 0003, y el 1 lo resolvió el prototipo. Se dejan
escritos porque la resolución importa tanto como el choque.

### 1 · La sombrilla como pin de ubicación (el más grave)

El manual propone la sombrilla como pin que «marca dónde están disponibles» los
comerciantes dentro de la app. Eso choca de frente con dos cosas escritas:

- `CLAUDE.md` dice **«No es una app de mapas»**, y el stack dice sin librería de
  mapas y sin geocoding. La razón no era técnica: ya existen apps que cubren esa
  capa y el eje diferencial es el trato directo.
- La granularidad máxima de ubicación en el proyecto es **municipio y barrio o
  comuna, nada más fino**. Un pin en un mapa es más fino que un barrio por
  definición.

Y hay un asunto de seguridad que el manual no mira: publicar la ubicación
puntual de una persona que trabaja sola en la calle, con su nombre y su
teléfono al lado, es un dato que sirve para encontrarla. No es lo mismo que
decir en qué barrio trabaja.

**Resuelto por el prototipo.** La pantalla 08 agrega por zona, no por persona, y
lo dice en pantalla: «Cada globo es una zona, no una persona: dice cuánta gente
trabaja ahí. Nadie publica su dirección y AquíVe no la guarda.» Eso respeta la
granularidad de barrio de la regla 1.

Queda una condición, y es de stack: el fondo es un mapa base ilustrado con
globos por zona, que no necesita librería de mapas ni geocoding. **Si algún día
se convierte en un mapa de teselas real con posiciones, vuelve a ser el choque
original** y necesita su propio ADR.

### 2 · Contraste

Medido con la fórmula de WCAG 2.1, sobre los dos fondos del manual:

| Color | sobre blanco | sobre crema `#F5EEE2` | Veredicto |
| --- | --- | --- | --- |
| Negro `#1D1D1B` | 16.88 | 14.64 | AA para texto |
| Azul `#2860A8` | 6.31 | 5.47 | AA para texto |
| Rojo pastel `#E86F87` | 2.98 | 2.58 | no cumple |
| Verde `#38B58C` | 2.57 | 2.23 | no cumple |
| Amarillo `#F4C542` | 1.63 | 1.41 | no cumple |
| Lima `#B8F000` | 1.35 | 1.17 | no cumple |

Solo **negro y azul** sirven para texto. Los otros cuatro son colores de
relleno, de ilustración y de fondo de bloque —con texto negro encima—, nunca
color de letra ni de icono fino sobre claro.

Esto no contradice el manual: él ya dice que el lima nunca es dominante. Lo que
agrega es el límite exacto, y que **la accesibilidad no se negocia en el
rediseño** — el público son personas mayores, con estrés agudo, con teléfonos
viejos, leyendo de pie.

Consecuencia directa: el verde y el rojo pastel no pueden ser el único
portador de un estado. Si «Disponible» es verde, necesita además sello, texto o
icono. Ya es la regla 9 y sigue valiendo.

### 3 · Tipografía

Montserrat y Poppins son geométricas con formas ambiguas en tamaños chicos —la
`I` mayúscula, la `l` minúscula y el `1` se parecen mucho en Montserrat—. Antes
de adoptarlas, probar a 16 px en un teléfono viejo, que es el piso del proyecto.
Archivo, la tercera opción del manual, se comporta mejor en cuerpo de texto.

La tipografía de stencil es para el logo. No para interfaz.

### 4 · Cobertura

El manual cubre la marca del rebusque. Falta decidir qué pasa con el módulo de
emergencia mientras siga encendido: si adopta la identidad nueva, si conserva la
actual, o si el rediseño coincide con su apagado.

## Lo que falta de origen

- ~~Logo en **SVG**, no PNG a 1033 px.~~ Llegó el 27 de agosto de 2026.
- ~~**Versión simplificada** para menos de 32 px.~~ Llegó, en 16, 24 y 32 px.
- Versión sobre **fondo oscuro** y versión de **una tinta**. Siguen faltando. No
  bloquean nada hoy: la aplicación no tiene modo oscuro y no hay impresión a una
  tinta pendiente.

El mapeo de tokens ya no falta: está resuelto en el ADR 0002.

## Lo que llegó, y qué se hace con ello

El arte final vive en `docs/marca/Logo/`: veinte SVG y los PNG mini. Los PNG de
4267 px y el `.ai` están en `.gitignore` —59 MB que el SVG regenera—.

Los iconos de la aplicación salen de ahí con `node scripts/iconos.mjs`, que deja
escrito de cuál variante sale cada archivo. Con arte nueva se corre otra vez; no
se editan a mano. Lo que se sirve es PNG con paleta, no el SVG: cada SVG pesa
entre 300 y 700 KB porque el trazo de boceto son miles de paths.

⚠ El crema del arte es `#F3E8DF`, un par de puntos más cálido que
`--background` `#F5EEE2` del ADR 0002. Invisible salvo al rellenar el fondo del
icono enmascarable, donde el token deja una costura visible.

De los assets del gato que estaban repartidos, `public/icono-192.png`,
`public/icono-512.png` y `public/favicon-32.png` ya son la carreta, y
`marca.tsx` se borró. **Queda el material impreso**, que no es código. El QR de
`difusion/` no lleva el logo dentro, así que no le afecta.
