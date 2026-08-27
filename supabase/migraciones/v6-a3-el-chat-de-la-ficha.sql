-- v6-a3 · La ficha del prestador también abre chat.
--
-- El ADR 0009 dejó la ficha fuera con este argumento: «una ficha no caduca,
-- y un hilo colgado de ella no moriría nunca». El argumento no se sostiene
-- —un producto tampoco caduca, vive «mientras su dueño lo deje», y sí abre
-- chat—, y la consecuencia práctica era que a un prestador sin productos
-- publicados solo se le podía escribir dando el teléfono propio.
--
-- El hilo muere igual que los otros cuatro: `on delete cascade` sobre la
-- ficha. Borrar la ficha borra sus hilos, que es lo que la regla 3 pide.

begin;

alter table chats
  add column proveedor_id uuid references proveedores (id) on delete cascade;

alter table chats drop constraint chats_un_origen;
alter table chats add constraint chats_un_origen check (
  num_nonnulls(
    respuesta_servicio_id, respuesta_insumo_id, producto_id, publicacion_id, proveedor_id
  ) = 1
);

-- Una ficha identifica a un solo lado, como el producto y el muro: el otro
-- es quien abre el hilo, y hay uno por persona.
alter table chats drop constraint chats_iniciado_por_donde_toca;
alter table chats add constraint chats_iniciado_por_donde_toca check (
  (producto_id is not null or publicacion_id is not null or proveedor_id is not null)
  = (iniciado_por is not null)
);

create unique index chats_proveedor_iniciado_key
  on chats (proveedor_id, iniciado_por) where proveedor_id is not null;

commit;
