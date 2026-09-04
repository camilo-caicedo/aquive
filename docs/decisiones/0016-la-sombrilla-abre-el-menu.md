# ADR 0016 · La sombrilla abre el menú

- **Estado:** aceptada
- **Fecha:** 2026-09-03
- **Decide:** responsable del proyecto
- **Reemplaza:** la parte del ADR 0010 sobre a dónde lleva el logo del
  encabezado

## Contexto

Hay que decirlo de frente, porque es exactamente lo que este ADR tiene que
reconocer y no disimular: **el mismo responsable pidió lo contrario hace una
semana.** El ADR 0010, del 27 de agosto de 2026, fijó por pedido textual suyo
que tocar la marca llevara siempre a la bienvenida — «quiero que a ese index
se vaya cuando le dé al icono o título de AquíVe en el header». La razón que
se dio entonces era buena: un logo que no lleva a ningún sitio reconocible no
es lo que espera nadie, y la bienvenida es donde vive la explicación de qué es
esto.

Con la aplicación ya en la mano, el mismo responsable pide ahora que el
isotipo de la sombrilla — en `src/components/encabezado.tsx` — abra un menú en
vez de navegar directo. El motivo es el mismo tipo de motivo que trajo el ADR
0010: qué se espera al tocar la marca. Solo que la experiencia de usarla
cambió la respuesta. Un logo que navega directo no puede, a la vez, ser la
puerta a las páginas informativas del sitio — Quiénes somos, Preguntas
frecuentes, Aliados, Datos abiertos, Contacto — y esas páginas no tenían, hasta
hoy, ningún sitio fijo desde el que llegar a todas juntas.

No hay contradicción que resolver con un tecnicismo: es una decisión que
cambió, tomada por quien tiene autoridad para cambiarla, y con una compensación
escrita para lo que se pierde. Eso es lo que sigue.

## Decisión

El isotipo de la sombrilla deja de ser un enlace directo y pasa a abrir un
menú con cinco entradas:

- Quiénes somos
- Preguntas frecuentes
- Aliados
- Datos abiertos
- Contacto

**La portada se alcanza desde dentro de ese menú, como su primera entrada** —
no desaparece, cambia de un toque a dos.

De las cinco, tres ya tienen pantalla en el proyecto y el menú solo las enlaza:
Quiénes somos (`app/quienes-somos`), Preguntas frecuentes (`app/ayuda`,
que en la tabla de pantallas de `CLAUDE.md` es la 37 · Ayuda) y Contacto
(`app/contacto`). **Aliados** y **Datos abiertos** no tienen ruta pública hoy:
`app/aliado` es el panel de trabajo de un centro de acopio, no una página que
presente qué es ser aliado, y no existe ninguna ruta de datos abiertos. Este
ADR no las crea — fija que el menú es donde van a vivir cuando se escriban, y
hasta entonces esas dos entradas no se enlazan a nada que no exista.

## Alternativas consideradas

**Dejar el logo como enlace directo a la bienvenida y poner las cinco páginas
en otro sitio** — por ejemplo, un pie de página o dentro de «Perfil». Es lo que
el ADR 0010 dejó descartado por el motivo contrario: un pie de página en una
aplicación móvil, con la barra inferior fija, casi no se ve nunca, y meterlas
en «Perfil» las hace pasar por configuración de cuenta cuando son información
del sitio, igual que la propia navegación ya distingue con su comentario en
`src/components/navegacion.tsx:158-159`: «no son "lo mío": son información del
sitio».

**Dos gestos distintos según cuánto se sostenga el toque** (tocar navega,
mantener presionado abre el menú). Se descarta por la misma regla de
accesibilidad que gobierna todo el proyecto: el público son personas mayores
con prisa y teléfonos viejos, y un gesto de mantener presionado no es
descubrible ni se anuncia a un lector de pantalla sin trabajo aparte.

**Un ícono de menú aparte, al lado del logo, y el logo sigue navegando.**
Añade un elemento más al encabezado en vez de darle un segundo trabajo al que
ya está, y es exactamente lo que la regla de interfaz 3 de `CLAUDE.md` limita:
dos capas de navegación como máximo, y aquí ya está la barra inferior más el
propio encabezado.

## Qué reglas duras cambian de garante

Ninguna del mínimo legal. La que cambia es de marca, y hay que decirlo con la
misma honestidad que el resto del documento:

| Regla | Con el ADR 0010 | Con este ADR |
| --- | --- | --- |
| A dónde lleva tocar el isotipo del encabezado | a `/`, la bienvenida, en un toque | a un menú, y desde ahí a la bienvenida, en dos |
| Verificación de marca de Google | dependía de que `/` fuera alcanzable y describiera la marca | **no cambia**: `/` sigue siendo la bienvenida con el nombre y la frase palabra por palabra, y `generateMetadata` sigue intacto — lo que cambia es cómo se llega, no qué hay al llegar |

## Consecuencias

### Positivas

- Las páginas informativas dejan de estar sueltas por el sitio sin un sitio
  fijo desde el que encontrarlas todas.
- El isotipo pasa a tener un trabajo que corresponde con lo que de verdad
  contiene esa marca en cualquier sitio: identidad de la organización, no
  atajo de navegación.

### Negativas, y hay que decirlo sin adornos

**Se pierde el gesto universal de «toco la marca y vuelvo al principio».** Es
justo el gesto que el ADR 0010 instaló hace una semana, y ahora se retira.
Quien aprendió ese gesto en la sesión anterior tiene que aprender uno nuevo:
tocar, ver el menú, tocar la bienvenida. Dos toques donde había uno.

Se compensa con dos cosas, ninguna perfecta: la bienvenida queda como primera
entrada del menú, así que sigue siendo lo primero que se ve al tocar la marca,
aunque ya no sea el destino inmediato; y la celda «Inicio» de la barra inferior
sigue exactamente donde estaba, así que quien solo quiere volver al panel de
todos los días —no a la bienvenida— no pierde nada, porque nunca dependió del
logo para eso.

### Neutras

El encabezado gana un estado de apertura del menú que antes no tenía, así que
hay una interacción más que probar: abrir, cerrar tocando fuera, cerrar con
`Escape`, foco visible en las cinco entradas.

## Plan

1. `src/components/encabezado.tsx`: el `<Link href="/">` sobre el isotipo pasa
   a un botón que abre el menú; el menú lleva las cinco entradas y la
   bienvenida va primera.
2. Rutas que faltan: **Aliados** y **Datos abiertos** quedan fuera del alcance
   de este ADR — se enlazan cuando existan, no antes.
3. `CLAUDE.md`: la sección de identidad visual y la referencia al ADR 0010
   sobre a dónde lleva el logo.

## Revisión

Se revisa si, con el menú, la métrica de cuánta gente llega a la bienvenida
después de tener sesión cae a casi cero — ahí el costo del segundo toque no
se estaría pagando con nada a cambio, y hace falta otra forma de ofrecer las
cinco páginas informativas.
