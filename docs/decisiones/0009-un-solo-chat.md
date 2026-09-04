# ADR 0009 · Un solo chat, para toda la aplicación

- **Estado:** aceptada
- **Fecha:** 2026-08-26
- **Decide:** responsable del proyecto
- **Depende de:** ADR 0003 (el chat de servicios), ADR 0006 (cuenta para
  todo), ADR 0007 (se retira el flujo acompañado)

## Contexto

Hasta el ADR 0007 había **dos** chats: el trilateral del flujo acompañado
—`conversaciones` y `mensajes`— y el bilateral de los pedidos de servicio
—`chats_servicio` y `mensajes_servicio`—. El 0007 borró el primero, así que
quedó código de chat en un solo sitio.

Pero «uno solo» no era lo mismo que «uno para todo». El que quedó estaba
atado a los servicios por una llave foránea:

```sql
respuesta_id uuid not null references respuestas_servicio(id) on delete cascade
```

Productos, donaciones del muro e insumos **no tenían ninguno**. Ahí el
contacto era el teléfono que quien ofrece publicó en su ficha, por WhatsApp
o por llamada. Y quien no tenía ficha publicada no tenía nada: las dos
donaciones de prueba del muro salían con la frase «esta persona todavía no
tiene ficha publicada, así que aquí no aparece su contacto», que es una
pantalla diciendo que no hay forma de responderle a alguien que está
regalando una nevera.

La otra cara del muro era peor. Quien **necesita** algo no publica nombre ni
teléfono —eso es deliberado y no cambió—, así que nadie podía decirle «yo te
lo consigo».

Y un detalle que solo se ve al ir a probarlo: **el chat de servicios llevaba
desde el ADR 0003 sin puerta.** El hilo se crea al abrirlo, y la única
pantalla que enlazaba a un hilo era la bandeja, que solo enseña los que ya
existen. Nunca se podía abrir el primero.

## Decisión

**Un hilo cuelga de cualquiera de las cuatro cosas que dos personas pueden
tener que acordar**, y de ahí salen sus dos lados.

Las tablas pasan a llamarse `chats` y `mensajes`, sin apellido.

### No es polimórfico: son cuatro columnas

La forma obvia sería un par `(tipo, id)`. No se usa, y la razón es la regla
de producto 3: **el chat muere con lo que lo abrió, y borrar es `DELETE`.**
Un par «tipo + id» no puede llevar `on delete cascade`; habría que sostener
el borrado con código o con un trabajo programado, y entonces la promesa de
borrado depende de que algo se acuerde de cumplirla.

Así que son cuatro columnas anulables, cada una con su llave foránea y su
cascada, y un `check` que obliga a que haya exactamente una:

```sql
alter table chats add constraint chats_un_origen check (
  num_nonnulls(respuesta_servicio_id, respuesta_insumo_id, producto_id, publicacion_id) = 1
);
```

Es más ancha y es correcta. `CLAUDE.md` ya lo dice: la lógica de negocio
sale de Postgres, las garantías de integridad se quedan.

### Los dos papeles se llaman igual en los cuatro módulos

`prestador` y `quien_pide` solo sabían hablar de servicios. Ahora son
**`ofrece`** —tiene la cosa o el trabajo— y **`pide`** —la necesita—, las
mismas dos palabras que ya usaba `publicaciones_muro.cara`.

### Un lado puede estar abierto

Una respuesta —de servicio o de insumo— ya identifica a los dos lados: quien
publicó la solicitud y quien respondió. Un producto y una publicación del
muro solo identifican a uno.

Ahí el otro lado lo ocupa **quien abra el hilo**, y hay un hilo por persona:
`chats.iniciado_por`, con su índice único parcial. Diez personas pueden
preguntar por los mismos tamales sin verse entre ellas.

En el muro, las dos caras son el mismo hilo al revés: en `ofrece` el dueño
de la publicación es quien ofrece, y en `necesita` es quien pide.

### Los botones de WhatsApp y de llamar se quedan

Decisión explícita del responsable, y va contra lo que dice la regla de
producto 2 —que el chat existe porque «sin ese filtro es solo una forma más
lenta de pedir el número»—. La razón para conservarlos:

- Quien publicó una ficha o un producto **puso su teléfono queriendo**. Para
  esa persona WhatsApp es lo natural y quitárselo no la protege de nada.
- Lo que el chat protege es **el otro lado**, que hasta ahora tenía que
  llamar y entregar su número para empezar. Ese lado no tenía puerta fuera
  de servicios, y ahora la tiene.

