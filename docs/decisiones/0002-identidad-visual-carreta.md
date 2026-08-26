# ADR 0002 · La identidad de la carreta reemplaza a la del gato

- **Estado:** aceptada
- **Fecha:** 2026-08-26
- **Decide:** responsable del proyecto
- **Reemplaza:** la sección «Identidad visual» de `CLAUDE.md`
- **Fuente:** `docs/marca/Manual-de-Marca-AquiVe.pdf`, y el prototipo
  `docs/marca/AquiVe-Flujo.dc.html` (proyecto «Nuevo flujo AquiVe»,
  `15faa214-f345-41cc-9c80-8bfa1267e594`)

## Contexto

El manual de marca reposiciona AquíVe como «plataforma digital para la economía
del rebusque». El símbolo pasa del gato a una carreta de venta callejera con
sombrilla y letrero. Sobre ese manual se construyó un prototipo de 40 pantallas
que aplica la identidad a la aplicación entera.

`docs/marca/LEEME.md` decía que la identidad nueva no era vigente hasta que un
ADR la adoptara. Este es ese ADR, para la parte visual. El cambio de flujo y de
alcance va aparte, en el ADR 0003, porque toca reglas duras y la parte visual
no.

## Decisión

Se adopta la identidad del manual. El gato sale del producto.

### Paleta y tokens

Los cuatro gajos de la sombrilla codifican familias de oficio. El código de
color **nunca va solo**: siempre acompañado de la palabra, por la regla 9.

| Token | Antes | Ahora | Nota |
| --- | --- | --- | --- |
| `--background` | `#f5ead8` papel | `#F5EEE2` crema | |
| `--foreground` | `#201e1d` | `#1D1D1B` | |
| `--card` | `#fefcfa` | `#ffffff` | |
| `--primary` | `#8c491a` terracota | `#B8F000` lima | una sola por pantalla |
| `--primary-foreground` | `#f9f4ed` | `#1D1D1B` | negro sobre lima, 12.46 |
| `--ok` | `#56633f` salvia | `#38B58C` verde | |
| `--ok-suave` | `#e1eecc` | `#DFF3EC` | |
| `--accent` | `#ffe1d0` | `#FEF6DE` | pendiente / aviso |
| `--accent-foreground` | `#643312` | `#1D1D1B` | |
| `--muted-foreground` | `#6f5a4a` | `#6f5a4a` | **no cambia**, 5.63 sobre crema |
| `--ring` | `#c67139` | `#2860A8` | foco en azul |
| `--input` | `#c0b6a5` | *se elimina* | ver «campos rellenos» |

Familias: azul `#2860A8`, amarillo `#F4C542`, verde `#38B58C`, rojo pastel
`#E86F87`.

### La regla de color, en una línea

**Solo el negro y el azul son color de texto. Los otros cuatro son relleno.**

Medido con WCAG 2.1:

| Uso | Ratio | |
| --- | --- | --- |
| Blanco sobre azul `#2860A8` | 6.31 | AA |
| Negro sobre lima `#B8F000` | 12.46 | AA |
| Negro sobre amarillo `#F4C542` | 10.38 | AA |
| Negro sobre verde `#38B58C` | 6.56 | AA |
| Negro sobre rojo pastel `#E86F87` | 5.67 | AA |
| Azul sobre crema `#F5EEE2` | 5.47 | AA |
| Amarillo, verde, rojo o lima **como texto sobre claro** | 1.35 – 2.98 | **prohibido** |

La paleta funciona entera mientras cada color sea fondo de bloque con texto
negro encima. Falla entera en el momento en que uno de esos cuatro se usa como
color de letra o de icono fino sobre crema o blanco.

`--primary` es lima con texto negro, no azul: el manual reserva el lima para
llamar la atención y el prototipo lo usa como la acción única de cada pantalla.
El azul queda para enlaces, foco y texto de énfasis.

### Tipografía

- **Montserrat** en titulares y etiquetas (clase `font-heading`).
- **Poppins** en cuerpo.
- **Geist Mono** solo en códigos de servicio, ID de carné y valores
  enmascarados. No cambia.

