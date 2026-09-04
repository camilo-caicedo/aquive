# ADR 0017 · La solicitud es una orden dirigida a un prestador

- **Estado:** aceptada
- **Fecha:** 2026-09-03
- **Decide:** responsable del proyecto
- **Depende de:** ADR 0016, que retira el tablero público que esta decisión
  reemplaza

## Contexto

El ADR 0016 retiró `/solicitudes` porque era un tablero público: cualquier
prestador podía mirarlo y responder cualquier pedido. Lo que no retiró es la
necesidad de fondo — quien busca un servicio sigue teniendo que poder pedirlo
sin depender solo de un botón de WhatsApp.

Hoy `solicitudes_servicio` **no tiene destinatario**. La propia página lo dice
en su comentario, `src/app/solicitudes/page.tsx:16-20`: «Es público —cualquiera
puede mirarlo, y no hay nada que identifique a quien pidió— pero responder
exige tener ficha publicada.» La tabla, en `supabase/migraciones/v3-s1-
esquema.sql:296-320`, no lleva ninguna columna que apunte a un prestador —
quien responde lo hace desde `respuestas_servicio`, que el ADR 0016 también
retira. Y el `CHECK` de `estado` solo admite dos valores: `abierta`, `resuelta`.

El cliente pide lo contrario de un tablero: que la solicitud nazca **para
alguien concreto**, desde su ficha, igual que ya se hace al escribirle por el
chat. Y pide un ciclo de vida con más matices que «abierta o resuelta»:
pendiente, aceptada, realizada, rechazada, no concretada — los cinco estados
por los que pasa de verdad un encargo entre dos personas.

## Decisión

La solicitud deja de ser un pedido al aire y pasa a ser una orden dirigida.

### `proveedor_id` obligatorio, con cascada

`solicitudes_servicio` gana una columna `proveedor_id uuid not null references
proveedores(id) on delete cascade`. No es opcional ni se rellena después: una
solicitud nace ya dirigida a la ficha desde la que se pidió. La cascada es la
misma regla de producto 3 de siempre — lo que cuelga de una ficha muere con
ella, no queda huérfano apuntando a nada.

### Cinco estados, los que pide el cliente

El `CHECK` de `estado` pasa de `abierta | resuelta` a:

```
pendiente | aceptada | realizada | rechazada | no_concretada
```

Son los cinco, textuales, del documento del cliente. `pendiente` es el estado
de nacimiento; `aceptada` y `rechazada` son la respuesta del prestador;
`realizada` cierra bien; `no_concretada` cierra sin que el trabajo se haya
hecho, sin necesidad de decir de quién fue la culpa.

### Quién la ve y desde dónde

El prestador la gestiona desde su propio perfil — es trabajo dirigido a él,
no una lista que recorrer. Quien pidió la ve en `/mis-solicitudes`, que ya
existe como destino en la tabla de pantallas de `CLAUDE.md` para el grupo
Perfil.

### La caducidad de 15 días no puede seguir siendo una sola regla

La regla de producto 3 de `CLAUDE.md` fija hoy: «Solicitud de servicio: 15
días, renovable.» Esa cifra se pensó para un pedido al aire, donde 15 días sin
respuesta significan que nadie se interesó. Una orden dirigida es distinta: si
el prestador ya la **aceptó**, vencerla a los 15 días borra un compromiso en
marcha por una fecha que no tiene nada que ver con cuánto tarda el trabajo.

Se propone que la caducidad automática **solo alcance al estado `pendiente`**:
una orden que nadie contestó en 15 días se cae sola, igual que hoy. Una orden
`aceptada` no vence — cierra cuando el prestador la marca `realizada` o
`no_concretada`, o si la rechaza tarde, `rechazada`. Queda como consecuencia
que hay que resolver en el código, no fijada aquí como regla cerrada: falta
decidir si una orden `aceptada` sin movimiento durante mucho tiempo necesita
igual algún límite, para que no queden órdenes "en curso" para siempre en la
base de un prestador que dejó de usar la cuenta.

## Consecuencia no prevista · el pedido solo ofrece lo que el prestador ya declaró

Al probar el flujo completo apareció algo que este ADR no había mirado: el
formulario de `/servicios/publicar` seguía trayendo `servidor.servicios.
subcategorias()` —el catálogo entero, 81 oficios en doce categorías— cuando
`servidor.servicios.ficha()` ya devuelve `oficios`, los de ESE prestador y
con su precio.

