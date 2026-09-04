# ADR 0014 · Se retira el módulo de insumos

- **Estado:** aceptada
- **Fecha:** 2026-08-28
- **Decide:** responsable del proyecto
- **Retira:** el módulo 2 de `CLAUDE.md`, «Insumos»

## Contexto

El módulo nació con el sismo del 10 de agosto de 2026. Quien necesitaba algo
publicaba qué le faltaba —agua, alimentos, cobijas, aseo— y quien podía
respondía. Alrededor de eso vive hoy:

- **Cinco pantallas**: `/publicar`, `/ayudas` con su cruce inverso,
  `/responder/<codigo>`, `/ofertadores` y la mitad de `/mis-solicitudes`.
- **El tipo de perfil `ofertador`**, con su inventario en `ofrecimientos` y su
  cruce contra lo que se está pidiendo.
- **428 líneas de dominio**, su contrato de cinco procedimientos, y cinco
  tablas: `solicitudes`, `solicitud_items`, `ofrecimientos`, `respuestas` y
  `metricas`.

## Por qué se va

**Ya no es el enfoque.** AquíVe es el directorio del rebusque: quien vive de su
trabajo publica su ficha y quien necesita ese trabajo lo encuentra. Pedir
*cosas* es otra aplicación, y tenerla dentro obliga a que la primera pregunta
que se le hace a alguien que acaba de entrar sea si va a ofrecer insumos.

**Y estaba muerto.** Al decidirlo, en producción había **0 solicitudes, 0
respuestas y 0 ofrecimientos**. En el entorno de pruebas hay 2 solicitudes —del
propio responsable— y 20 ofrecimientos, todos de semilla. Nunca se usó.

**Ni siquiera tenía puerta.** El inicio dejó de enlazarlo en algún momento y
nadie lo notó. Hoy solo se llega desde dos filas de `/perfil`, desde
`como-funciona`, desde un enlace duro dentro de `PuertaCerrada` y escribiendo la
URL.

**Un módulo que nadie mantiene es el que un día se despierta con un fallo.** Es
la misma frase del ADR 0007 y sigue siendo verdad: enterrarlo sin borrarlo deja
código sin ruta que llega igual a producción y tablas que una función lee
aunque nadie las escriba.

**Y el aviso de privacidad ya lo prometió.** `/privacidad` dice desde hace
semanas que la ayuda de emergencia «dejará de operar cuando deje de ser útil» y
que entonces «eliminaremos sus bases de datos». Esto es cumplir lo publicado, no
cambiarlo.

## Decisión

Se borra entero: código, rutas y tablas.

| Tabla | Qué era |
| --- | --- |
| `solicitudes` | Lo que alguien pedía, con 72 h de vida |
| `solicitud_items` | Los ítems de cada una |
| `ofrecimientos` | El inventario declarado de quien ofrecía |
| `respuestas` | Quién respondió a qué |
| `metricas` | El contador anónimo del módulo |

Con ellas se van las vistas `solicitudes_publicas`, `ofertadores_publicos`,
`municipios_con_solicitudes`, `municipios_con_ofertadores` y `v_cruces`, la
tarea de `pg_cron` que vencía solicitudes a las 72 h, y el tipo de perfil
`ofertador`.

**El chat pasa de cinco orígenes a cuatro.** El ADR 0009 dice que un hilo cuelga
de una de cinco cosas; desde aquí son cuatro. Se va `chats.respuesta_insumo_id`,
y con ella su rama del `CHECK chats_un_origen`.

## ⚠ Lo que NO se toca

Cuatro cosas que parecen de este módulo y no lo son. Borrarlas rompe otros dos.

| Cosa | Por qué se queda |
| --- | --- |
| **`/solicitudes`** | Es «Solicitudes de **servicio**», no de insumos, y es la única entrada al chat de servicio |
| **`catalogo_items` y `sugerencias_item`** | `entregas.item_id` y `entregas.sugerencia_id` son llaves foráneas contra ellas: son el vocabulario con el que un centro de acopio registra lo que entra y lo que sale (ADR 0008). Y `sugerencias_item.tipo = 'oficio'` es del ADR 0013 |
| **`entregas`** | Es de acopios. Guarda `solicitud_codigo` como texto y sin llave foránea, justo para sobrevivir a esto |
| **`push_ofertadores`** | ⚠ El nombre engaña: es la **única** tabla de suscripciones push de toda la aplicación. La llena `/perfil/avisos` y la lee el chat. Se **renombra** a `push_avisos` |

