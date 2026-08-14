-- =====================================================================
-- v2 · Fase A · 6 — cerrar lo que encontró la revisión de seguridad
--
-- Seis huecos, todos en superficie nueva de la Fase A salvo el primero,
-- que es viejo y que la Fase A agravó al abrir un campo de texto libre que
-- se renderiza en el tablero público.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. El filtro de PII no filtraba
--
-- El patrón exigía dígitos CONTIGUOS: `\d{7,}` y `3\d{9}`. Comprobado:
--
--   pasaba    "+57 300 123 4567"   ← el formato internacional canónico
--   pasaba    "300 123 4567"
--   pasaba    "79.123.456"         ← una cédula como se escribe siempre
--   bloqueaba "3001234567"         ← lo único que sí atrapaba
--
-- O sea que bloqueaba la forma en que casi nadie escribe un teléfono y
-- dejaba pasar todas las demás. `CLAUDE.md` regla 2 pide que publicar un
-- dato personal sea *imposible*, no difícil.
--
-- La corrección es quitar los separadores antes de mirar, no ampliar el
-- patrón. La coma queda fuera a propósito: es la salida para escribir
-- listas de números legítimas —"tallas 38, 40, 42"— sin que el filtro
-- salte. El mensaje de error se lo dice a la persona.
--
-- Y el patrón de correo pasa a `~*`: con `~` y el TLD escrito `[a-z]{2,}`,
-- `JUAN@GMAIL.COM` no se detectaba. Los dos lados del filtro duplicado
-- —TypeScript y SQL— no eran equivalentes: el de TypeScript sí llevaba /i.
--
-- Vive en UNA función y no copiado en cada RPC, que es como se fueron
-- separando. `src/lib/validacion.ts` tiene que decir exactamente lo mismo.
-- ---------------------------------------------------------------------

create or replace function public.contiene_pii(p_texto text)
returns boolean
language sql
security definer
set search_path = ''
immutable
as $$
  select p_texto is not null
     and (
       -- Correo, o usuario de red social con arroba.
       p_texto ~* '@[a-zA-Z0-9._-]{2,}'
       -- Siete o más dígitos seguidos una vez quitados los separadores que
       -- la gente mete para que un número se lea mejor. Un celular
       -- colombiano tiene 10, un fijo 7 u 8, una cédula entre 8 y 10.
       or regexp_replace(p_texto, '[[:space:].()-]', '', 'g') ~ '\d{7,}'
     );
$$;

revoke execute on function public.contiene_pii(text) from public, anon, authenticated;

comment on function public.contiene_pii(text) is
  'Gemela de contienePII en src/lib/validacion.ts. Si cambia una, cambia la otra: son los dos lados del mismo control y ya se separaron una vez.';

-- ---------------------------------------------------------------------
-- 2. Las sugerencias sobrevivían al borrado duro
--
-- La llave foránea va de `solicitud_items` HACIA la sugerencia, así que el
-- CASCADE de `solicitudes` se lleva el ítem y deja la sugerencia. A las 72
-- horas la solicitud desaparecía y el texto que escribió esa persona se
-- quedaba en la tabla para siempre, sin job, sin TTL y sin ninguna ruta de
-- borrado en la aplicación. La regla 4 promete que al borrar solo
-- sobrevive una fila anónima en `metricas`, "sin texto".
--
-- Trigger y no un `delete` dentro de `expirar_solicitudes`: así cubre
-- también `cerrar_solicitud` y el `delete` directo de `resolver_reporte`,
-- que son otras dos rutas de borrado.
--
-- Las aprobadas y fusionadas se conservan: su texto ya pasó por moderación
-- y vive en `catalogo_items`, y `item_resultante_id` es lo que explica de
-- dónde salió un ítem del catálogo.
-- ---------------------------------------------------------------------

create or replace function public.limpiar_sugerencia_huerfana()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.sugerencia_id is null then
    return null;
  end if;

  delete from public.sugerencias_item sg
   where sg.id = old.sugerencia_id
     and sg.estado in ('pendiente','rechazada')
     and not exists (select 1 from public.solicitud_items si
                      where si.sugerencia_id = sg.id)
     and not exists (select 1 from public.ofrecimientos o
                      where o.sugerencia_id = sg.id);

  return null;
