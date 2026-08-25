# Marca · manual en construcción

**Estado: en construcción. Todavía no es la identidad vigente.**

La identidad que hoy está en el código es la del gato —`src/components/marca.tsx`,
Caprasimo y Figtree, papel cálido con terracota y salvia— y sigue siendo la
vigente hasta que un ADR la reemplace. **No cambies un token, una fuente ni un
componente por lo que hay en esta carpeta.**

## Qué hay aquí

| Archivo | Qué es |
| --- | --- |
| `Manual-de-Marca-AquiVe.pdf` | Manual completo, 11 páginas, exportado del pptx. |
| `isotipo-carrito.png` | Isotipo suelto. 1033×1033, fondo blanco. |

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

Anotados aquí para que se resuelvan en el ADR de adopción, no en medio de una
tarea de implementación.

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

**Esto se decide antes de dibujarlo.** Si el pin es una metáfora gráfica para
una lista por zonas, no hay problema. Si es un mapa con posiciones, es cambio
de alcance y va con revisión jurídica.

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

## Lo que falta para poder implementar

- Logo en **SVG**, no PNG a 1033 px.
- **Versión simplificada** para menos de 32 px — el manual la exige pero no la
  incluye. Es la que se necesita para favicon e iconos de la PWA.
- Versión sobre **fondo oscuro** y versión de **una tinta**.
- Los tokens mapeados: qué color de la paleta ocupa `--primary`, `--ok`,
  `--accent` y los demás. Hoy son terracota y salvia; la traducción no es obvia.
- Qué pasa con los assets del gato ya repartidos: `public/icono-192.png`,
  `public/icono-512.png`, `public/favicon-32.png`, el material impreso y el QR
  de `difusion/`.

## Cómo se adopta

Cuando el manual esté cerrado, el cambio va como ADR en `docs/decisiones/`, con
la tabla de qué reglas duras toca. La accesibilidad y la regla 11 no se tocan.
El resto de la sección «Identidad visual» de `CLAUDE.md` y las once reglas de
diseño se reescriben desde ese ADR.