La que sí se va con ellas es `push_suscripciones`, que llevaba meses sin que
nadie la escribiera.

## Alternativas consideradas

**Dejarlo enterrado: quitar las puertas y no borrar nada.** Se descarta por lo
que ya escribió el ADR 0007: código sin ruta llega igual a producción, y un
módulo que nadie mira es donde aparece el fallo que nadie espera. Además el
módulo ya está medio enterrado —el inicio no lo enlaza— y eso no ha hecho que
envejezca mejor, solo que nadie lo mire.

**Borrar las pantallas y dejar las tablas.** Se descarta porque `respuestas`
sostiene un brazo de `mis_avisos` y una columna de `chats`. Una tabla que nadie
escribe pero que una función sigue leyendo es exactamente cómo se rompieron once
funciones a la vez la última vez.

**Esperar a la siguiente emergencia.** Se descarta porque no hay que esperar
nada: el código está en el historial y el ADR dice qué había. Si vuelve a hacer
falta, vuelve mejor pensado y no arrastrando el tipo `ofertador` por el modelo
de cuentas durante un año.

## Qué reglas duras cambian de garante

| Regla | Hoy la sostiene | Después | Con qué se compensa |
| --- | --- | --- | --- |
| Regla 2 · el hilo muere con lo que lo abrió | Cinco columnas con `on delete cascade` | Cuatro | Ninguna compensación hace falta: se va una columna, no una garantía |
| Regla 3 · «Solicitud de insumos: 72 h, renovable» | `expirar_solicitudes` en `pg_cron` | — | La fila desaparece de la tabla de vidas |
| Regla 3 · borrar es `DELETE` | Igual | Igual | Sin cambios: las tablas se borran de verdad, con sus imágenes |

El mínimo legal no cambia de garante. Al contrario: desaparece un tratamiento
de datos personales entero, y con él la mitad del aviso de privacidad que
describía dos responsables distintos.

## Consecuencias

- **Se pierde la única vía por la que alguien pedía cosas y no trabajo.** Es una
  pérdida real aunque nadie la usara, y cae sobre el público que la aplicación
  busca. Queda el muro de comunidad —«lo que sobra y lo que falta»— que cubre
  parte de eso, pero sin cruce automático ni avisos.
- Desaparece el tipo `ofertador`. Los perfiles que lo tenían pasan a `vecino`
  (ver ADR 0015), y con ellos su teléfono deja de ser público.
- `/mis-solicitudes` queda con una sola lista, así que pierde sus dos títulos de
  sección.
- El primer tipo de aviso de `/perfil/avisos` —«Alguien pidió algo en tus
  municipios»— se queda sin quien lo emita y pasa a decir que no llega.
- `/datos` pierde la mitad de sus cifras, las que salían de `metricas`.
- Hay que reescribir el aviso de privacidad, los términos y la plantilla de
  autorización, que nombran el módulo. `docs/legal/CONTRATO-TRANSMISION.md` es
  entero de este flujo: se marca como retirado y **no se reescribe sin el
  responsable**.

## Plan

1. Este ADR, y el 0015 detrás.
2. La cuenta nueva **primero** (ADR 0015): `/registro` es hoy la única puerta
   que crea un perfil, y borrarla antes deja la aplicación sin entrada.
3. Desenchufar de la interfaz, en un commit aparte del borrado.
4. Borrar código: pantallas, huérfanos, contrato, dominio, chat, tipos.
5. El SQL, en este orden dentro del archivo: reescribir `mis_avisos` **antes**
   de los `drop table` —es `language sql` y Postgres no registra la dependencia,
   así que el `drop` tiene éxito y la función queda rota en silencio—, después
   funciones, vistas, el `CHECK` de `chats` en la misma transacción que su
   columna, y por último las tablas.
6. `npm run db:pull` y `npx tsc --noEmit`. Eso es lo que convierte «creo que lo
   borré todo» en un error de compilación.

## Revisión

Se vuelve a mirar si vuelve una emergencia con la fundación operando acopio y se
comprueba que el muro de comunidad no alcanza para coordinarla. Entonces el
módulo vuelve, con el cruce pensado desde el principio y sin un tipo de perfil
propio.
