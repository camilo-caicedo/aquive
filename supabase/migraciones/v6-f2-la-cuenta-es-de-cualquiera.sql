-- =====================================================================
-- v6 · Fase F · 2 — la cuenta es de cualquiera (ADR 0015)
--
-- Hasta hoy, la única pantalla pública que creaba un perfil empezaba
-- preguntando «¿Qué vas a ofrecer?» y derivaba el tipo de dos casillas.
-- Quien entraba a buscar una modista tenía que declararse proveedor de
-- algo, publicar su teléfono y firmar una autorización de publicación.
--
-- El tipo que faltaba existía desde `v5-a2-perfil-de-vecino.sql`, con el
-- comentario «vecino = solo pide, no publica nada», y tenía cero filas:
-- `crear_perfil` lo rechazaba.
--
-- ⚠ Va DESPUÉS de `v6-f1`. Esa migración es la que hace desaparecer el
-- tipo `ofertador`; aplicar esta antes deja `ofertadores_publicos` viva y
-- vacía, mencionando un valor que el CHECK ya no admite.
--
-- ⚠ Y va contra la base de PRUEBAS. La de producción es todavía la
-- aplicación anterior: no tiene `proveedores`, `solicitudes_servicio` ni
-- `publicaciones_muro`, y se reemplaza entera cuando salga la reescritura.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · Las filas, antes que el CHECK
-- ---------------------------------------------------------------------

-- 1.1 · Quien era ofertador pasa a vecino.
--
-- Su teléfono y su descripción se borran. Los dio para aparecer en
-- `/ofertadores`, que ya no existe, y una finalidad que no se cumple no
-- sostiene el dato (Ley 1581, art. 9). No pierde nada más: sus chats, sus
-- productos y sus publicaciones del muro cuelgan de `perfil_id`, no de
-- `tipo`.
update public.perfiles
   set tipo = 'vecino',
       contacto_publico = null,
       descripcion = null,
       acepto_publicacion = false,
       autorizacion_version = null
 where tipo = 'ofertador';

-- 1.2 · Y el `servidor` que no tiene matrícula, también.
--
-- ⚠ Son nueve de doce en pruebas, y no es un dato sucio: los creó
-- `alta-asistida`, que marcaba `servidor` a los prestadores del
-- directorio. `servidor` significa «tiene matrícula profesional
-- verificable» —es lo que afirma `servidores_publicos` al publicar su
-- nombre y su teléfono—, y ninguno de los nueve la declaró nunca.
--
-- Su ficha del directorio NO se ve afectada: `proveedores_publicos` filtra
-- por `proveedores.acepto_publicacion` y `proveedores.suspendido`, que son
-- columnas suyas. El teléfono público sigue estando donde siempre estuvo,
-- en `proveedores.telefono`, con su propia autorización.
update public.perfiles p
   set tipo = 'vecino',
       contacto_publico = null,
       acepto_publicacion = false,
       autorizacion_version = null
 where p.tipo = 'servidor'
   and not exists (select 1 from public.servidores s where s.perfil_id = p.id);


-- ---------------------------------------------------------------------
-- 2 · El CHECK, ya sin `ofertador`
-- ---------------------------------------------------------------------
alter table public.perfiles drop constraint if exists perfiles_tipo_check;
alter table public.perfiles add constraint perfiles_tipo_check
  check (tipo = any (array['vecino','servidor','aliado']));

-- `perfiles_contacto_publico_check` NO cambia: su rama para `vecino` y
-- `aliado` ya hace lo correcto —el teléfono es opcional— y para `servidor`
-- sigue siendo obligatorio, que es lo que exige publicar una ficha.

comment on column public.perfiles.tipo is
  'vecino = la cuenta de cualquiera: no publica nada por sí misma. '
  'servidor = profesional con matrícula, y por eso publica nombre y contacto '
  'en servidores_publicos. aliado = lleva un centro de acopio (ADR 0008); el '
  'tipo es informativo y quien decide es miembros_organizacion. El ofertador '
  'se fue con el módulo de insumos (ADR 0014).';


