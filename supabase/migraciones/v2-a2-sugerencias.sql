-- =====================================================================
-- v2 · Fase A · 2 de 3 — ítems sugeridos
--
-- Quien no encuentra lo que necesita en el catálogo lo escribe, la
-- solicitud se publica igual, y un administrador después aprueba, rechaza
-- o fusiona la sugerencia con un ítem que ya existía.
--
-- Va antes que `ofrecimientos` porque las dos tablas que apuntan a una
-- sugerencia —`solicitud_items` y `ofrecimientos`— necesitan que esta
-- exista primero.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La tabla
--
-- `nombre_propuesto` es el único texto libre que entra desde fuera del
-- catálogo, así que lleva el mismo filtro de teléfonos y correos que la
-- nota de una solicitud (CLAUDE.md regla 2). La validación está en la RPC
-- que escribe, no aquí: un CHECK con ese regex sería más frágil y no
-- podría dar un mensaje que explique qué pasó.
-- ---------------------------------------------------------------------

create table if not exists public.sugerencias_item (
  id                  uuid primary key default gen_random_uuid(),
  nombre_propuesto    text not null check (char_length(trim(nombre_propuesto)) between 2 and 60),
  categoria_sugerida  text check (categoria_sugerida in
                        ('alimentacion','aseo','salud','abrigo','cocina','otros','servicios','mascotas')),
  unidad_sugerida     text check (char_length(unidad_sugerida) between 1 and 20),
  -- SET NULL y no cascada: si quien la propuso borra su cuenta, la
  -- sugerencia sobrevive. No es un dato suyo, es el nombre de una cosa.
  -- Mismo razonamiento que `servidores.verificado_por`.
  propuesta_por       uuid references auth.users(id) on delete set null,
  origen              text not null check (origen in ('solicitante','ofertador','aliado')),
  estado              text not null default 'pendiente'
                        check (estado in ('pendiente','aprobada','rechazada','fusionada')),
  -- `catalogo_items.id` es TEXT, no uuid: es una PK legible que se genera
  -- a partir del nombre al aprobar.
  item_resultante_id  text references public.catalogo_items(id) on delete set null,
  revisada_por        uuid references auth.users(id) on delete set null,
  revisada_at         timestamptz,
  nota_revision       text check (char_length(nota_revision) <= 300),
  creada_at           timestamptz not null default now()
);

comment on table public.sugerencias_item is
  'PROHIBIDO usarla como campo de notas. Es el nombre de una cosa, nunca de una persona ni de una situación. Ver CLAUDE.md regla 2.';

create index if not exists idx_sugerencias_estado on public.sugerencias_item(estado);

alter table public.sugerencias_item enable row level security;

-- Nadie escribe directo: solo por RPC. La única lectura de tabla es la
-- del administrador, que necesita la cola en /admin.
--
-- `es_admin()` NO sirve aquí: tiene EXECUTE revocado y la expresión de una
-- política corre con los permisos de quien consulta, así que fallaría para
-- todo el mundo. EXISTS a mano contra `administradores`, como el resto.
drop policy if exists "admin lee sugerencias" on public.sugerencias_item;
create policy "admin lee sugerencias" on public.sugerencias_item
  for select to authenticated
  using (exists (select 1 from public.administradores a where a.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------
-- 2. De dónde salió cada ítem del catálogo
-- ---------------------------------------------------------------------

alter table public.catalogo_items
  add column if not exists creado_por uuid references auth.users(id) on delete set null;
alter table public.catalogo_items
  add column if not exists origen text not null default 'semilla';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'catalogo_items_origen_check') then
    alter table public.catalogo_items add constraint catalogo_items_origen_check
      check (origen in ('semilla','admin','aliado','sugerencia'));
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 3. Un ítem de solicitud apunta al catálogo O a una sugerencia
--
-- `on delete restrict` en `sugerencia_id` a propósito: borrar la sugerencia
-- dejaría la fila violando su propio CHECK. Las sugerencias no se borran,
-- cambian de estado. Para limpiar datos de prueba, primero las solicitudes
-- —el CASCADE se lleva sus ítems— y después las sugerencias.
-- ---------------------------------------------------------------------

alter table public.solicitud_items alter column item_id drop not null;
alter table public.solicitud_items
  add column if not exists sugerencia_id uuid references public.sugerencias_item(id) on delete restrict;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'solicitud_items_uno_u_otro') then
    alter table public.solicitud_items add constraint solicitud_items_uno_u_otro
      check (num_nonnulls(item_id, sugerencia_id) = 1);
  end if;
end
$$;

create index if not exists idx_items_sugerencia on public.solicitud_items(sugerencia_id);

