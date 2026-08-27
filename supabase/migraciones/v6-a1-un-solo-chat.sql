-- v6-a1 · Un solo chat para toda la aplicación.
--
-- El chat existía únicamente para los pedidos de servicio: `chats_servicio`
-- colgaba de `respuestas_servicio` por una llave foránea, y productos,
-- donaciones e insumos no tenían ninguno. Ahora cuelga de cualquiera de las
-- cuatro cosas que dos personas pueden tener que acordar.
--
-- No es un chat polimórfico con `(tipo, id)`: son cuatro columnas, cada una
-- con su `on delete cascade`, porque la regla 3 dice que el chat muere con lo
-- que lo abrió y un par «tipo + id» no puede cascadear. La garantía se queda
-- en la base, que es donde CLAUDE.md dice que se quedan las garantías.

begin;

alter table chats_servicio rename to chats;
alter table mensajes_servicio rename to mensajes;
alter table chats rename column respuesta_id to respuesta_servicio_id;

alter table chats rename constraint chats_servicio_pkey to chats_pkey;
alter table chats rename constraint chats_servicio_respuesta_id_fkey to chats_respuesta_servicio_id_fkey;
alter table chats rename constraint chats_servicio_respuesta_id_key to chats_respuesta_servicio_id_key;
alter table mensajes rename constraint mensajes_servicio_pkey to mensajes_pkey;
alter table mensajes rename constraint mensajes_servicio_chat_id_fkey to mensajes_chat_id_fkey;
alter table mensajes rename constraint mensajes_servicio_cuerpo_check to mensajes_cuerpo_check;

alter table chats alter column respuesta_servicio_id drop not null;

alter table chats
  add column respuesta_insumo_id uuid references respuestas (id) on delete cascade,
  add column producto_id uuid references productos (id) on delete cascade,
  add column publicacion_id uuid references publicaciones_muro (id) on delete cascade,
  add column iniciado_por uuid references perfiles (id) on delete cascade;

-- Un hilo cuelga de una sola cosa.
alter table chats add constraint chats_un_origen check (
  num_nonnulls(respuesta_servicio_id, respuesta_insumo_id, producto_id, publicacion_id) = 1
);

-- Una respuesta ya identifica a los dos lados: quien publicó la solicitud y
-- quien respondió. Un producto o una publicación del muro solo identifican a
-- uno, así que el otro es quien abre el hilo — y hay uno por persona.
alter table chats add constraint chats_iniciado_por_donde_toca check (
  (producto_id is not null or publicacion_id is not null) = (iniciado_por is not null)
);

create unique index chats_respuesta_insumo_key
  on chats (respuesta_insumo_id) where respuesta_insumo_id is not null;
create unique index chats_producto_iniciado_key
  on chats (producto_id, iniciado_por) where producto_id is not null;
create unique index chats_publicacion_iniciado_key
  on chats (publicacion_id, iniciado_por) where publicacion_id is not null;

-- Los papeles dejan de hablar de servicios. `ofrece` tiene la cosa o el
-- trabajo; `pide` la necesita. Los mismos dos nombres que ya usa
-- `publicaciones_muro.cara`, para no tener dos vocabularios.
alter table mensajes drop constraint mensajes_servicio_autor_check;
alter table mensajes add constraint mensajes_autor_check
  check (autor in ('pide', 'ofrece'));

commit;