Así que en una tarjeta van tres controles: WhatsApp ancho, llamar redondo y
el chat redondo. Cuando no hay teléfono publicado, el chat queda solo, y
entonces es la única puerta — que es el caso de las donaciones del muro.

### La bandeja es una

`/mensajes` lista los cuatro orígenes y los dos lados, ordenados por el
último mensaje, con la etiqueta de dónde salió cada hilo. Sin una sección
por módulo: eso sería un segundo nivel de navegación (regla de interfaz 3)
para responder lo que el orden por fecha ya responde.

## Qué se pierde

**Nada de lo que había.** El filtro de datos de contacto, el borrado en
cascada, el rechazo explicado y la ausencia de archivo histórico siguen
exactamente igual, y ahora valen para cuatro módulos en vez de uno.

Lo que sí queda pendiente y conviene tener escrito: **la ficha del prestador
no abre chat.** Una ficha es una persona, no una cosa que caduque, y un hilo
colgado de ella no moriría nunca — que es lo que la regla 3 no permite. Ahí
el contacto sigue siendo el teléfono que esa persona publicó. Si algún día
se quiere, el origen tendría que ser algo con fecha de vencimiento, no la
ficha.

## Corrección · 26 de agosto de 2026

**La ficha sí abre chat.** El párrafo de arriba se queda escrito porque es lo
que se decidió primero, y porque el argumento que lo tumbó importa más que la
conclusión.

El argumento era «una ficha no caduca, y un hilo colgado de ella no moriría
nunca». **No se sostiene**, y bastaba mirar la tabla de la regla 3 para
verlo: un producto de «Hecho en el barrio» tampoco caduca —vive «mientras su
dueño lo deje»— y sí abre chat. Lo que la regla 3 pide no es que el origen
caduque, sino que el hilo **muera con él**, y eso lo da la cascada:
`chats.proveedor_id` con `on delete cascade`. Borrar la ficha borra sus
hilos, igual que borrar el producto borra los suyos.

Lo que quedaba en pie era una preferencia —«una ficha es una persona, no una
cosa de la que hablar»— disfrazada de regla. La consecuencia práctica era
mala: **a un prestador sin productos publicados solo se le podía escribir
dando el teléfono propio**, que es justo el lado que este ADR vino a
proteger.

Así que son cinco orígenes, no cuatro, y el quinto se llama `ficha`. En la
barra de contacto van los tres botones: WhatsApp ancho, llamar y chat.

Migración `v6-a3-el-chat-de-la-ficha.sql`.

## Añadido · Mensajes sin leer

Pedido del responsable el mismo día: que la barra avise cuando hay algo sin
leer.

Sin tabla nueva y sin un `leido` por mensaje: dos columnas en `chats`
—`visto_ofrece_at` y `visto_pide_at`— y un hilo tiene algo sin leer si el
otro lado escribió después de la última vez que yo lo abrí. Marcar mensaje a
mensaje costaría una fila por mensaje y por persona para responder la única
pregunta que hace la interfaz: ¿hay algo o no?

Se llaman por el papel y no por la persona porque el papel es lo que el hilo
ya sabe, y es el mismo en los cinco orígenes.

**Un punto, sin número.** La pregunta de quien mira la barra de reojo es «¿hay
algo?». Un número obliga a enfocar —a 11 px, de pie y con prisa— para
responder lo que el punto ya responde. El escudo de administración sí lleva
número, y ahí sirve: son colas de trabajo, y tres o treinta cambia lo que uno
hace. El número va igualmente en el `aria-label` de la celda, que es lo que
oye quien no ve el punto.

En la bandeja, el hilo sin leer va en negrita **y** con la palabra «Sin
leer»: el estado no depende solo del color ni solo del grosor.

Migración `v6-a4-mensajes-sin-leer.sql`.

## Consecuencias en `CLAUDE.md`

Cambia la regla de producto 2, que decía «un chat se abre por un pedido de
servicio». Cambia la tabla de ciclo de vida de la regla 3, donde «Chat · con
el pedido que lo abrió» pasa a «con lo que lo abrió». Y el mapa de pantallas,
donde el chat deja de vivir en `/servicios/chat/[respuesta]`.

## Migraciones

- `v6-a1-un-solo-chat.sql` — renombra las tablas, añade los tres orígenes
  nuevos, el `iniciado_por` y los `check`.
- `v6-a2-abrir-el-chat-desde-la-solicitud.sql` — `solicitudes_de_servicio`
  devuelve `mi_respuesta_id`, que es lo que le faltaba al chat de servicios
  para tener puerta.