Ofrecerle a quien pide un oficio que el prestador elegido no hace es el
mismo problema que el ADR 0016 vino a resolver, solo que con un paso de
categoría de más delante: un tablero abierto disfrazado de formulario
dirigido. La solicitud nace con `proveedor_id`, así que su universo de
oficios posibles ya no es el catálogo — es `ficha.oficios`.

Cambia el formulario:

- Solo se listan los oficios que esa ficha declaró. Si son tres, son tres
  opciones; si es uno solo, no se hace elegir — se muestra y ya.
- **Desaparece el paso de categoría.** El `grupo` se deriva del oficio
  elegido, comprobado contra `proveedor_oficios_publicos` —que además
  aplica la regla de producto 7, así que un oficio de riesgo alto escondido
  por falta de verificación tampoco se puede pedir por aquí—. No tiene
  sentido preguntarle a alguien una categoría que el oficio ya contesta.
- **Desaparece «¿No encuentras lo tuyo? Agrégalo»** en este formulario, y
  `subcategoria_nueva` sale del `input` de `publicarSolicitud`. Esa salida
  del ADR 0013 existía porque el universo era el catálogo entero — ahí
  faltaba un botón de escape porque cuarenta y tantas píldoras nunca
  alcanzan a todo el mundo. Aquí el universo son los tres o cuatro oficios
  que ESA persona declaró, y proponerle una subcategoría que no tiene
  sentido en su ficha es exactamente el tablero abierto que este ADR
  reemplaza. **Del lado de la ficha del prestador el ADR 0013 no se toca**:
  ahí la sugerencia sigue viva, porque ahí sí se está describiendo el
  catálogo entero.

Sin cambio de migración: `solicitudes_servicio.sugerencia_id` se queda en la
tabla —sigue sirviendo del lado de la ficha— simplemente ya no lo llena
`publicarSolicitud`.

## Consecuencia no prevista · el hilo nace con la orden

El cliente, probando lo mismo: al enviar el pedido la pantalla llevaba a
«pedido enviado» con un enlace a `/mis-solicitudes`, y el chat de la ficha
—`chats.proveedor_id`— quedaba como un canal aparte, sin el detalle de lo
que se pidió a la vista de ninguno de los dos lados.

Se agrega una cuarta columna a `chats` —hoy tiene tres activas: producto,
publicación del muro y ficha—: `solicitud_servicio_id`, con la misma
cascada de siempre y el mismo argumento del ADR 0009 para no hacerla un
par `(tipo, id)`. A diferencia de la ficha, el producto y la publicación
del muro, una orden **ya identifica a los dos lados desde que nace**
—`solicitudes_servicio.perfil_id` es quien pide, `proveedor_id` dice quién
ofrece—, así que:

- El hilo se crea en la MISMA operación de `publicarSolicitud`, no al
  abrirlo: no hay que esperar a que alguien entre para saber quiénes son
  los dos lados, ya se sabe.
- Su `unique` es simple, no un índice parcial contra `iniciado_por` como en
  los otros tres orígenes: solo puede existir un hilo por orden, y
  `iniciado_por` se queda en `null` — lo exige el mismo `check
  chats_iniciado_por_donde_toca` de siempre, sin tocarlo.
- Al enviar el pedido, la pantalla lleva directo a `/chat/solicitud/<id>` en
  vez de a una pantalla de confirmación aparte.
- Ese chat abre con una tarjeta fija arriba —el oficio pedido, su precio
  «desde», el detalle, la nota y el estado— para que los dos lados vean
  qué se necesita sin salir de la conversación. Del lado del prestador, ahí
  mismo van los botones de aceptar, rechazar, marcar realizada o marcar no
  concretada, reusando `src/server/servicios/transiciones.ts`.
- `/perfil/solicitudes-recibidas` se queda como índice de sus órdenes, pero
  cada fila lleva a su chat: el sitio donde se acuerda y donde se cambia el
  estado es la conversación, no dos pantallas compitiendo por lo mismo
  (regla de interfaz 3).

Migración: extiende `v6-f4-la-solicitud-es-una-orden.sql`, que ya existía y
no se había aplicado en ninguna base — se completa en vez de encadenarse
otra. `chats_un_origen` pasa de tres a cuatro columnas: `producto_id`,
`publicacion_id`, `proveedor_id`, `solicitud_servicio_id`.