-- ---------------------------------------------------------------------
-- 3 · `crear_perfil` se retira
--
-- Era una función de PL/pgSQL que el navegador llamaba directo —deuda del
-- paso 2 del ADR 0001— y hacía tres cosas a la vez: crear el perfil,
-- elegir su tipo y escribir la matrícula. Su único llamador era el
-- asistente de `/registro`, que se fue con el módulo de insumos.
--
-- Ahora eso son tres procedimientos del contrato: `cuentas.abrir`,
-- `cuentas.guardarMia` y `servicios.guardarMatricula`.
--
-- ⚠ Comprobado: `unirse_a_organizacion` NO la llama. Hace su propio
-- `insert ... on conflict (id) do nothing` para crear el perfil `aliado`.
-- ---------------------------------------------------------------------
drop function if exists public.crear_perfil(
  text, text, text[], text, text, text, text, text, text, text[], boolean, text);
drop function if exists public.crear_perfil(
  text, text, text[], text, text, text, text, text, text, text[], boolean);
drop function if exists public.crear_perfil(
  text, text, text[], text, text, text, text, text, text, text[]);


-- ---------------------------------------------------------------------
-- 4 · `guardar_proveedor` comprueba que exista la cuenta
--
-- ⚠ Inserta `perfil_id = auth.uid()` sin mirar si esa fila existe, y
-- `proveedores.perfil_id` es llave foránea contra `perfiles`. Hoy, quien
-- llegaba al alta de la ficha sin haber abierto su cuenta se estrellaba
-- contra una violación de llave foránea que la pantalla no puede
-- explicar. Y era un recorrido real: `PuertaCerrada` guardaba el destino,
-- Google devolvía a `/registro`, y `VueltaAlDestino` saltaba al carné
-- ANTES de crear el perfil.
--
-- Esto es el cinturón. Los tirantes son que el callback ya no deja pasar a
-- nadie sin cuenta, y que `/empezar` recoge el destino después de
-- guardar, no al montar.
--
-- No la crea: eso duplicaría `cuentas.abrir` en PL/pgSQL, contra el ADR
-- 0001, y tendría que inventarse el nombre visible y el municipio.
-- ---------------------------------------------------------------------
do $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'guardar_proveedor'
   limit 1;

  if v_def is null then
    raise notice 'guardar_proveedor no existe en esta base: nada que reforzar.';
    return;
  end if;

  -- Idempotente: si ya lleva el guardia, no se toca.
  if position('Primero completa tu cuenta' in v_def) > 0 then
    return;
  end if;

  -- Se inserta justo después de la comprobación de sesión que ya tiene.
  v_def := replace(
    v_def,
    'if p_acepto_publicacion is not true then',
    'if v_uid is not null and not exists ('
      || 'select 1 from public.perfiles pf where pf.id = v_uid) then'
      || E'\n    raise exception ''Primero completa tu cuenta: tu nombre y tu municipio'';'
      || E'\n  end if;'
      || E'\n\n  if p_acepto_publicacion is not true then'
  );

  execute v_def;
end $$;


-- =====================================================================
-- Comprobar:
--
--   -- Tres tipos, y ningún ofertador.
--   select tipo, count(*) from public.perfiles group by 1 order by 1;
--
--   -- Nadie publica sin haber dicho qué texto aceptó.
--   select count(*) from public.perfiles
--    where acepto_publicacion and autorizacion_version is null;
--   -- Esperado: 0.
--
--   -- Y ningún `servidor` sin matrícula.
--   select count(*) from public.perfiles p
--    where p.tipo = 'servidor'
--      and not exists (select 1 from public.servidores s where s.perfil_id = p.id);
--   -- Esperado: 0.
--
--   -- El guardia nuevo del alta de ficha.
--   select position('Primero completa tu cuenta' in pg_get_functiondef(p.oid)) > 0
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'guardar_proveedor';
-- =====================================================================