end;
$$;

-- ⚠ DEFERRABLE INITIALLY DEFERRED, y esto no es un detalle: corren al
-- COMMIT, no en el momento del `delete`.
--
-- Con un trigger normal se rompían dos cosas que se descubrieron probando:
--
--   · `guardar_ofrecimientos` empieza con `delete from ofrecimientos where
--     perfil_id = ...` y vuelve a insertar. En el instante del delete la
--     sugerencia se queda sin referencias, el trigger la borraba, y el
--     re-insert con ese `sugerencia_id` fallaba con "Esa sugerencia no es
--     tuya". O sea: guardar el inventario dos veces reventaba.
--   · `resolver_sugerencia` borra filas de `solicitud_items` en medio del
--     remapeo. El trigger se llevaba la sugerencia antes de que la función
--     alcanzara a escribirle `estado` e `item_resultante_id`, y el update
--     final no afectaba ninguna fila, en silencio.
--
-- Al COMMIT las referencias ya están puestas de vuelta y el estado ya está
-- escrito, así que el trigger solo alcanza lo que de verdad quedó huérfano.
drop trigger if exists trg_sugerencia_huerfana on public.solicitud_items;
create constraint trigger trg_sugerencia_huerfana
  after delete on public.solicitud_items
  deferrable initially deferred
  for each row execute function public.limpiar_sugerencia_huerfana();

drop trigger if exists trg_sugerencia_huerfana_ofr on public.ofrecimientos;
create constraint trigger trg_sugerencia_huerfana_ofr
  after delete on public.ofrecimientos
  deferrable initially deferred
  for each row execute function public.limpiar_sugerencia_huerfana();

-- ---------------------------------------------------------------------
-- 3. `catalogo_items.creado_por` salía en HTML público
--
-- La migración a2 le agregó a una tabla de lectura pública una columna con
-- el uuid de `auth.users` de quien aprobó cada ítem. `/publicar` es una
-- página anónima que hace `select('*')`, así que ese identificador estable
-- de una persona natural terminaba en el HTML servido — y en
-- `GET /rest/v1/catalogo_items?select=creado_por` para cualquiera.
--
-- Se arregla en la frontera, no solo en la consulta: el `select` de la
-- página también se acotó, pero un `revoke` de columna es lo que impide
-- que el próximo `select('*')` lo vuelva a filtrar.
-- ---------------------------------------------------------------------

-- ⚠ Un `revoke select (columna)` NO sirve encima de un `grant select` de
-- tabla: el permiso de tabla cubre todas las columnas y el revoke de
-- columna no le resta nada. Comprobado — `has_column_privilege` seguía
-- devolviendo true. Hay que quitar el de tabla y volver a conceder columna
-- por columna.
revoke select on public.catalogo_items from anon, authenticated;
grant select (id, categoria, nombre, unidad, activo, orden, origen, es_prueba)
  on public.catalogo_items to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. `metricas` entregaba las filas de prueba por la API
--
-- `/datos` filtra bien, pero la política era `using (true)`: un
-- `GET /rest/v1/metricas` devolvía también lo marcado como prueba. No hay
-- PII ahí, pero los datos abiertos que la página promete limpios no lo
-- estaban por la puerta de al lado.
-- ---------------------------------------------------------------------

drop policy if exists "metricas lectura publica" on public.metricas;
create policy "metricas lectura publica" on public.metricas
  for select to public using (es_prueba = false);

-- ---------------------------------------------------------------------
-- 5. Las tres RPC que reciben texto libre, con el filtro compartido
--
--   · `crear_solicitud`  — nota y sugerencias
--   · `guardar_ofrecimientos` — sugerencias, más dos guardas nuevas
--   · `resolver_sugerencia`   — al aprobar, antes de copiar al catálogo
-- ---------------------------------------------------------------------

