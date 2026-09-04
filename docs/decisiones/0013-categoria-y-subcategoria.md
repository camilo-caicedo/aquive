# ADR 0013 · Categoría y subcategoría, en los dos lados

- **Estado:** aceptada
- **Fecha:** 2026-08-27
- **Decide:** responsable del proyecto
- **Modifica:** el ADR 0011 —vuelve la lista, con la salida escrita siempre
  delante— y la regla de producto 4 de `CLAUDE.md`

## Contexto

El ADR 0011 quitó el catálogo de oficios del primer paso de «Necesito un
servicio» y lo dejó en una categoría y una línea escrita. La razón era buena:
eran cuarenta y tantas píldoras visibles a la vez, y quien no encontraba la
suya recorría todas y se iba.

La cura se pasó de largo. Hoy **no se puede afinar nada**, ni siquiera cuando
el catálogo tiene exactamente lo que la persona necesita. El tablero dice
«Arreglos de la casa» donde podría decir «Pintura de casas y locales», el
filtro por oficio no existe para quien pide, y
`solicitudes_servicio.oficio_id` quedó como una columna anulable que nadie
escribe — el propio ADR 0011 lo anotó como consecuencia neutra: «una columna
que dentro de un año alguien va a preguntar qué hace».

Del otro lado el problema es el contrario, y el ADR 0012 acaba de empeorarlo.
El catálogo pasó de 44 oficios a 81, y la ficha del prestador los pinta
**todos a la vez** en un solo `fieldset`: doce encabezados de grupo y ochenta y
una píldoras, en un teléfono, dentro de un formulario que ya tiene diez
secciones.

Lo que faltaba en el 0011 no era quitar la lista. Era que la salida —«esto que
hago no está»— estuviera a la vista, en vez de al final de cuarenta píldoras.

## Decisión

**Categoría → subcategoría, en los dos lados, con una salida escrita siempre
visible.**

*Categoría* es `catalogo_oficios.grupo`: los doce del ADR 0012. *Subcategoría*
es una fila de `catalogo_oficios`: las ochenta y una. No se inventa ninguna
tabla; se usa lo que ya hay y se llama por su nombre en toda la interfaz.

### Quien pide

Elige categoría, y solo entonces ve las subcategorías de esa categoría. Doce
píldoras primero, siete u ocho después — nunca ochenta y una juntas.

- **La subcategoría es obligatoria.** Se elige de la lista o se agrega la
  propia. No hay tercera puerta.
- **El detalle pasa a opcional.** Era obligatorio de 3 a 80 caracteres; ahora
  sirve para dar contexto —«la pieza de atrás, unos 12 m²»— y no para
  identificar la solicitud, que es trabajo de la subcategoría.
- La tarjeta del tablero pasa a titularse con el nombre de la subcategoría. Es
  lo que el ADR 0011 quería —«más útil para quien decide si puede hacerlo»— y
  ahora se consigue sin depender de que la persona escriba bien.

### Quien ofrece

Tres pasos dentro de la sección que ya existe, no tres pantallas más:
categorías, subcategorías **solo de esas categorías**, y precios **solo de las
combinaciones elegidas**. Cada paso con una línea que dice qué se hace ahí y
qué viene después.

Editando una ficha ya publicada el stepper abre en el paso 3: nadie debería
recorrer tres pasos para corregir un precio.

### La salida, en los dos

«¿No encuentras lo tuyo? Agrégalo y lo revisamos», **siempre a la vista**, no
detrás de un desplegable ni al final de la lista. Esconderla la anula, y
esconderla es exactamente lo que el ADR 0011 vino a arreglar.

Lo que se escribe entra en la cola de `/admin` como `sugerencias_item` con
`tipo = 'oficio'` —la columna y su `CHECK` ya existen y nunca se usaron— y el
administrador puede corregir el texto, aprobarlo o **reemplazarlo por algo que
ya exista**, que es la acción que la pantalla ya llama «fusionar».

**Solo se sugieren subcategorías, no categorías.** Una categoría nueva es un
`CHECK` en dos tablas, dos enums de TypeScript y un gajo de la sombrilla que
repartir: no sale de una pantalla, sale de un ADR — como el 0012 de esta misma
mañana.

### Se publica ya, y se revisa después

Sin cambio: lo decidió el ADR 0011 y sigue valiendo. Una solicitud con
subcategoría propuesta sale al tablero de inmediato, con el texto propuesto y
su sello, porque quien pide necesita respuesta hoy.

Con la **ficha** es distinto y a propósito: un oficio propuesto **no se publica
hasta que alguien lo mire**. No es una decisión de producto, es la forma de la
base — `proveedor_oficios.oficio_id` es llave foránea contra `catalogo_oficios`
y la vista pública hace `join` contra ella, así que lo que no existe en el
catálogo es invisible por construcción. Lo que sí se decide es **no perderlo**:
la propuesta se guarda con su precio ya puesto, y el día que se apruebe entra
en la ficha sola, sin que su dueño tenga que volver.

### El riesgo se elige a mano

