# ADR 0016 · La versión mínima: fuera el muro de necesidades y las solicitudes abiertas

- **Estado:** aceptada
- **Fecha:** 2026-09-03
- **Decide:** responsable del proyecto
- **Reemplaza:** el ADR 0003 en su alcance, y el ADR 0011 y el ADR 0013 **del
  lado de quien pide** — del lado de la ficha del prestador el ADR 0013 sigue
  vigente: categoría → subcategoría se queda
- **Fuente:** documento de comentarios del cliente, tras probar la aplicación
  en teléfono, entregado el 3 de septiembre de 2026

## Contexto

El cliente probó la aplicación en su teléfono y volvió con un documento, no con
una lista de gustos. Dos frases lo resumen. Sobre el tablero de solicitudes de
servicio: «No queremos que los prestadores tengan que revisar constantemente
una lista de solicitudes para encontrar trabajo». Sobre el muro de
necesidades: «podría acumular solicitudes imposibles de atender».

Las dos apuntan al mismo defecto de diseño, no a dos defectos distintos: un
tablero público de pedidos abiertos —el de servicios en `/solicitudes`, el de
insumos en `/ayudas`— le pide a quien puede ayudar que vigile una cola que
crece sola y que nadie cierra. Cuando la cola crece más rápido de lo que se
atiende dice justo lo contrario de lo que promete: que aquí nadie responde.

La orden de cierre del cliente es literal: **«NO AGREGAR MÁS FUNCIONES POR
AHORA»**. Y el criterio con el que va a medir si esto funcionó también:
**una persona mayor tiene que poder entrar, entender qué hacer, encontrar un
servicio y contactar a alguien, sin que nadie le explique la pantalla.** Un
tablero de pedidos ajenos no ayuda a esa persona a encontrar un servicio; le
pide que además atienda los pedidos de los demás.

Esto no es una poda de UI. Es que el proyecto tiene, desde su origen, dos
maneras de conectar a dos personas: **quien pide publica y espera** —el
tablero, el muro de necesidades— o **quien pide busca y contacta** —el
directorio, la ficha. El cliente, con la app ya en la mano, eligió la segunda
para todo lo que queda. Los tres módulos que se van son las tres formas que
tomaba la primera.

## Decisión

Se elimina todo lo que depende de que alguien publique un pedido y espere a
que otra persona lo encuentre y responda.

### El módulo de insumos, entero

Nace del módulo de emergencia y es la pieza más grande que se retira:

- Rutas: `src/app/ayudas/`, `src/app/publicar/`, `src/app/responder/[codigo]/`,
  `src/app/ofertadores/`, `src/app/admin/solicitudes/`,
  `src/app/@modal/(.)publicar/`.
- Contrato: `src/contrato/insumos.ts`.
- Dominio: `src/server/insumos/solicitudes.ts`.
- El bloque `insumos:` de `src/orpc/servidor.ts` (línea 146 en adelante).
- `src/lib/push-ofertadores.ts`.
- Tablas: `solicitudes`, `solicitud_items`, `respuestas`.
- Vistas: `solicitudes_publicas`, `v_cruces`, `municipios_con_solicitudes`.

⚠ **Dos tablas que este ADR listó para borrar y no se borran.** Se
descubrió al ejecutarlo, y quedan escritas aquí porque el nombre de las dos
engaña:

- **`push_ofertadores`** no es del módulo de insumos aunque lo diga su
  nombre. Es la suscripción de Web Push **de toda la cuenta**, y hoy la usa
  `avisar()` en `src/server/chat/hilo.ts` para notificar cualquier mensaje
  de chat. Borrarla habría dejado la aplicación entera sin notificaciones,
  que es un daño mayor que el que este ADR pretende evitar. Se queda, y lo
  que hay que hacer algún día es cambiarle el nombre.
- **`catalogo_items`** la usan `/registro`, `/admin/catalogo` y el panel de
  acopio, tres pantallas vivas y fuera de este ADR. Se queda.

### El tablero público de solicitudes de servicio

`src/app/solicitudes/page.tsx` dice de sí mismo, en su propio comentario
(líneas 16-20 de hoy): «Es público —cualquiera puede mirarlo, y no hay nada
que identifique a quien pidió— pero responder exige tener ficha publicada.» Es
justo la forma que el cliente rechaza: **cualquier prestador con ficha puede
mirar y responder cualquier pedido**, así que responder es competir por verlo
primero, no que a uno le llegue un encargo.

Se retira la ruta y las dos funciones SQL que la sostienen,
`solicitudes_de_servicio` y `responder_servicio`, y la tabla
`respuestas_servicio`.

### La cara «necesita» del muro

El muro tenía dos caras: lo que sobra y lo que falta. La cara «falta» es un
tablero de pedidos otra vez, con el mismo defecto. Se retira.

La cara «ofrece» **sobrevive**, porque es donaciones —objetos, no pedidos— y
es justo lo que el cliente quiere conservar. Cambia de nombre y de ruta:
`/muro` pasa a **`/donaciones`**, porque sin la cara «necesita» ya no hay dos
caras que un nombre neutro tenga que cubrir.

### El chat pierde dos de sus cinco puertas

Consecuencia estructural, no un detalle de limpieza. Hoy `chats` cuelga de
cinco columnas —`respuesta_servicio_id`, `respuesta_insumo_id`, `producto_id`,
`publicacion_id`, `proveedor_id`— cada una con su `on delete cascade`, tal
como fija el ADR 0009 y la regla de producto 2 de `CLAUDE.md`. Con la orden y
el tablero fuera, dos de esas cinco pierden la tabla de la que dependían:

