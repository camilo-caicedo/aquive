# ADR 0010 · La portada es siempre la bienvenida

- **Estado:** aceptada
- **Fecha:** 2026-08-27
- **Decide:** responsable del proyecto
- **Reemplaza:** la regla de `CLAUDE.md` que decía «La portada depende de la
  sesión»

## Contexto

Hasta hoy `/` servía tres pantallas distintas según quién llegara:

```
hayFiltros    → <Directorio>
sin sesión    → <Bienvenida>
con sesión    → <Inicio>
```

La bienvenida era, por tanto, una pantalla que **quien usa la aplicación no
vuelve a ver nunca**. Se entra una vez, se crea la cuenta, y desde ese momento
esa pantalla desaparece del recorrido.

Eso tiene dos consecuencias, y la segunda es la que lo decide:

1. La bienvenida es donde vive la explicación de qué es esto —«una red de
   vecinos donde quien necesita un servicio encuentra a quien lo ofrece»— y es
   lo que uno le enseña a otra persona para explicarle. Con sesión no había
   forma de llegar a ella.
2. **El logo del encabezado no llevaba a ninguna parte reconocible.** Llevaba
   a `/inicio`, que es una rejilla de tres módulos. Tocar la marca de un sitio
   y aterrizar en un panel no es lo que espera nadie: se toca la marca para
   volver al principio.

Pedido del responsable: «quiero que a ese index se vaya cuando le dé al icono
o título de AquíVe en el header; si ya tengo sesión simplemente se quita lo de
iniciar sesión porque ya tiene».

## Decisión

**`/` es la bienvenida para todo el mundo.** El logo del encabezado apunta
ahí. `<Inicio>` se queda donde ya vivía, en `/inicio`, que es a donde llega
quien entra y a donde lleva la celda «Inicio» de la barra.

La rama de filtros **no cambia**: `/?oficio=…` sigue sirviendo el directorio,
con sesión o sin ella. Ese enlace viene de alguien que compartió una búsqueda,
y enseñarle una bienvenida tira a la basura lo que lo hacía útil.

### Con sesión, la bienvenida es otra cosa por dentro

No es la misma pantalla con un botón menos:

| | Sin sesión | Con sesión |
| --- | --- | --- |
| Encabezado y barra inferior | escondidos (`data-sin-cromo`) | **visibles** |
| «Ofrezco mi trabajo» | lleva a `/login` | lleva a `/servicios/soy-proveedor` |
| «Entrar con Google» | está | no está |

Lo del cromo es lo que importa y es fácil de olvidar: `data-sin-cromo` esconde
encabezado, barra y pie desde `globals.css`. Sin quitarlo, quien tiene sesión
aterrizaría en una pantalla sin barra y sin logo, es decir **sin salida**, en
la ruta a la que acaba de llevarle el logo.

## Alternativas consideradas

**Una ruta nueva, `/bienvenida`, y `/` como estaba.** Descartada: son dos
páginas casi idénticas, y habría que decidir cuál indexa el buscador y cuál
recibe los enlaces compartidos. El costo de mantener dos portadas que dicen lo
mismo es mayor que el de esta decisión.

**Que el logo lleve a `/inicio` y ya.** Es lo que hay hoy, y es justo lo que
el responsable dice que no espera al tocar la marca.

**Un enlace a la bienvenida desde el pie de página.** Resuelve el punto 1 —se
puede volver a leer qué es esto— y no resuelve el punto 2, que es el que se
pidió.

## Qué reglas duras cambian de garante

Ninguna del mínimo legal. Sí hay una de marca que conviene dejar escrita:

| Regla | Hoy | Después |
| --- | --- | --- |
| Para Google, `/` **es** la bienvenida, con el nombre y la frase palabra por palabra | lo sostiene que el rastreador nunca trae sesión | **lo mismo, y además ahora es cierto para todos** |

La verificación de marca de Google ya se cayó dos veces por menos, así que
importa: un rastreador no tiene sesión, así que veía y sigue viendo la
bienvenida. Este cambio solo *amplía* quién más la ve. `generateMetadata` y el
`canonical` a `/directorio` cuando hay filtros no se tocan.

## Consecuencias

**Positivas.** El logo hace lo que se espera de un logo. La explicación de qué
es AquíVe deja de ser inalcanzable para quien ya usa la aplicación. Y `/` pasa
a ser una sola pantalla en vez de tres, que es una rama menos donde
equivocarse.

**Negativas, y son reales.** Quien tiene sesión y escribe `aquive.co` a pelo
aterriza en una presentación en vez de en su inicio — un toque más para llegar
a lo suyo. Se acepta porque la barra inferior está ahí, con «Inicio» a un
dedo, y porque escribir el dominio a mano es lo raro: se entra por el icono de
la PWA, que apunta a `/inicio`.

**Neutras.** La bienvenida pasa a tener dos formas, así que hay dos estados
que probar en vez de uno.

## Plan

1. `src/app/page.tsx` pierde la rama de sesión, pero **sigue leyendo la
   sesión**: se la pasa a `<Bienvenida>`.
2. `src/components/bienvenida.tsx` recibe `conSesion` y cambia las tres cosas
   de la tabla.
3. `src/components/encabezado.tsx` — el logo apunta a `/`.
4. `CLAUDE.md` — la sección «Pantallas».

## Revisión

Si al mirar las métricas resulta que quien tiene sesión aterriza en `/` a
menudo y sale de inmediato hacia `/inicio`, la decisión está costando un toque
a todo el mundo para resolver algo que se hace una vez. Ahí se vuelve a mirar.
