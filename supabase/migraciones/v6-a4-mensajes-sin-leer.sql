-- v6-a4 · Saber qué hilos tienen algo sin leer.
--
-- No hay tabla nueva ni un `leido` por mensaje: basta con cuándo miró cada
-- lado. Un hilo tiene algo sin leer si el otro escribió después de la última
-- vez que yo lo abrí. Dos columnas contra una fila por mensaje y por
-- persona, que es lo que costaría marcar mensaje a mensaje para responder
-- la única pregunta que se hace la interfaz: ¿hay algo o no?
--
-- Se llaman por el papel y no por la persona porque el papel es lo que el
-- hilo ya sabe: los dos lados son `ofrece` y `pide` en los cinco orígenes.

begin;

alter table chats
  add column visto_ofrece_at timestamptz,
  add column visto_pide_at timestamptz;

-- Para el contador del menú, que se pide en cada carga con sesión.
create index idx_mensajes_chat_autor on mensajes (chat_id, autor, creado_at desc)
  where not oculto;

commit;