- `respuesta_insumo_id` desaparece con `respuestas`.
- `respuesta_servicio_id` desaparece con `respuestas_servicio`.

`chats` baja a **tres orígenes**: `producto_id`, `publicacion_id`,
`proveedor_id`. El `CHECK chats_un_origen` pierde sus dos ramas, igual que
`chats_iniciado_por_donde_toca`, que ya no necesita mencionarlas porque nunca
las mencionó — las dos columnas que se van identificaban a los dos lados
desde que nacían, así que no aportaban a esa constraint.

El ADR 0009 **no se rompe**: sigue siendo un solo chat para toda la
aplicación, con menos puertas por las que entrar. El chat de la ficha
(`proveedor_id`) pasa a ser el único canal de todo lo de servicios — lo que
antes hacía `respuesta_servicio_id` para una solicitud puntual, ahora lo hace
la conversación que ya vive en la ficha, y es sobre esa base que el ADR 0017
construye la orden dirigida.

## Alternativas consideradas

**Dejar el tablero y moderarlo mejor.** No ataca el problema. El cliente no
dijo «el tablero tiene pedidos malos»: dijo que un prestador no debería tener
que revisarlo. Una cola bien moderada sigue siendo una cola que hay que
revisar.

**Limitar cuántos pedidos puede tener abiertos un municipio a la vez.** Evita
que la cola crezca sin límite, pero no cambia que sea el prestador quien tiene
que ir a mirarla. Sigue siendo publicar y esperar.

**Quitar solo insumos y dejar el tablero de servicios**, razonando que uno
nació de una emergencia y el otro no. Se descarta porque las dos frases del
cliente hablan de estructuras idénticas — un tablero público de pedidos — y
dejar una mitad no resuelve el criterio de aceptación: una persona mayor sigue
sin saber si algo de lo que ve en un tablero es para ella.

## Qué reglas duras cambian de garante

| Regla | Hoy | Después |
| --- | --- | --- |
| Regla de producto 2 · `chats` con `on delete cascade` por columna | cinco columnas | **tres columnas**: `producto_id`, `publicacion_id`, `proveedor_id`. El `CHECK chats_un_origen` se reescribe sin las dos que se van |
| Regla de producto 3 · qué vive y cuánto | «Solicitud de insumos: 72 h» y «Solicitud de servicio: 15 días» en la tabla | **las dos filas se retiran de la tabla**: la primera porque el módulo desaparece, la segunda porque el ADR 0017 la reemplaza por una orden con otro ciclo de vida |
| Mínimo legal 1 y 2 | se aplicaban también al tablero de insumos y al de servicios | sin cambio de fondo: se aplican a menos superficie, no a menos garantía |

Nada del mínimo legal se relaja: se elimina superficie, no se debilita ningún
control sobre la que queda.

## Consecuencias

### Positivas

- Desaparece la única pantalla del proyecto donde a un prestador se le pedía
  trabajo de vigilancia en vez de trabajo de oficio.
- El alcance vuelve a caber en una frase: buscar, contactar, acordar por
  fuera. Eso es exactamente lo que el criterio de aceptación del cliente pide
  que una persona mayor entienda sin ayuda.
- Tres tablas menos, tres vistas menos, un módulo de contrato menos que
  mantener migrado bajo el ADR 0001.

### Negativas, y hay que decirlas sin adornos

**El módulo de emergencia con el que nació la fundación deja de existir como
tal.** Quien necesita algo —una emergencia real, no solo un oficio— ya no
puede publicarlo para que alguien aparezca: tiene que ir a buscar a alguien
que ya esté ofreciendo eso. Es un cambio de naturaleza del proyecto, no una
poda de pantallas. La fundación pierde la forma de conectar con quien no sabe
a quién buscar, solo que necesita algo.

Y una pérdida más chica pero real: quien ofrece un oficio dejaba de tener que
salir a buscar trabajo — el tablero se lo traía. Eso también se va. La
apuesta del cliente es que un directorio bien encontrado compensa lo que se
pierde al apagar el descubrimiento pasivo, y el ADR 0017 es la primera pieza
de esa apuesta para el lado de servicios.

### Neutras

`docs/PENDIENTES-LEGALES.md` puede perder las entradas que hablaban solo de
insumos o del tablero de servicios, si las tiene; revisarlo es parte de esta
tarea de código, no de este ADR.

## Plan

1. Migración: eliminar `solicitudes`, `solicitud_items`,
   `respuestas`, `respuestas_servicio` y las vistas
   `solicitudes_publicas`, `v_cruces`, `municipios_con_solicitudes`; retirar
   `respuesta_insumo_id` y `respuesta_servicio_id` de `chats` con sus ramas
   del `CHECK`; retirar las funciones `solicitudes_de_servicio` y
   `responder_servicio`.
2. Borrar las rutas y el código de dominio y contrato listados arriba.
3. Renombrar `/muro` a `/donaciones`, conservando solo la cara «ofrece».
4. Barra inferior y navegación: quitar cualquier enlace que quedara apuntando
   a `/ayudas`, `/solicitudes` o al muro con las dos caras.
5. `CLAUDE.md`: la tabla de pantallas, la sección de mensajería y la regla de
   producto 3.

## Revisión

Se revisa si, retirado el descubrimiento pasivo, la fundación no encuentra
otra forma de conectar una emergencia real con quien puede resolverla — en ese
caso el módulo no vuelve como estaba, porque el cliente ya lo descartó por
escrito, pero hace falta decidir qué lo reemplaza.
