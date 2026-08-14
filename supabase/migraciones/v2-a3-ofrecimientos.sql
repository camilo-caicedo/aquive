-- =====================================================================
-- v2 · Fase A · 3 de 3 — inventario de quien ofrece
--
-- Hoy la aplicación solo sabe qué necesita la gente. `ofrecimientos` es lo
-- que falta para cruzar en los dos sentidos: qué tiene cada ofertador.
--
-- Es OPCIONAL a propósito. Ya hay ofertadores registrados sin inventario y
-- obligarlos les pondría un muro de migración; muchos además son reactivos
-- —ven una solicitud y piensan "eso lo tengo yo"— y forzarlos a declarar
-- existencias por adelantado produce datos inventados, que envenenan el
-- cruce. Sin inventario el perfil se guarda igual y se responde igual.
--
-- Sin PII: son ítems y cantidades colgando de un perfil.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La tabla
--
-- Sin columna de categoría a propósito: un ofertador cruza categorías
-- libremente y arroz, cobijas y acetaminofén conviven sin problema.
--
-- `cantidad` es NULLABLE, al revés que `solicitud_items.cantidad`. "Tengo
-- cobijas, no sé cuántas" es el caso honesto más común, y exigir un número
-- produce el dato inventado que se quiere evitar. El cruce funciona igual
-- porque cruza por ítem, no por cantidad; la cifra dura se establece en la
-- entrega, cuando alguien tiene la caja enfrente.
-- ---------------------------------------------------------------------

create table if not exists public.ofrecimientos (
  id             uuid primary key default gen_random_uuid(),
  perfil_id      uuid not null references public.perfiles(id) on delete cascade,
  item_id        text references public.catalogo_items(id),
  sugerencia_id  uuid references public.sugerencias_item(id) on delete restrict,
  cantidad       numeric(8,2) check (cantidad is null or (cantidad > 0 and cantidad <= 9999)),
  disponible     boolean not null default true,
  actualizado_at timestamptz not null default now(),
  constraint ofrecimientos_uno_u_otro check (num_nonnulls(item_id, sugerencia_id) = 1)
);

comment on table public.ofrecimientos is
  'Inventario de quien ofrece. Sin datos personales: ítems y cantidades colgando de un perfil. Opcional.';

-- ⚠ Van como índices únicos PARCIALES y no como restricción de tabla: un
-- UNIQUE de tabla no admite WHERE, y sin el WHERE los NULL de la columna
-- que no aplica no se comparan entre sí y el índice no sirve de nada.
create unique index if not exists ofrecimientos_item_uniq
  on public.ofrecimientos (perfil_id, item_id) where item_id is not null;
create unique index if not exists ofrecimientos_sug_uniq
  on public.ofrecimientos (perfil_id, sugerencia_id) where sugerencia_id is not null;

create index if not exists idx_ofrecimientos_item on public.ofrecimientos(item_id)
  where disponible;

-- Mismo patrón que `solicitudes`: acceso cortado un nivel más arriba, en el
-- GRANT. RLS activo con cero políticas es correcto y deliberado — la
-- frontera son las dos RPC de abajo, no una política.
alter table public.ofrecimientos enable row level security;
revoke all on public.ofrecimientos from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Guardar el inventario
--
-- Reemplaza el inventario completo del perfil que llama: borra y vuelve a
-- insertar dentro de la misma transacción. Cada ítem viene en una de tres
-- formas, y exactamente una:
--
--   {"item_id":"agua","cantidad":40}            ← del catálogo
--   {"sugerencia_id":"<uuid>","cantidad":null}  ← sugerencia ya guardada
--   {"sugerencia":"Crema dental"}               ← sugerencia nueva
--
-- `cantidad` y `disponible` son opcionales en las tres.
--
-- El tope de 100 no es un límite de producto —el plan pide explícitamente
-- que no lo haya— sino una guarda de tamaño de payload en un endpoint que
-- escribe. Ningún inventario real se acerca.
-- ---------------------------------------------------------------------

create or replace function public.guardar_ofrecimientos(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_item        jsonb;
  v_sugerencia  text;
  v_sug_id      uuid;
  v_n_sugeridos integer := 0;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;

  if not exists (select 1 from public.perfiles p where p.id = v_uid) then
    raise exception 'Necesitas completar tu perfil';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Formato de inventario inválido';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'Son demasiados ítems de una sola vez';
  end if;

  delete from public.ofrecimientos where perfil_id = v_uid;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_sugerencia := nullif(trim(v_item->>'sugerencia'), '');
    v_sug_id     := nullif(v_item->>'sugerencia_id', '')::uuid;

    if v_sugerencia is not null then
      v_n_sugeridos := v_n_sugeridos + 1;
      if v_n_sugeridos > 3 then
        raise exception 'Puedes sugerir máximo 3 cosas nuevas a la vez';
      end if;

      if char_length(v_sugerencia) < 2 or char_length(v_sugerencia) > 60 then
        raise exception 'El nombre de lo que sugieres debe tener entre 2 y 60 caracteres';
      end if;

      if v_sugerencia ~ '(\+?57)?[ -]?3[0-9]{9}|[0-9]{7,}|@[a-zA-Z0-9._-]+\.[a-z]{2,}' then
        raise exception 'El nombre de lo que sugieres no puede contener teléfonos ni correos';
      end if;

      insert into public.sugerencias_item (nombre_propuesto, propuesta_por, origen)
      values (v_sugerencia, v_uid, 'ofertador')
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

-- ---------------------------------------------------------------------
-- 3. Leer el inventario propio
--
-- Existe para que la tabla no necesite ninguna política de lectura: la
-- pantalla de perfil llama esto y recibe los nombres ya resueltos, vengan
-- del catálogo o de una sugerencia todavía sin aprobar.
-- ---------------------------------------------------------------------

create or replace function public.mis_ofrecimientos()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id',       o.item_id,
           'sugerencia_id', o.sugerencia_id,
           'nombre',        coalesce(c.nombre, sg.nombre_propuesto),
           'categoria',     coalesce(c.categoria, sg.categoria_sugerida),
           'unidad',        coalesce(c.unidad, sg.unidad_sugerida, 'unidad'),
           'cantidad',      o.cantidad,
           'disponible',    o.disponible,
           'por_confirmar', o.sugerencia_id is not null
         ) order by coalesce(c.orden, 9999), coalesce(c.nombre, sg.nombre_propuesto)), '[]'::jsonb)
    into v_out
    from public.ofrecimientos o
    left join public.catalogo_items c    on c.id = o.item_id
    left join public.sugerencias_item sg on sg.id = o.sugerencia_id
   where o.perfil_id = v_uid;

  return v_out;
end;
$$;

revoke execute on function public.mis_ofrecimientos() from public, anon;
grant  execute on function public.mis_ofrecimientos() to authenticated;

-- Comprobar:
--   select has_table_privilege('anon','public.ofrecimientos','SELECT');  -- f
--   select has_function_privilege('anon',
--     'public.guardar_ofrecimientos(jsonb)','EXECUTE');                  -- f
