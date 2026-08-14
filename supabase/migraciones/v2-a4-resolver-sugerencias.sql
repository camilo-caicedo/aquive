-- =====================================================================
-- v2 · Fase A · 4 de 4 — resolver sugerencias
--
-- Aprobar, rechazar o fusionar. Sin la fusión terminaríamos con "crema
-- dental", "crema de dientes" y "pasta dental" como tres ítems distintos y
-- el cruce dejaría de encontrar nada — que es justo lo que la sugerencia
-- existía para evitar.
--
-- Y aprobar o fusionar NO termina al escribir `estado`: hay que remapear
-- las filas que ya apuntaban a la sugerencia. Si no, un ofertador con
-- `sugerencia_id = X` y una solicitud con `item_id = crema_dental` dejan de
-- cruzar para siempre.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. El id de un ítem del catálogo es TEXTO, no uuid
--
-- `catalogo_items.id` es una PK legible ('agua', 'panales_2'), así que al
-- aprobar hay que fabricarla a partir del nombre. Sin `unaccent` —que no
-- está instalada y no vale la pena instalar por esto— las tildes se
-- traducen a mano.
-- ---------------------------------------------------------------------

create or replace function public.slug_item(p_nombre text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_try  text;
  v_n    integer := 1;
begin
  v_base := lower(trim(p_nombre));
  v_base := translate(v_base, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN');
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '_', 'g');
  v_base := trim(both '_' from v_base);
  v_base := left(v_base, 40);

  if v_base = '' then
    raise exception 'Ese nombre no sirve para crear un ítem';
  end if;

  v_try := v_base;
  while exists (select 1 from public.catalogo_items c where c.id = v_try) loop
    v_n := v_n + 1;
    v_try := left(v_base, 37) || '_' || v_n;
  end loop;

  return v_try;
end;
$$;

revoke execute on function public.slug_item(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Alta manual de un ítem
-- ---------------------------------------------------------------------

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

  v_id := public.slug_item(p_nombre);

  insert into public.catalogo_items (id, categoria, nombre, unidad, orden, creado_por, origen)
  values (v_id, p_categoria, trim(p_nombre),
          coalesce(nullif(trim(p_unidad), ''), 'unidad'), 9999, v_uid, 'admin');

  return v_id;
end;
$$;

revoke execute on function public.crear_item_catalogo(text,text,text) from public, anon;
grant  execute on function public.crear_item_catalogo(text,text,text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Resolver una sugerencia
--
-- `aprobar` y `fusionar` son la misma operación: apuntar todo lo que
-- referenciaba la sugerencia a un ítem del catálogo. Lo único que cambia
-- es si ese ítem se acaba de crear o ya existía. Tratarlas como una sola
-- es lo que garantiza que aprobar tampoco deje filas colgando en "por
-- confirmar" para siempre.
--
-- En la Fase D esto lo podrá llamar también un aliado activo. Hoy solo
-- administrador: el rol todavía no existe.
-- ---------------------------------------------------------------------

create or replace function public.resolver_sugerencia(
  p_sugerencia_id uuid,
  p_accion        text,             -- 'aprobar' | 'rechazar' | 'fusionar'
  p_item_destino  text default null, -- solo para 'fusionar'
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
    return null;
  end if;

  if p_accion = 'aprobar' then
    v_destino := public.slug_item(v_sug.nombre_propuesto);
    insert into public.catalogo_items (id, categoria, nombre, unidad, orden, creado_por, origen)
    values (v_destino,
            coalesce(v_sug.categoria_sugerida, 'otros'),
            trim(v_sug.nombre_propuesto),
            coalesce(nullif(trim(v_sug.unidad_sugerida), ''), 'unidad'),
            9999, v_uid, 'sugerencia');
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
-- 4. La cola, con candidatos para fusionar
--
-- Existe por un error que apareció probando: el catálogo ya tenía
-- "Cepillo de dientes" y aprobar la sugerencia del mismo nombre creó
-- `cepillo_de_dientes` al lado de `cepillo_dientes` — exactamente la
-- duplicación que la fusión existe para evitar. Aprobar es un clic más
-- fácil que fusionar, así que si la pantalla no pone el ítem parecido
-- enfrente, nadie va a ir a buscarlo.
--
-- La coincidencia es por palabras de 4 letras o más, sin tildes. No hace
-- falta `pg_trgm` para esto y no vale la pena instalarla.
-- ---------------------------------------------------------------------

create or replace function public.sugerencias_pendientes()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_out jsonb;
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',                 sg.id,
           'nombre_propuesto',   sg.nombre_propuesto,
           'categoria_sugerida', sg.categoria_sugerida,
           'origen',             sg.origen,
           'creada_at',          sg.creada_at,
           'usos',               (select count(*) from public.solicitud_items si
                                   where si.sugerencia_id = sg.id)
                               + (select count(*) from public.ofrecimientos o
                                   where o.sugerencia_id = sg.id),
           'parecidos', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'id', c.id, 'nombre', c.nombre, 'categoria', c.categoria)), '[]'::jsonb)
               from public.catalogo_items c
              where c.activo
                and exists (
                  select 1 from unnest(string_to_array(
                           lower(translate(sg.nombre_propuesto, 'áéíóúü', 'aeiouu')), ' ')) w
                   where char_length(w) >= 4
                     and lower(translate(c.nombre, 'áéíóúü', 'aeiouu')) like '%' || w || '%')
           )
         ) order by sg.creada_at), '[]'::jsonb)
    into v_out
    from public.sugerencias_item sg
   where sg.estado = 'pendiente';

  return v_out;
end;
$$;

revoke execute on function public.sugerencias_pendientes() from public, anon;
grant  execute on function public.sugerencias_pendientes() to authenticated;

-- Comprobar:
--   select estado, count(*) from public.sugerencias_item group by 1;
--   select count(*) from public.solicitud_items where sugerencia_id is not null;
