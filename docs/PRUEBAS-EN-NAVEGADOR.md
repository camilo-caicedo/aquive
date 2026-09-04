# Probar en el navegador

Trampas del entorno que cuestan una tarde si no se saben. Ninguna es un fallo
de la aplicación: son del montaje de la prueba, y las tres se han diagnosticado
como si fueran bugs reales.

## 1 · El navegador no llega a `localhost`

El Chrome que se automatiza **no está en esta máquina**. `localhost:3737` y
`127.0.0.1:3737` dan `ERR_CONNECTION_REFUSED` aunque `curl` funcione perfecto
desde aquí. Hay que entrar por la IP de red que imprime `next dev`:

```
- Network:  http://192.168.x.x:3737
```

## 2 · Y por esa IP, Next 16 responde 403 a sus propios chunks

Next bloquea los assets de desarrollo pedidos desde un origen no declarado.
El síntoma es cruel: **la página se ve bien pero no hidrata nada** —
desplegables nativos, filtros desplegados, nada de JavaScript responde. Es
idéntico al fallo del ADR 0005, y no tiene nada que ver.

Se arregla declarando el origen, **temporalmente**, en `next.config.ts`:

```ts
allowedDevOrigins: ['192.168.x.x'],
```

⚠ Se revierte al terminar. No va al repositorio.

La sonda para distinguir un caso del otro:

```js
performance.getEntriesByType('resource')
  .filter(e => e.initiatorType === 'script' && e.responseStatus >= 400).length
// > 0  → es esto, no un fallo de hidratación
```

## 3 · En una pestaña oculta, los temporizadores van a 1 Hz

Chrome estrangula `setTimeout` en pestañas sin foco. Medido: un temporizador
de 50 ms tardó 436 ms, y uno de 200 ms salió a 1988 ms. **Cualquier medida de
tiempos por debajo de un segundo sale mal**, y las muestras se espacian solas
cada 1000 ms sin avisar.

```js
document.visibilityState   // 'hidden' → no midas tiempos aquí
```

Si lo que se prueba depende de una pausa corta, se comprueba la lógica con la
pausa saltada y se deja el cronómetro para una pantalla de verdad.

## ¿Hidrata o no?

`src/components/select-filtro.tsx` es el detector exacto: pinta un `<select>`
nativo en el HTML servido y lo cambia por el desplegable del sitio en cuanto
`useHidratado()` corre. Entrando a `/directorio` **tecleando la URL** —por un
enlace de dentro no hay hidratación de por medio y el fallo no se ve—:

```js
document.querySelectorAll('select').length   // 0 hidrata · >0 no
```

Es la comprobación que el ADR 0005 exige por escrito antes de tocar nada que
huela a `Suspense`.

## Otras dos, menores

- **El servidor de desarrollo muere** si se lanza en una subshell que
  termina. Va en segundo plano de verdad.
- **`.next` se queda con tipos viejos** al borrar una ruta: el build falla
  con `Cannot find module '../../../src/app/<ruta borrada>/page.js'`. Se borra
  `.next` y se vuelve a compilar.
