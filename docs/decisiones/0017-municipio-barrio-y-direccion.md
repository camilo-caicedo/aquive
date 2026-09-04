# ADR 0017 · Municipio, barrio y dirección, cada uno con lo suyo

- **Estado:** aceptada
- **Fecha:** 2026-09-03
- **Decide:** responsable del proyecto
- **Depende de:** ADR 0004, que fijó el mismo principio para el punto en el
  mapa y que este ADR extiende a la dirección escrita

## Contexto

El cliente pide tres cosas sobre dónde vive o atiende un prestador, y las tres
son cambios de forma, no de gusto:

1. **Municipio**, pensando en expansión fuera del municipio actual.
2. **Barrio como dato principal.**
3. **Dirección opcional**, que se pueda marcar pública o privada.
4. Que **la comuna deje de ser obligatoria**, «porque muchas personas no saben
   a cuál pertenecen».

Hoy, en `src/app/servicios/soy-proveedor/formulario-proveedor.tsx:386-388`, la
regla es:

```ts
const hayUbicacion = zonaId !== '' || zonaTexto.trim().length >= 2
```

Vale comuna **o** barrio, cualquiera de las dos. El comentario que la
acompaña ya explica por qué se aceptaban las dos —«con las dos, mejor; con
ninguna, la ficha no dice dónde atiende»— pero el efecto es que comuna y
barrio compiten por el mismo campo en vez de tener cada una el suyo, y no hay
ningún campo de dirección: hoy no se puede publicar una dirección aunque
alguien quisiera.

## Decisión

Barrio pasa a ser el dato principal y obligatorio. Comuna pasa a ser
secundaria y opcional. Dirección se agrega como campo nuevo, opcional, con su
propia autorización.

### Lo que cambia en el formulario

`hayUbicacion` deja de admitir «una de las dos» y pasa a exigir barrio:

```
hayUbicacion = zonaTexto.trim().length >= 2
```

La comuna (`zonaId`, cuando el municipio la tiene) queda como un campo aparte,
sin condicionar si se puede guardar. Quien no sepa la suya —el motivo textual
del cliente— ya no tiene que resolverlo para publicar su ficha.

### Publicar la dirección es otra finalidad, no un detalle del formulario

Esta es la parte que no es de conveniencia de producto, y va con la misma
base legal que ya usó el ADR 0004 para el punto en el mapa: el artículo 9 de
la Ley 1581 exige autorización previa e informada **con finalidad declarada**,
y publicar dónde vive o atiende alguien es una finalidad distinta de publicar
su nombre o su teléfono. El ADR 0004 lo dijo así para el pin del mapa; la
dirección escrita es el mismo dato en otra forma, y le toca la misma regla.

- Casilla propia, no la de publicación general.
- Constante `AUTORIZACION_DIRECCION_VERSION` en `src/lib/config.ts`, junto a
  `AUTORIZACION_PROVEEDOR_VERSION` y `AUTORIZACION_FOTO_VERSION`, que ya
  siguen este mismo patrón: una constante por finalidad, con la fecha del
  texto que hoy se lee en el formulario.
- Fecha guardada en la fila del prestador, como las otras dos.

### El filtro vive en la vista, no en cada consulta

`direccion` se guarda siempre que se escriba, autorizada o no — igual que la
coordenada del ADR 0004 se guarda siempre y es la vista la que decide qué
enseña. `proveedores_publicos` devuelve `direccion` en `NULL` para quien no
marcó la casilla. **Nunca en cada consulta por separado**, por la razón que ya
dio el ADR 0004 con las mismas palabras que aplican aquí: si el filtro se
duplica, un día una copia se olvida — y aquí olvidarse significa publicar
dónde vive alguien que no lo autorizó.

### La desviación que el cliente pidió, y por qué no se hace así

El cliente pidió textualmente «evitar poner el nombre de la Fundación en el
autorizo». No se puede: el artículo 12 de la Ley 1581 obliga a identificar al
responsable del tratamiento en toda autorización, y la Fundación Nodo Social
es ese responsable en todo el proyecto, como dice la primera línea de
`CLAUDE.md`. Quitar su nombre del autorizo no es una preferencia de redacción,
es dejar la autorización sin uno de sus elementos legales.

Lo que se hace en su lugar, para que el pedido del cliente quede atendido sin
romper la ley: **la casilla dice «Autorizo la publicación de mis datos»**, sin
el nombre de la Fundación en la línea que se ve de entrada, y **el texto legal
completo —con el nombre y el NIT— va en un `<details>` debajo de la casilla**,
plegado por defecto. Quien firma ve una frase corta; quien quiere leer el
texto entero lo despliega; y lo que queda guardado como versión y fecha es el
mismo texto legal completo, con el mismo valor probatorio que cualquier otra
autorización del proyecto. No se firma una versión corta y se guarda una
larga: se firma la larga, y la corta es solo lo que se ve antes de desplegarla.

## Alternativas consideradas