create or replace function public.crear_solicitud(
  p_municipio   text,
  p_barrio      text,
  p_categoria   text,
  p_nota        text,
  p_items       jsonb,
  p_token       text
)
returns table (solicitud_id uuid, codigo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id          uuid;
  v_codigo      text;
  v_item        jsonb;
  v_sugerencia  text;
  v_sug_id      uuid;
  v_n_sugeridos integer := 0;
  v_es_prueba   boolean := trim(p_barrio) ilike 'prueba%';
begin
  if public.contiene_pii(p_nota) then
    raise exception 'La nota no puede contener teléfonos ni correos';
  end if;

  -- El barrio también: se ve en la tarjeta del tablero público, igual que
  -- la nota, y hasta ahora solo lo filtraba el cliente.
  if public.contiene_pii(p_barrio) then
    raise exception 'El barrio no puede contener teléfonos ni correos';
  end if;

  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 12 then
    raise exception 'Debe incluir entre 1 y 12 ítems';
  end if;

  v_codigo := public.generar_codigo();

  insert into public.solicitudes (codigo, token_hash, municipio, barrio, categoria, nota, es_prueba)
  values (v_codigo, encode(extensions.digest(p_token, 'sha256'), 'hex'),
          p_municipio, p_barrio, p_categoria, nullif(trim(p_nota), ''), v_es_prueba)
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_sugerencia := nullif(trim(v_item->>'sugerencia'), '');

    if v_sugerencia is null then
      insert into public.solicitud_items (solicitud_id, item_id, cantidad)
      values (v_id, v_item->>'item_id', (v_item->>'cantidad')::numeric);
    else
      v_n_sugeridos := v_n_sugeridos + 1;
      if v_n_sugeridos > 3 then
        raise exception 'Puedes sugerir máximo 3 cosas que no estén en la lista';
      end if;

      if char_length(v_sugerencia) < 2 or char_length(v_sugerencia) > 60 then
        raise exception 'El nombre de lo que sugieres debe tener entre 2 y 60 caracteres';
      end if;

      if public.contiene_pii(v_sugerencia) then
        raise exception 'El nombre de lo que sugieres no puede contener teléfonos ni correos';
      end if;

      insert into public.sugerencias_item (nombre_propuesto, categoria_sugerida, origen, es_prueba)
      values (v_sugerencia, p_categoria, 'solicitante', v_es_prueba)
      returning id into v_sug_id;

      insert into public.solicitud_items (solicitud_id, sugerencia_id, cantidad)
      values (v_id, v_sug_id, (v_item->>'cantidad')::numeric);
    end if;
  end loop;

  return query select v_id, v_codigo;
end;
$$;

grant execute on function public.crear_solicitud(text,text,text,text,jsonb,text) to anon, authenticated;

create or replace function public.guardar_ofrecimientos(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_perfil      public.perfiles;
  v_item        jsonb;
  v_sugerencia  text;
  v_sug_id      uuid;
  v_n_sugeridos integer := 0;
  v_pendientes  integer;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;

  select * into v_perfil from public.perfiles p where p.id = v_uid;
  if not found then
    raise exception 'Necesitas completar tu perfil';
  end if;

  -- `responder_solicitud` ya comprobaba esto y aquí faltaba: una cuenta
  -- suspendida por publicar datos personales conservaba intacto este canal
  -- de escritura de texto libre.
  if v_perfil.suspendido then
    raise exception 'Tu perfil está suspendido';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Formato de inventario inválido';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'Son demasiados ítems de una sola vez';
  end if;

  -- El tope de 3 es por llamada, así que sin este de aquí una cuenta puede
  -- llamar en bucle y llenar la cola de moderación. `sugerencias_pendientes`
  -- recorre el catálogo por cada palabra de cada sugerencia pendiente: con
  -- unos miles de filas, /admin deja de cargar, y /admin es la única
  -- herramienta de moderación que tiene el proyecto.
  select count(*) into v_pendientes
    from public.sugerencias_item sg
   where sg.propuesta_por = v_uid and sg.estado = 'pendiente';

  delete from public.ofrecimientos where perfil_id = v_uid;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_sugerencia := nullif(trim(v_item->>'sugerencia'), '');
    v_sug_id     := nullif(v_item->>'sugerencia_id', '')::uuid;

    if v_sugerencia is not null then
      v_n_sugeridos := v_n_sugeridos + 1;
      if v_n_sugeridos > 3 then
        raise exception 'Puedes sugerir máximo 3 cosas nuevas a la vez';
      end if;
      if v_pendientes + v_n_sugeridos > 10 then
        raise exception 'Ya tienes muchas sugerencias esperando revisión. Espera a que las revisen.';
      end if;

      if char_length(v_sugerencia) < 2 or char_length(v_sugerencia) > 60 then
        raise exception 'El nombre de lo que sugieres debe tener entre 2 y 60 caracteres';
      end if;

      if public.contiene_pii(v_sugerencia) then
        raise exception 'El nombre de lo que sugieres no puede contener teléfonos ni correos';
      end if;

      insert into public.sugerencias_item (nombre_propuesto, propuesta_por, origen, es_prueba)
      values (v_sugerencia, v_uid, 'ofertador', v_perfil.nombre_visible ilike 'prueba%')
      returning id into v_sug_id;

    elsif v_sug_id is not null then
      -- Solo sugerencias propias: sin esto, cualquiera podría enganchar su
      -- inventario a la sugerencia de otro pasando un uuid a mano.
      if not exists (select 1 from public.sugerencias_item sg
                      where sg.id = v_sug_id and sg.propuesta_por = v_uid) then
        raise exception 'Esa sugerencia no es tuya';
      end if;
    end if;

    insert into public.ofrecimientos (perfil_id, item_id, sugerencia_id, cantidad, disponible)
    values (
      v_uid,
      case when v_sug_id is null then v_item->>'item_id' else null end,
      v_sug_id,
      nullif(v_item->>'cantidad', '')::numeric,
      coalesce((v_item->>'disponible')::boolean, true)
    );
  end loop;
end;
$$;

revoke execute on function public.guardar_ofrecimientos(jsonb) from public, anon;
grant  execute on function public.guardar_ofrecimientos(jsonb) to authenticated;

create or replace function public.crear_item_catalogo(
  p_nombre    text,
  p_categoria text,
  p_unidad    text default 'unidad'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  text;
begin
  if not public.es_admin(v_uid) then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(p_nombre)) < 2 or char_length(trim(p_nombre)) > 60 then
    raise exception 'El nombre debe tener entre 2 y 60 caracteres';
  end if;

  -- Antes lo atrapaba el CHECK de la tabla y al administrador le salía en
  -- pantalla un error crudo de Postgres.
  if p_categoria not in ('alimentacion','aseo','salud','abrigo','cocina','otros','servicios','mascotas') then
    raise exception 'Categoría inválida';
  end if;

  if public.contiene_pii(p_nombre) then
    raise exception 'El nombre no puede contener teléfonos ni correos';
  end if;

  v_id := public.slug_item(p_nombre);

  insert into public.catalogo_items (id, categoria, nombre, unidad, orden, creado_por, origen, es_prueba)
  values (v_id, p_categoria, trim(p_nombre),
          coalesce(nullif(trim(p_unidad), ''), 'unidad'), 9999, v_uid, 'admin',
          trim(p_nombre) ilike 'prueba%');

  return v_id;
end;
$$;

revoke execute on function public.crear_item_catalogo(text,text,text) from public, anon;
grant  execute on function public.crear_item_catalogo(text,text,text) to authenticated;

create or replace function public.resolver_sugerencia(
  p_sugerencia_id uuid,
  p_accion        text,
  p_item_destino  text default null,
  p_nota          text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_sug     public.sugerencias_item;
  v_destino text;
  v_estado  text;
begin
  if not public.es_admin(v_uid) then
    raise exception 'No autorizado';
  end if;

  if p_accion not in ('aprobar','rechazar','fusionar') then
    raise exception 'Acción inválida';
  end if;

  select * into v_sug from public.sugerencias_item where id = p_sugerencia_id;
  if not found then raise exception 'Sugerencia no encontrada'; end if;
  if v_sug.estado <> 'pendiente' then
    raise exception 'Esa sugerencia ya fue resuelta';
  end if;

  if p_accion = 'rechazar' then
    update public.sugerencias_item
       set estado = 'rechazada', revisada_por = v_uid, revisada_at = now(),
           nota_revision = nullif(trim(p_nota), '')
     where id = p_sugerencia_id;

    -- Sin esto, el inventario que la referenciaba queda "por confirmar"
    -- para siempre: nadie lo va a resolver nunca. El inventario se puede
    -- volver a llenar; la solicitud no se toca, porque su necesidad es real
    -- y de todos modos se borra sola en menos de 72 horas.
    delete from public.ofrecimientos where sugerencia_id = p_sugerencia_id;
    return null;
  end if;

  if p_accion = 'aprobar' then
    -- Aprobar copia este texto a `catalogo_items`, que es de lectura
    -- pública y permanente, y no hay ninguna RPC para borrar de ahí. Un
    -- clic distraído sobre una sugerencia con un teléfono lo publicaría
    -- para siempre.
    if public.contiene_pii(v_sug.nombre_propuesto) then
      raise exception 'Esa sugerencia trae un teléfono o un correo: recházala, no la apruebes';
    end if;

    v_destino := public.slug_item(v_sug.nombre_propuesto);
    insert into public.catalogo_items (id, categoria, nombre, unidad, orden, creado_por, origen, es_prueba)
    values (v_destino,
            coalesce(v_sug.categoria_sugerida, 'otros'),
            trim(v_sug.nombre_propuesto),
            coalesce(nullif(trim(v_sug.unidad_sugerida), ''), 'unidad'),
            9999, v_uid, 'sugerencia', v_sug.es_prueba);
    v_estado := 'aprobada';
  else
    v_destino := p_item_destino;
    if v_destino is null then
      raise exception 'Indica con qué ítem se fusiona';
    end if;
    if not exists (select 1 from public.catalogo_items c where c.id = v_destino) then
      raise exception 'Ese ítem no existe en el catálogo';
    end if;
    v_estado := 'fusionada';
  end if;

  -- ⚠ Antes del remapeo: si un perfil ya tenía el ítem destino Y la
  -- sugerencia, el update chocaría contra `ofrecimientos_item_uniq`. Se
  -- descarta la fila de la sugerencia, que es la duplicada. No se suman
  -- las cantidades porque en el inventario son estimaciones, no cifras.
  delete from public.ofrecimientos o
   where o.sugerencia_id = p_sugerencia_id
     and exists (select 1 from public.ofrecimientos o2
                  where o2.perfil_id = o.perfil_id and o2.item_id = v_destino);

  update public.ofrecimientos
     set item_id = v_destino, sugerencia_id = null, actualizado_at = now()
   where sugerencia_id = p_sugerencia_id;

  -- ⚠ Y en `solicitud_items` el problema es al revés: no hay índice único,
  -- así que el remapeo NO falla — deja dos filas del mismo ítem en la misma
  -- solicitud, y el tablero público muestra "4 unidad de Jabón" y "3 unidad
  -- de Jabón" una debajo de otra, que se lee como un error. Aquí sí se
  -- suman: es lo que la persona necesita, y la suma es la cifra correcta.
  update public.solicitud_items dst
     set cantidad = least(9999, dst.cantidad + src.cantidad)
    from public.solicitud_items src
   where src.sugerencia_id = p_sugerencia_id
     and dst.solicitud_id = src.solicitud_id
     and dst.item_id = v_destino;

  delete from public.solicitud_items src
   where src.sugerencia_id = p_sugerencia_id
     and exists (select 1 from public.solicitud_items d
                  where d.solicitud_id = src.solicitud_id and d.item_id = v_destino);

  update public.solicitud_items
     set item_id = v_destino, sugerencia_id = null
   where sugerencia_id = p_sugerencia_id;

  update public.sugerencias_item
     set estado = v_estado, item_resultante_id = v_destino,
         revisada_por = v_uid, revisada_at = now(),
         nota_revision = nullif(trim(p_nota), '')
   where id = p_sugerencia_id;

  return v_destino;
end;
$$;

revoke execute on function public.resolver_sugerencia(uuid,text,text,text) from public, anon;
grant  execute on function public.resolver_sugerencia(uuid,text,text,text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Lo que el filtro viejo dejó entrar
--
-- Si algo ya está guardado con un teléfono o un correo, sale aquí. No se
-- borra solo: hay que mirarlo.
-- ---------------------------------------------------------------------

select 'sugerencias con PII' as revisar, count(*) as filas
  from public.sugerencias_item where public.contiene_pii(nombre_propuesto)
union all
select 'notas con PII', count(*) from public.solicitudes where public.contiene_pii(nota)
union all
select 'barrios con PII', count(*) from public.solicitudes where public.contiene_pii(barrio)
union all
select 'items de catalogo con PII', count(*)
  from public.catalogo_items where public.contiene_pii(nombre);