## Alternativas consideradas

**Mantener el tablero pero filtrado por oficio del prestador**, en vez de
dirigir la solicitud a una ficha concreta. Se descarta porque no resuelve lo
que el ADR 0016 vino a arreglar: seguiría siendo el prestador quien tiene que
entrar a mirar, solo que a una lista más corta.

**Un solo estado `activa` con un campo de texto libre para el detalle del
avance.** Más simple de migrar, pero pierde justo lo que el cliente pidió por
escrito — los cinco estados con nombre, que son los que van a aparecer en la
interfaz de `/mis-solicitudes` y en el panel del prestador. Un campo de texto
no se puede filtrar ni contar.

**Dejar la caducidad de 15 días igual para todos los estados.** Es lo que hay
hoy y es lo que se identifica como problema en la sección de decisión: borra
compromisos en marcha por una fecha pensada para pedidos sin dueño.

## Qué reglas duras cambian de garante

| Regla | Hoy | Después |
| --- | --- | --- |
| Regla de producto 3 · `on delete cascade` | la solicitud no colgaba de ningún prestador | **cuelga de `proveedor_id`**, con `on delete cascade`: la orden muere con la ficha que la recibió |
| Regla de producto 3 · «Solicitud de servicio: 15 días, renovable» | vale para todos los estados | **vale solo para `pendiente`**; `aceptada` no caduca sola |
| `CHECK` de `estado` | `abierta \| resuelta` | `pendiente \| aceptada \| realizada \| rechazada \| no_concretada` |

Nada del mínimo legal cambia: la solicitud sigue sin llevar más dato de quien
pide que su cuenta, igual que fija el ADR 0006, y sigue sin coordenadas ni
nada más fino que barrio, que es lo que el ADR 0004 dejó explícitamente fuera
de discusión.

## Consecuencias

### Positivas

- Un prestador recibe la orden en su perfil en vez de tener que ir a buscarla,
  que es exactamente lo que el ADR 0016 retiró del lado del tablero.
- Los cinco estados dan a `/mis-solicitudes` y al panel del prestador algo
  concreto que mostrar, con sello y color, en vez de un genérico «abierta».
- Una orden aceptada deja de estar a merced de un reloj que no sabe si el
  trabajo ya empezó.

### Negativas, y hay que decirlo sin adornos

**Se pierde el descubrimiento.** Un prestador ya no se entera de una
necesidad que nadie le dirigió — antes, aunque fuera mirando un tablero
incómodo, veía pedidos de gente que no lo conocía. Ahora solo le llegan
órdenes de quien ya encontró su ficha. Si el directorio no se encuentra bien,
esta puerta tampoco se abre. Es la misma apuesta que anota el ADR 0016: que un
buen directorio compensa lo que se pierde al apagar el tablero.

También se pierde la respuesta rápida de "cualquiera que esté libre ahora
mismo" — con destinatario fijo, si el prestador elegido no contesta, quien
pidió tiene que ir a buscar otra ficha y volver a pedir, en vez de que el
sistema le muestre a quien sí respondió primero.

### Neutras

`respuestas_servicio` ya se retiró con el ADR 0016; esta decisión no la
resucita — la orden no necesita una tabla de respuestas porque solo hay un
destinatario posible.

## Plan

1. Migración: `proveedor_id not null references proveedores(id) on delete
   cascade` en `solicitudes_servicio`; reescribir el `CHECK` de `estado` con
   los cinco valores; ajustar el cron o la función que hoy vence solicitudes
   a los 15 días para que solo alcance `estado = 'pendiente'`.
2. Contrato: la solicitud se crea desde la ficha del prestador, así que el
   procedimiento de publicar pasa a exigir `proveedor_id`.
3. Dominio: las transiciones de estado — quién puede pasar de `pendiente` a
   `aceptada` o `rechazada`, y de `aceptada` a `realizada` o `no_concretada` —
   viven en `src/server/servicios/`, no en la base ni en el cliente.
4. Pantallas: el panel del prestador para gestionar sus órdenes, y
   `/mis-solicitudes` con los cinco estados.

## Revisión

Se revisa si, sin caducidad para `aceptada`, aparecen órdenes que quedan
"en curso" indefinidamente porque nadie las cierra — ahí hace falta decidir un
límite para ese estado también, y no solo para `pendiente`.