-- ---------------------------------------------------------------------
-- 4. crear_solicitud aprende a insertar ítems sugeridos
--
-- Sigue siendo `create or replace`: la firma NO cambia. Lo que cambia es
-- la forma de los objetos dentro del jsonb `p_items`, que ahora acepta dos
-- variantes:
--
--   {"item_id":"agua","cantidad":5}          ← del catálogo
--   {"sugerencia":"Crema dental","cantidad":3} ← escrita por la persona
--
-- Sin esto, publicar con un ítem sugerido fallaría contra el CHECK nuevo.
--
-- El tope de 3 sugerencias por solicitud no es capricho: este es un
-- endpoint que llama `anon`, y doce cadenas libres por envío convierten la
-- cola de moderación en el cuello de botella. Turnstile ya filtra bots;
-- esto acota el daño de un humano insistente.
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
begin
  if p_nota is not null and p_nota ~ '(\+?57)?[ -]?3[0-9]{9}|[0-9]{7,}|@[a-zA-Z0-9._-]+\.[a-z]{2,}' then
    raise exception 'La nota no puede contener teléfonos ni correos';
  end if;

  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 12 then
    raise exception 'Debe incluir entre 1 y 12 ítems';
  end if;

  v_codigo := public.generar_codigo();

  insert into public.solicitudes (codigo, token_hash, municipio, barrio, categoria, nota, es_prueba)
  values (v_codigo, encode(extensions.digest(p_token, 'sha256'), 'hex'),
          p_municipio, p_barrio, p_categoria, nullif(trim(p_nota), ''),
          trim(p_barrio) ilike 'prueba%')
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

      -- Mismo filtro que la nota: es texto libre que entra desde fuera.
      if v_sugerencia ~ '(\+?57)?[ -]?3[0-9]{9}|[0-9]{7,}|@[a-zA-Z0-9._-]+\.[a-z]{2,}' then
        raise exception 'El nombre de lo que sugieres no puede contener teléfonos ni correos';
      end if;

      insert into public.sugerencias_item (nombre_propuesto, categoria_sugerida, origen)
      values (v_sugerencia, p_categoria, 'solicitante')
      returning id into v_sug_id;

      insert into public.solicitud_items (solicitud_id, sugerencia_id, cantidad)
      values (v_id, v_sug_id, (v_item->>'cantidad')::numeric);
    end if;
  end loop;

  return query select v_id, v_codigo;
end;
$$;

grant execute on function public.crear_solicitud(text,text,text,text,jsonb,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Las dos lecturas pasan a left join
--
-- ⚠ El `coalesce` va sobre las TRES columnas, no solo sobre el nombre. La
-- agregación usa `c.nombre`, `c.unidad` y `order by c.orden`: con un left
-- join a secas, `unidad` queda en NULL y `describirItem()` en
-- src/lib/catalogo.ts renderiza literalmente "3 null de Crema dental" en
-- el tablero público — un cambio pensado para mejorar el flujo acabando
-- por degradarlo.
--
-- `por_confirmar` es lo que la interfaz necesita para marcar el ítem sin
-- tener que adivinarlo, y evita aflojar el tipo de `unidad` en TypeScript.
-- Los sugeridos van al final del listado: `coalesce(c.orden, 9999)`.
-- ---------------------------------------------------------------------

create or replace view public.solicitudes_publicas as
select
  s.id,
  s.codigo,
  s.municipio,
  m.nombre as municipio_nombre,
  s.barrio,
  s.categoria,
  s.nota,
  s.creada_at,
  s.confirmada_at,
  s.expira_at,
  extract(epoch from (now() - s.confirmada_at)) / 3600 as horas_sin_confirmar,
  (select count(*) from public.respuestas r where r.solicitud_id = s.id) as num_respuestas,
  (select coalesce(jsonb_agg(jsonb_build_object(
             'nombre',        coalesce(c.nombre, sg.nombre_propuesto),
             'cantidad',      si.cantidad,
             'unidad',        coalesce(c.unidad, sg.unidad_sugerida, 'unidad'),
             'por_confirmar', si.sugerencia_id is not null
           ) order by coalesce(c.orden, 9999)), '[]'::jsonb)
     from public.solicitud_items si
     left join public.catalogo_items c    on c.id = si.item_id
     left join public.sugerencias_item sg on sg.id = si.sugerencia_id
    where si.solicitud_id = s.id) as items
from public.solicitudes s
join public.municipios m on m.codigo_dane = s.municipio
where s.estado = 'abierta'
  and s.expira_at > now();

grant select on public.solicitudes_publicas to anon, authenticated;

create or replace function public.leer_solicitud(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol  public.solicitudes;
  v_resp jsonb;
  v_items jsonb;
begin
  select * into v_sol from public.solicitudes
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if not found then
    raise exception 'Solicitud no encontrada o vencida';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'mensaje', r.mensaje, 'creada_at', r.creada_at,
           'nombre', p.nombre_visible, 'contacto', p.contacto_publico,
           'contacto_tipo', p.contacto_tipo, 'tipo', p.tipo,
           'profesion', sv.profesion, 'verificado', coalesce(sv.verificado, false)
         ) order by r.creada_at desc), '[]'::jsonb)
    into v_resp
    from public.respuestas r
    join public.perfiles p on p.id = r.autor_id
    left join public.servidores sv on sv.perfil_id = p.id
   where r.solicitud_id = v_sol.id and p.suspendido = false;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre',        coalesce(c.nombre, sg.nombre_propuesto),
           'cantidad',      si.cantidad,
           'unidad',        coalesce(c.unidad, sg.unidad_sugerida, 'unidad'),
           'cubierto',      si.cubierto,
           'por_confirmar', si.sugerencia_id is not null
         ) order by coalesce(c.orden, 9999)), '[]'::jsonb)
    into v_items
    from public.solicitud_items si
    left join public.catalogo_items c    on c.id = si.item_id
    left join public.sugerencias_item sg on sg.id = si.sugerencia_id
   where si.solicitud_id = v_sol.id;

  return jsonb_build_object(
    'id', v_sol.id, 'codigo', v_sol.codigo, 'municipio', v_sol.municipio,
    'barrio', v_sol.barrio, 'categoria', v_sol.categoria, 'nota', v_sol.nota,
    'estado', v_sol.estado, 'expira_at', v_sol.expira_at,
    'items', v_items, 'respuestas', v_resp
  );
end;
$$;

grant execute on function public.leer_solicitud(text) to anon, authenticated;

-- Comprobar:
--   select codigo, items from public.solicitudes_publicas order by creada_at desc limit 3;
--   select estado, count(*) from public.sugerencias_item group by 1;