**Mantener `hayUbicacion` con «cualquiera de las dos» y solo agregar
dirección.** No resuelve el pedido del cliente: la comuna seguiría pudiendo
sustituir al barrio, cuando el cliente pidió específicamente que el barrio sea
el dato principal y la comuna quede en segundo plano.

**Reutilizar `AUTORIZACION_PROVEEDOR_VERSION` para la dirección, en vez de una
constante propia.** Es exactamente el atajo que el ADR 0004 rechazó para el
mapa por la misma razón: da por dado un consentimiento que nadie dio para esa
finalidad. Quien aceptó publicar su ficha en agosto no aceptó con eso que se
publicara su dirección.

**Quitar el nombre de la Fundación del autorizo, como pidió el cliente
literalmente.** Descartada por ser ilegal, no por gusto: el artículo 12 no
deja margen. Se documenta aquí para que quede constancia de que se consideró
y por qué no se hizo.

## Qué reglas duras cambian de garante

| Regla | Hoy | Después |
| --- | --- | --- |
| Regla de producto 10 · quién autoriza qué finalidad | nombre y teléfono con una casilla, ubicación en el mapa con otra (ADR 0004) | **una tercera casilla**, `acepto_direccion`, con su propia constante de versión y su propia fecha |
| Filtro de dato sensible en la vista pública | `proveedores_publicos` ya oculta coordenadas sin `acepto_mapa` | **el mismo patrón se repite** para `direccion` sin `acepto_direccion` |
| Regla de ubicación obligatoria | comuna o barrio, cualquiera vale | **barrio obligatorio, comuna opcional** |
| Artículo 12 de la Ley 1581 · identificación del responsable | el nombre de la Fundación está en la línea visible del autorizo | **sigue en el texto legal completo**, ahora dentro de un `<details>` en vez de en la línea corta; la versión guardada sigue siendo la del texto completo |

Nada del mínimo legal se relaja. La desviación que el cliente pidió se atiende
en la forma —qué tan visible es el nombre— y no en el fondo — el nombre sigue
en el documento que se firma y se guarda.

## Consecuencias

### Positivas

- Quien no sabe su comuna deja de estar bloqueado para publicar su ficha, que
  es exactamente el problema que el cliente reportó.
- Un prestador con local fijo puede publicar su dirección exacta si quiere,
  cosa que hoy no puede hacer aunque lo pida.
- El patrón de autorización por finalidad, con su propia versión y su propia
  vista filtrando, se repite por tercera vez sin inventar nada nuevo — es el
  mismo mecanismo del ADR 0004, aplicado a un dato distinto.

### Negativas, y hay que decirlo sin adornos

**Publicar una dirección exacta es más exposición que un pin aproximado.** El
ADR 0004 ya aceptó, a sabiendas, el riesgo de publicar dónde está alguien que
trabaja solo; una dirección escrita puede ser más precisa que un pin que la
propia persona colocó con la imprecisión que quiso. Se mitiga con lo mismo que
ya mitiga el mapa: consentimiento expreso y separado, y la persona decide si
la escribe o no — nadie la pide por defecto.

**El `<details>` plegado es, en la práctica, un texto que la mayoría no va a
abrir.** Es una tensión real entre lo que el cliente pidió —una casilla corta
y legible— y lo que la ley exige —el nombre del responsable presente en la
autorización—. Este ADR resuelve la tensión a favor de la ley, porque es lo
que el mínimo legal de `CLAUDE.md` no negocia, y dejarlo escrito es parte de
cumplir la regla de honestidad de estos documentos.

### Neutras

`proveedores` gana una columna `direccion` y una `acepto_direccion`, además de
`direccion_version` y `direccion_at` si se sigue el mismo patrón de las otras
dos autorizaciones — la migración concreta decide los nombres exactos.

## Plan

1. Migración: `direccion text`, `acepto_direccion boolean`, `direccion_version
   text`, `direccion_at timestamptz` en `proveedores`; `proveedores_publicos`
   filtra `direccion` igual que ya filtra las coordenadas.
2. `src/lib/config.ts`: `AUTORIZACION_DIRECCION_VERSION`, junto a las otras
   dos constantes de autorización.
3. `formulario-proveedor.tsx`: `hayUbicacion` pasa a depender solo de
   `zonaTexto`; la comuna se separa como campo opcional; el campo de dirección
   con su casilla y el `<details>` con el texto legal completo.
4. Texto legal de la autorización de dirección, con el mismo formato que ya
   usa `docs/legal/PLANTILLAS.md` para las otras autorizaciones, revisado por
   abogado antes de producción — se anota en `docs/PENDIENTES-LEGALES.md`.
5. `CLAUDE.md`: la regla de producto 10 y el mínimo legal 2.

## Revisión

Se revisa si, con el `<details>` plegado, aparece un reclamo de habeas data de
alguien que dice no haber visto el nombre del responsable — ahí hace falta
reconsiderar si el texto corto de la casilla es suficientemente claro sobre
que existe un texto largo debajo, no solo confiar en que el `<details>` se
note.
