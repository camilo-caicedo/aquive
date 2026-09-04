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