Caprasimo y Figtree salen.

> Queda una discrepancia de la fuente: las notas del prototipo dicen «Archivo en
> cuerpo», y el prototipo carga Poppins. Se adopta **Poppins** porque es lo que
> está construido y lo que el manual nombra primero, pero **antes de cerrar hay
> que probar Poppins a 16 px en un teléfono viejo**: es geométrica y confunde
> `I`, `l` y `1`. Si falla la prueba, Archivo es el reemplazo, y es cambio de
> una línea en `layout.tsx`.

### Estilo

- **Sin contornos negros.** La identidad de cartel la cargan las sombras
  desplazadas en color de familia y las cintas de color. El prototipo eliminó
  294 estilos con borde negro.
- **Sombra de 1 px** en los elementos blancos sobre crema, para que tengan canto
  sin necesitar borde.
- **Campos de texto rellenos**: crema dentro de tarjeta blanca. El subrayado
  como único indicador se descarta —`--input: #c0b6a5` daba 2:1 contra el
  blanco, que no es percibible—.
- Ilustración tipo sketch: contornos negros irregulares con hatching, color
  plano, formas orgánicas. Aplica a la ilustración, no a la interfaz.

### Normas del logo

Área de seguridad mínima ¼ de la altura del isotipo. Tamaño mínimo 30 mm
impreso, 15 mm el isotipo, **versión simplificada por debajo de 32 px**. No
estirar, no rotar, no recolorear, no poner elementos encima.

## Qué NO cambia

- **Toda la accesibilidad.** 48 px táctiles con 8 px de separación, 16 px de
  texto, contraste AA, estado nunca solo por color, foco visible. Es núcleo
  invariante y un rediseño no lo toca.
- **La prohibición de color crudo.** Cambian los valores de los tokens; no
  cambia que escribir `bg-amber-50` esté prohibido.
- **La regla 11.** El dato sensible se destapa de uno en uno, con motivo, y se
  dice que quedó en bitácora.
- **Geist Mono en los códigos.**

## Qué reglas duras cambian de garante

Ninguna. Este ADR es visual: no toca qué dato se guarda, ni quién puede leerlo,
ni cuánto vive. El ADR 0003 sí.

## Consecuencias

### Positivas

- Una sola identidad, documentada, con la tabla de contraste resuelta de
  antemano en vez de discutida pantalla por pantalla.
- El código de color por familia hace reconocible una tarjeta a media pantalla,
  que es como se usa esto: de pie y con prisa.

### Negativas

- Toca los 39 `page.tsx` y buena parte de los componentes. No es un cambio de
  `globals.css`.
- Los assets del gato ya están repartidos: `public/icono-192.png`,
  `public/icono-512.png`, `public/favicon-32.png`, el QR de `difusion/` y el
  material impreso. Reemplazarlos es una migración con su propio orden.
- `src/components/marca.tsx` se reescribe entero.

### Bloqueante de origen

**Falta el logo en SVG.** Hoy solo hay un PNG de 1033×1033 con fondo blanco.
Para producto hacen falta: SVG, la versión simplificada para menos de 32 px que
el propio manual exige, versión sobre fondo oscuro y versión de una tinta. Sin
la simplificada no se pueden rehacer el favicon ni los iconos de la PWA.

Lo demás puede avanzar sin eso.

## Plan

1. Tokens de `globals.css` y fuentes de `layout.tsx`. Cambio pequeño, efecto
   global. Aquí se ve de inmediato qué se rompe.
2. Probar Poppins a 16 px en un teléfono real antes de seguir.
3. `marca.tsx` y los assets, cuando llegue el SVG.
4. Componentes compartidos: `navegacion.tsx`, `encabezado.tsx`,
   `marco-flujo.tsx`, `tarjeta-proveedor.tsx`.
5. Pantalla por pantalla, en el orden del ADR 0003.

## Revisión

Se revisa si la prueba de Poppins a 16 px falla, o si aparece una versión del
manual que contradiga la tabla de contraste — en cuyo caso manda la tabla, no el
manual.