Un oficio aprobado por un administrador nace con `riesgo` **elegido
explícitamente**, sin valor por defecto en la pantalla.

La regla de producto 7 cuelga de esa columna: un «cuidar a mi sobrino después
del colegio» aprobado como `bajo` porque el formulario traía `bajo` puesto se
salta el filtro entero —teléfono verificado **y** referencia confirmada— y
aparece en el directorio. El criterio va escrito al lado del selector, con las
mismas palabras del ADR 0012: alto es **quedar a solas con alguien que no puede
defenderse**.

## Alternativas consideradas

**Dejar el 0011 como está y solo arreglar la ficha.** Resuelve la mitad
—la pared de 81 píldoras— y deja al tablero sin poder decir de qué se trata.
El filtro por oficio seguiría existiendo solo para quien ofrece.

**Subcategoría opcional en los dos lados.** Nadie queda atascado nunca, y
vuelven a entrar solicitudes con solo categoría. El filtro se queda grueso para
esas, y como no hay forma de saber cuáles son, es grueso para todas. Descartada
por el responsable.

**Un buscador de texto sobre los 81 oficios, sin categorías.** Es lo que haría
falta si fueran quinientos. Con ochenta y uno repartidos en doce grupos, dos
toques llegan más rápido que escribir, y escribir excluye a quien tiene el
teclado en un teléfono viejo y prisa.

**Que la propuesta de la ficha se publique y se revise después**, como la
solicitud. Tendría que apuntar a algo que no está en `catalogo_oficios`, o sea
`oficio_id` nullable, o sea cirugía sobre una llave primaria de dos columnas y
sobre la vista que sostiene la regla 7. Una ficha es permanente y una solicitud
dura quince días: el costo de esperar no es el mismo.

## Qué reglas duras cambian de garante

| Regla | Hoy | Después |
| --- | --- | --- |
| Regla 4 · quien pide un servicio no elige de un catálogo, escribe | categoría cerrada + detalle obligatorio de 3 a 80 | **categoría + subcategoría del catálogo o propuesta, y el detalle pasa a opcional**. El campo libre sigue con sus tres controles: tope, validación en servidor y filtro que rechaza el envío |
| Regla 4 · los campos libres llevan tope, validación y filtro | el detalle y la nota | **entra un tercero**: el nombre de la subcategoría propuesta, con `validarSugerencia` —tope 60 y `contienePII`—, que ya existe y ya se usa para los ítems de insumos |
| Regla 7 · el oficio de riesgo alto no se publica sin respaldo | cuatro oficios en `alto`, puestos en la semilla | **igual, y con una puerta nueva vigilada**: ahora un oficio puede nacer desde la cola de moderación, y por eso su `riesgo` se elige a mano y sin valor por defecto |
| ADR 0011 · «el primer paso es una categoría y una línea escrita» | — | **una categoría y una subcategoría**. La línea escrita se queda, opcional |

Ninguna del mínimo legal. Ni la subcategoría ni el detalle piden ni admiten
datos de quien pide: son lo que necesita, no quién es.

## Consecuencias

**Positivas.** El tablero dice de qué se trata. Vuelve a haber filtro por
oficio para quien pide, que es lo que hace que un prestador encuentre trabajo
suyo entre veinte solicitudes. La ficha deja de abrir con una pared de ochenta
y una píldoras. Y `oficio_id` vuelve a significar algo.

**Negativas.** Quien pide da un toque más que ayer. Se acepta porque a cambio
no tiene que escribir nada, y escribir en un teléfono viejo cuesta más que
tocar.

Y aparece trabajo de moderación en un sitio nuevo. Es el mismo trato que el ADR
0011 aceptó para el detalle: el costo de admitir texto libre se paga con la
cola.

**Neutras.** `solicitudes_servicio` gana una columna, `sugerencia_id`, y un par
de `CHECK` que impiden el estado absurdo —las dos llenas, o las dos vacías sin
detalle—. Quien **exige** la subcategoría es el borde, no la base: la base solo
impide que entre una solicitud que no dice nada.

## Plan

1. Migración: `sugerencias_item` aprende a llevar oficios; `detalle` pasa a
   anulable; `solicitudes_servicio.sugerencia_id`; la tabla pequeña
   `proveedor_oficios_sugeridos`; las vistas y `sugerencias_pendientes` dicen
   la subcategoría; `resolver_sugerencia` gana la rama de oficio, el nombre
   corregible y el riesgo obligatorio.
2. Contrato y dominio: `publicarSolicitud` y `guardarFicha`.
3. El formulario de pedir, con el paso 1 en dos momentos.
4. El stepper de la ficha.
5. La cola de `/admin/catalogo`, que pasa a distinguir ítem de oficio.

## Revisión

A las pocas semanas, mirar dos números en la cola: **cuántas subcategorías
propuestas se fusionan** con algo que ya existía, y cuántas se aprueban de
verdad.

Si casi todas se fusionan, el problema no es que falten oficios: es que los que
hay no se encuentran, y lo que hace falta es buscador, no catálogo más grande.
Si casi todas se aprueban, la taxonomía se quedó corta otra vez y toca revisar
las categorías enteras.
