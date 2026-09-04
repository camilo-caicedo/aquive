# ADR 0005 · Fuera el esqueleto de carga, porque impedía hidratar

- **Estado:** aceptada
- **Fecha:** 2026-08-26
- **Decide:** hallazgo técnico, no preferencia de producto
- **Retira:** `src/app/loading.tsx`

## Contexto

`src/app/loading.tsx` dibujaba siluetas mientras el servidor respondía. La
intención está escrita en el propio archivo y es buena: buena parte del
público entra con señal mala, y una pantalla en blanco parece que se dañó.

Un `loading.tsx` envuelve la página en un `Suspense`. En esta aplicación,
con Next 16.3 y React 19, **eso dejaba el subárbol de la página sin
hidratar**. No hidrataba nunca: no era lento, era que no ocurría.

## Cómo se veía

Entrando por una URL —recargando, o llegando desde fuera— la página se
quedaba con el HTML del servidor:

- La hoja de filtros salía desplegada en el cuerpo en vez de plegada tras
  su chip.
- Los desplegables eran `<select>` nativos, con las esquinas cuadradas y el
  azul del sistema, en medio de una pantalla que no tiene ninguno de los
  dos.
- Nada que dependa de JavaScript respondía.

Llegando por un enlace de dentro se veía bien, porque ahí no hay
hidratación de por medio, y cambiar de pantalla lo «arreglaba». Por eso
parecía un problema de estilos y no de otra cosa.

## Qué se comprobó

Con sondas en el navegador, no de oído:

| Qué | Resultado |
| --- | --- |
| ¿Corre algún efecto del layout? | **Sí.** El layout hidrata. |
| ¿Corre algún efecto dentro de la página? | **No.** Ninguno, nunca. |
| ¿Hay un error lanzado? | **No.** Ni consola, ni overlay, ni log del servidor. |
| ¿Llega entero el flujo RSC? | **Sí.** 351 filas, ninguna referencia sin emitir. |
| ¿Es el slot `@modal`? | **No.** Quitándolo entero, sigue igual. |
| Sin `loading.tsx` | **Hidrata.** |
| `loading.tsx` en la raíz | No hidrata. |
| `loading.tsx` en un segmento | Tampoco. |

El subárbol no fallaba: quedaba suspendido. Y no lo introdujo la reescritura
—se reprodujo con el slot de modales retirado del árbol—.

## Decisión

Se retira `loading.tsx`. Un esqueleto bonito no compensa una pantalla en la
que no funciona nada: sin él la página tarda lo mismo en aparecer, porque el
servidor tarda lo que tarda, y lo que se pierde es el relleno de esa espera.

## Consecuencias

- **No hay esqueleto de carga en ninguna pantalla.** Entre tocar un enlace y
  ver la pantalla nueva, se queda la anterior. Es el comportamiento de
  siempre del navegador y no es una pantalla en blanco.
- **No se vuelve a añadir un `loading.tsx`** sin comprobar antes que la
  página hidrata. La comprobación es de treinta segundos: abrir una pantalla
  con filtros escribiendo la dirección y mirar si el desplegable es el del
  sitio o el del sistema.
- Queda pendiente entender POR QUÉ Next 16.3 se comporta así aquí. Puede ser
  un fallo de la versión o algo de esta aplicación; hasta saberlo, el
  esqueleto no vuelve.

---

## Comprobación del 4 de septiembre de 2026

Se volvió a medir, que es lo que este ADR pedía por escrito antes de
reponer el esqueleto. **Sigue en pie, y el alcance es más ancho de lo que
decía.**

La sonda: un `loading.tsx` con un `<p>` y nada más, `/directorio` abierto
tecleando la URL, y `useHidratado()` de `src/components/hidratado.ts` como
detector — mientras no hidrate, `SelectFiltro` pinta un `<select>` nativo.

| | sin `loading.tsx` | con `loading.tsx` |
| --- | --- | --- |
| `<select>` nativos | 0 | 1 |
| Desplegable del sitio | 1 | 0 |
| `body` hidratado | sí | sí |
| **`main` hidratado** | **sí** | **no** |

Igual que en agosto: el layout hidrata y la página no.

**Lo nuevo, y es lo que importa: no es `loading.tsx`.** Es cualquier
`Suspense`. Con una ruta de prueba que ponía el mismo componente de cliente
dentro y fuera de un `<Suspense>` alrededor de un `async` lento, el de
fuera hidrató y el de dentro no. Y el `fallback` **no se retira nunca**: el
contenido resuelto se queda en un `<div hidden>` al final del `body`, con
el límite marcado `<!--$~-->` —pospuesto— y un `<template id="B:0">` en su
sitio. React no lo reanuda jamás.

Descartado, uno por uno:

| Sospecha | Resultado |
| --- | --- |
| Versión de Next (16.3.0 → 16.3.4) | Igual. No lo arregla |
| Solo en desarrollo | No. `next build` + `next start` se comporta igual |
| `src/proxy.ts` en medio del flujo | No. Apartándolo, igual |
| Marcador `$~` desconocido por el cliente | No. El runtime vendorizado lo conoce |
| Scripts que no cargan | No. Cero respuestas 4xx |

Así que la consecuencia se amplía: **no hay esqueleto de carga, y tampoco
puede haber `<Suspense>` en ninguna parte** mientras esto siga así. Queda
abierto el porqué, ahora sobre una pregunta mejor planteada: por qué este
árbol no reanuda un límite pospuesto.

⚠ Al repetir la sonda con el navegador en otra máquina, hace falta
`allowedDevOrigins` en `next.config.ts`: sin eso Next 16 responde 403 a los
chunks de desarrollo, no hidrata nada, y parece este fallo sin serlo.
