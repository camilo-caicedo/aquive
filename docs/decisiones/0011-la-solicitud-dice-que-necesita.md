# ADR 0011 · Quien pide elige categoría y escribe qué necesita

- **Estado:** aceptada
- **Fecha:** 2026-08-27
- **Decide:** responsable del proyecto
- **Reemplaza:** la parte de la regla de producto 4 de `CLAUDE.md` que ataba
  la solicitud de servicio a `catalogo_oficios`

## Contexto

El primer paso de «pedir un servicio» pintaba **todos** los oficios activos
del catálogo como píldoras agrupadas por categoría, y no se podía continuar
sin marcar uno: `disabled={!oficioId}`.

Eso funciona mientras el catálogo cubra lo que la gente pide. No lo cubre y no
lo va a cubrir: el rebusque es exactamente el trabajo que no está en ninguna
lista. «Que me arreglen la puerta del clóset», «que me acompañen a una
diligencia», «que me enseñen a usar el datáfono» — quien necesita eso abre la
pantalla, recorre cuarenta píldoras, no encuentra la suya, y se va.

La lista tampoco es corta: son cuarenta y tantos oficios repartidos en ocho
grupos, todos visibles a la vez. En un teléfono eso son varias pantallas de
desplazamiento antes de llegar al segundo paso.

Palabras del responsable: «vamos a tener muchos oficios que posiblemente no
tendremos mapeados».

## Decisión

**El primer paso pasa a ser una categoría y una línea escrita.**

- La **categoría** sale de las ocho de `GRUPOS`, que son los gajos de la
  sombrilla y ya son el lenguaje de toda la aplicación. Es una lista corta,
  cerrada, y se elige de un vistazo.
- El **detalle** lo escribe quien pide, de 3 a 80 caracteres, con el mismo
  filtro de patrones que ya llevan la nota y el chat: rechaza el envío con el
  motivo escrito si trae un teléfono, un correo o una cédula.

`catalogo_oficios` **no desaparece**. Sigue siendo lo que un prestador marca
al publicar su ficha, y lo que gobierna la regla de producto 7 —los oficios de
riesgo alto y los que exigen matrícula—. Lo que deja de hacer es amarrar lo
que otra persona puede pedir.

`solicitudes_servicio.oficio_id` se queda **anulable** en vez de borrarse: las
solicitudes que ya existen conservan su enlace y no se pierde nada. Deja de
escribirse.

### Se publica ya, y se revisa después

Decisión explícita del responsable. Un campo libre en una pantalla pública
pide moderación, y hay dos maneras:

- **Revisar antes de publicar** deja limpia la lista, y hace esperar horas a
  quien necesita algo hoy. Este módulo nació de una emergencia.
- **Publicar y revisar después** es lo que se hace. La solicitud sale al
  tablero de inmediato, entra en la cola «Solicitudes por revisar» de `/admin`
  con `revisada_at` en nulo, y desde ahí se marca revisada o se borra.

Lo que sostiene el suelo mientras nadie ha mirado no es la confianza: es el
filtro de `validarNota` en el servidor, que ya rechaza el envío, más los 80
caracteres de tope. Y sobre la lista pública **no hay ni un dato de quien
pidió**, así que un texto malintencionado no puede llevar a nadie a ninguna
parte.

## Alternativas consideradas

**Categoría + oficio opcional del catálogo + detalle libre.** Conserva el
filtro exacto por oficio cuando el oficio existe. Se descarta porque es un
campo más en el primer paso de un formulario que ya son tres pantallas, y
porque el caso que motiva el cambio —lo que no está en la lista— seguiría
teniendo que saltarse un control.

**Detalle libre y que moderación lo enlace al catálogo.** Da lo mejor de los
dos y cuesta trabajo humano por cada solicitud. La fundación son personas
contadas; una cola que crece con el uso no es una cola, es una deuda.

**Dejar la lista y añadirle un «Otro».** Es lo mismo que se decide, con un
paso extra y con la lista larga todavía delante. Si la salida útil está al
final de cuarenta píldoras, no es una salida.

## Qué reglas duras cambian de garante

| Regla | Hoy | Después |
| --- | --- | --- |
| Regla 4 · los campos libres llevan tope, validación en servidor y filtro | la solicitud no tenía campo libre salvo la nota | **el detalle es el segundo, y lleva los tres**: 80 en el `CHECK`, `validarNota` en el dominio y rechazo con motivo |
| Regla 7 · el oficio de riesgo alto no se publica sin respaldo | `catalogo_oficios.riesgo` filtra la consulta de **prestadores** | **igual, sin cambio**: la regla vive en quién ofrece, no en quién pide, y pedir cuidado de un niño nunca estuvo restringido |

Ninguna del mínimo legal. El detalle no pide ni admite datos de la persona: es
lo que necesita, no quién es.

## Consecuencias

**Positivas.** Se puede pedir lo que a uno le pasa. El primer paso baja de
cuarenta píldoras a ocho, que caben en una pantalla. Y el tablero pasa a decir
«Arreglar la puerta del clóset» en vez de «Reparaciones del hogar», que es más
útil para quien decide si puede hacerlo.

**Negativas.** El filtro del tablero pierde precisión: se filtra por categoría,
no por oficio, así que un carpintero ve todas las reparaciones. Se acepta
porque el volumen todavía es pequeño y porque el detalle escrito se lee de un
vistazo en la tarjeta. Si algún día el tablero es largo, hace falta buscador de
texto, no volver al catálogo.

Y aparece trabajo de moderación que antes no existía. Es el costo de admitir
texto libre, y se paga con la cola.

**Neutras.** `oficio_id` queda como columna anulable y sin escribir. No estorba,
pero es una columna que dentro de un año alguien va a preguntar qué hace.

## Plan

1. Migración: `grupo`, `detalle` y `revisada_at`; `oficio_id` anulable; relleno
   de las filas que ya hay con lo que su oficio decía; la vista pública y la
   RPC del tablero pasan a hablar de grupo y detalle.
2. Contrato y dominio: `publicarSolicitud` cambia `oficio_id` por `grupo` y
   `detalle`.
3. El formulario, el tablero y el asunto del hilo de chat.
4. La cola de `/admin`.

## Revisión

Cuando el tablero de un municipio pase de una pantalla de largo. Ahí el filtro
por categoría deja de bastar y toca decidir entre buscador de texto y volver a
un catálogo — y para entonces habrá cientos de detalles escritos con los que
saber cuáles son los oficios de verdad.
