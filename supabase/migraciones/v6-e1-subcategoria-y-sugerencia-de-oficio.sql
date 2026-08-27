-- =====================================================================
-- v6 · Fase E · 1 — categoría y subcategoría, en los dos lados (ADR 0013)
--
-- *Categoría* es `catalogo_oficios.grupo`: los doce del ADR 0012.
-- *Subcategoría* es una fila de `catalogo_oficios`: las ochenta y una.
-- No se inventa ninguna tabla para eso; se usa lo que ya hay.
--
-- Lo que sí entra nuevo es la maquinaria para que alguien PROPONGA una
-- subcategoría que no está, sin perderla y sin publicarla antes de que
-- alguien la mire.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · `sugerencias_item` aprende a llevar oficios
--
-- La columna `tipo` y su CHECK con 'oficio' ya existían y nunca se
-- usaron: las 2 filas de la tabla son `tipo = 'item'`. Lo que faltaba era
-- dónde guardar la categoría del oficio propuesto y a qué apunta cuando
-- se aprueba.
--
-- ⚠ `categoria_sugerida` NO se reutiliza. Su CHECK son las ocho
-- categorías de insumos —alimentacion, aseo, salud…— y las de oficio son
-- otras doce. Meter los dos juegos en una columna obliga a aflojar el
-- CHECK hasta que deje de garantizar nada.
-- ---------------------------------------------------------------------

alter table public.sugerencias_item
  add column if not exists grupo_sugerido text,
  add column if not exists oficio_resultante_id text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'sugerencias_item_oficio_resultante_fkey') then
    alter table public.sugerencias_item
      add constraint sugerencias_item_oficio_resultante_fkey
      foreign key (oficio_resultante_id)
      references public.catalogo_oficios(id) on delete set null;
  end if;
end $$;

alter table public.sugerencias_item
  drop constraint if exists sugerencias_item_grupo_sugerido_check;

alter table public.sugerencias_item
  add constraint sugerencias_item_grupo_sugerido_check
  check (grupo_sugerido is null or grupo_sugerido = any (array[
    'comida', 'belleza', 'confeccion', 'transporte',
    'aseo', 'cuidado', 'reparacion', 'otros',
    'construccion', 'ensenanza', 'eventos', 'digital'
  ]));

-- Cada tipo con sus columnas y sin las del otro. Sin esto una sugerencia
-- de oficio podría llegar sin categoría y aterrizar en 'otros' sin que
-- nadie lo decidiera.
alter table public.sugerencias_item
  drop constraint if exists sugerencias_item_tipo_coherente;

alter table public.sugerencias_item
  add constraint sugerencias_item_tipo_coherente check (
    case tipo
      when 'oficio' then grupo_sugerido is not null and categoria_sugerida is null
      else grupo_sugerido is null
    end
  );

comment on column public.sugerencias_item.grupo_sugerido is
  'La categoría del oficio propuesto (ADR 0012/0013). Solo con tipo = ''oficio''. Gemela de categoria_sugerida, que es de insumos y tiene otro CHECK.';


-- ---------------------------------------------------------------------
-- 2 · `solicitudes_servicio` vuelve a apuntar a un oficio
--
-- El ADR 0011 dejó `oficio_id` anulable y sin escribir. El ADR 0013 lo
-- vuelve a escribir, y el `detalle` —que era obligatorio de 3 a 80— pasa
-- a opcional: identifica la subcategoría, no la línea escrita.
-- ---------------------------------------------------------------------

alter table public.solicitudes_servicio
  alter column detalle drop not null;

alter table public.solicitudes_servicio
  drop constraint if exists solicitudes_servicio_detalle_check;

alter table public.solicitudes_servicio
  add constraint solicitudes_servicio_detalle_check
  check (detalle is null
         or (char_length(btrim(detalle)) >= 3 and char_length(btrim(detalle)) <= 80));

alter table public.solicitudes_servicio
  add column if not exists sugerencia_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'solicitudes_servicio_sugerencia_fkey') then
    alter table public.solicitudes_servicio
      add constraint solicitudes_servicio_sugerencia_fkey
      foreign key (sugerencia_id)
      references public.sugerencias_item(id) on delete set null;
  end if;
end $$;

-- Del catálogo o propuesta, nunca las dos. Mismo patrón que
-- `solicitud_items`, que lleva `item_id` y `sugerencia_id` con su check.
alter table public.solicitudes_servicio
  drop constraint if exists solicitudes_servicio_una_subcategoria;

alter table public.solicitudes_servicio
  add constraint solicitudes_servicio_una_subcategoria
  check (num_nonnulls(oficio_id, sugerencia_id) <= 1);

-- Red de seguridad, no la regla: quien EXIGE la subcategoría es el borde
-- (Zod en el contrato). Esto solo impide que entre una solicitud que no
-- dice absolutamente nada de qué se trata.
alter table public.solicitudes_servicio
  drop constraint if exists solicitudes_servicio_dice_algo;

alter table public.solicitudes_servicio
  add constraint solicitudes_servicio_dice_algo
  check (num_nonnulls(oficio_id, sugerencia_id) = 1 or detalle is not null);

create index if not exists solicitudes_servicio_oficio_idx
  on public.solicitudes_servicio (oficio_id) where oficio_id is not null;


-- ---------------------------------------------------------------------
-- 3 · Un prestador puede proponer un oficio sin perderlo
--
-- ⚠ `proveedor_oficios` tiene llave primaria `(proveedor_id, oficio_id)`,
-- así que `oficio_id` NO puede volverse anulable sin operar esa llave y,
-- con ella, la vista que sostiene la regla de producto 7. Por eso el
-- oficio propuesto vive aparte hasta que exista de verdad.
--
-- Que esté fuera de `proveedor_oficios` es justo lo que lo mantiene sin
-- publicar: `proveedor_oficios_publicos` hace `join catalogo_oficios`, o
-- sea que lo que no está en el catálogo es invisible por construcción, no
-- por un filtro que alguien pueda olvidar (ADR 0013).
--
-- Lleva el precio ya elegido para no volver a pedírselo a su dueño el día
-- que se apruebe.
-- ---------------------------------------------------------------------

create table if not exists public.proveedor_oficios_sugeridos (
  proveedor_id  uuid not null references public.proveedores(id) on delete cascade,
  sugerencia_id uuid not null references public.sugerencias_item(id) on delete cascade,
  modo          text not null default 'normal',
  precio_desde  numeric,
  unidad        text,
  creado_at     timestamptz not null default now(),
  primary key (proveedor_id, sugerencia_id),
  constraint pos_modo_check check (modo = any (array['gratis','aporte','solidario','normal'])),
  constraint pos_unidad_check check (unidad is null or unidad = any (array[
    'hora','trabajo','dia','prenda','viaje','plato','unidad'])),
  -- Los tres del gemelo `proveedor_oficios`, palabra por palabra: si el
  -- precio se valida distinto aquí, al aprobar la fila rebota contra el
  -- CHECK de allá y el prestador pierde lo que escribió.
  constraint pos_precio_rango check (precio_desde is null
    or (precio_desde >= 0 and precio_desde <= 99999999)),
  constraint pos_precio_con_unidad check (precio_desde is null or unidad is not null),
  constraint pos_precio_solo_si_cobra check (
    modo = any (array['solidario','normal']) or precio_desde is null)
);

comment on table public.proveedor_oficios_sugeridos is
  'Oficios que un prestador propuso y todavía no existen en el catálogo (ADR 0013). Al aprobar la sugerencia, la fila se copia a proveedor_oficios con su precio y se borra de aquí.';

alter table public.proveedor_oficios_sugeridos enable row level security;

drop policy if exists pos_lee_su_dueno on public.proveedor_oficios_sugeridos;
create policy pos_lee_su_dueno on public.proveedor_oficios_sugeridos
  for select to authenticated
  using (
    exists (select 1 from public.proveedores p
             where p.id = proveedor_id and p.perfil_id = auth.uid())
    or exists (select 1 from public.administradores a where a.user_id = auth.uid())
  );

-- Escribir va por el dominio con la llave de servicio, como el resto de
-- las escrituras de la ficha. Nadie escribe esto desde el navegador.
revoke insert, update, delete on public.proveedor_oficios_sugeridos from anon, authenticated;


-- ---------------------------------------------------------------------
-- 4 · `slug_oficio`, gemela de `slug_item`
--
-- Aparte y no un parámetro más, porque lo que cambia es contra qué tabla
-- comprueba que el identificador esté libre. Una sola función con un
-- `if` dentro tendría que recibir la tabla como texto, y eso ya no es una
-- función: es SQL dinámico en el camino de una escritura.
-- ---------------------------------------------------------------------

create or replace function public.slug_oficio(p_nombre text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
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
    raise exception 'Ese nombre no sirve para crear un oficio';
  end if;

  v_try := v_base;
  while exists (select 1 from public.catalogo_oficios c where c.id = v_try) loop
    v_n := v_n + 1;
    v_try := left(v_base, 37) || '_' || v_n;
  end loop;

  return v_try;
end;
$function$;

revoke execute on function public.slug_oficio(text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 5 · La vista pública dice la subcategoría
--
-- ⚠ LEFT JOIN las dos veces, nunca INNER: una solicitud puede no tener
-- oficio (las que ya existen, y las que llevan sugerencia) y un INNER se
-- las traga enteras sin dar error. Es exactamente el fallo de `v6-b3`.
--
-- ⚠ Las columnas nuevas van al FINAL. `create or replace view` no admite
-- reordenar ni renombrar: falla con «cannot change name of view column».
-- ---------------------------------------------------------------------

create or replace view public.solicitudes_servicio_publicas as
  select s.id,
         s.codigo,
         s.grupo,
         s.detalle,
         s.municipio,
         s.zona_id,
         z.nombre as zona_nombre,
         s.zona_texto,
         s.urgencia,
         s.capacidad_pago,
         s.nota,
         s.creada_at,
         s.expira_at,
         (select count(*) from public.respuestas_servicio rs
           where rs.solicitud_id = s.id) as num_respuestas,
         s.oficio_id,
         o.nombre as oficio_nombre,
         -- El texto que su dueño escribió, mientras nadie lo ha mirado.
         -- Se publica ya (ADR 0011): quien pide necesita respuesta hoy.
         sg.nombre_propuesto as subcategoria_propuesta
    from public.solicitudes_servicio s
    left join public.zonas z            on z.id = s.zona_id
    left join public.catalogo_oficios o on o.id = s.oficio_id
    left join public.sugerencias_item sg on sg.id = s.sugerencia_id
   where s.estado = 'abierta' and s.expira_at > now();


-- ---------------------------------------------------------------------
-- 6 · El tablero y la cola de admin las devuelven
-- ---------------------------------------------------------------------

create or replace function public.solicitudes_de_servicio(
  p_municipio text default null,
  p_grupo text default null,
  p_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_prov uuid := public.proveedor_del_llamante(p_token);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'codigo', s.codigo,
      'grupo', s.grupo,
      'detalle', s.detalle,
      -- Lo que titula la tarjeta desde el ADR 0013: el nombre del oficio,
      -- o el propuesto si todavía nadie lo ha mirado. Los dos nulos solo
      -- en las solicitudes anteriores al ADR, que siguen con su detalle.
      'oficio_id', s.oficio_id,
      'oficio_nombre', s.oficio_nombre,
      'subcategoria_propuesta', s.subcategoria_propuesta,
      'municipio', s.municipio,
      'zona_nombre', s.zona_nombre,
      'zona_texto', s.zona_texto,
      'urgencia', s.urgencia,
      'capacidad_pago', s.capacidad_pago,
      'nota', s.nota,
      'creada_at', s.creada_at,
      'num_respuestas', s.num_respuestas,
      'ya_respondi', v_prov is not null and exists (
        select 1 from public.respuestas_servicio r
         where r.solicitud_id = s.id and r.proveedor_id = v_prov),
      -- De aquí cuelga el hilo. Nulo mientras no haya respondido.
      'mi_respuesta_id', (
        select r.id from public.respuestas_servicio r
         where r.solicitud_id = s.id and r.proveedor_id = v_prov)
    ) order by
        case s.urgencia when 'hoy' then 0 when 'esta_semana' then 1 else 2 end,
        s.creada_at desc)
    from public.solicitudes_servicio_publicas s
    where (p_municipio is null or s.municipio = p_municipio)
      and (p_grupo is null or s.grupo = p_grupo)
  ), '[]'::jsonb);
end;
$function$;

revoke execute on function public.solicitudes_de_servicio(text, text, text) from public;
grant  execute on function public.solicitudes_de_servicio(text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 7 · `sugerencias_pendientes` distingue ítem de oficio
--
-- Antes mezclaba los dos sin decir cuál era cuál y buscaba los parecidos
-- SIEMPRE en `catalogo_items`, así que una sugerencia de oficio salía sin
-- ningún parecido y el administrador la aprobaba creyendo que no había
-- nada igual.
-- ---------------------------------------------------------------------

create or replace function public.sugerencias_pendientes()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare v_out jsonb;
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',                 sg.id,
           'tipo',               sg.tipo,
           'nombre_propuesto',   sg.nombre_propuesto,
           'categoria_sugerida', sg.categoria_sugerida,
           'grupo_sugerido',     sg.grupo_sugerido,
           'origen',             sg.origen,
           'creada_at',          sg.creada_at,
           -- Cuántas cosas la usan hoy. Es lo que hace decidir: una que
           -- nadie usa se puede rechazar sin romperle nada a nadie.
           'usos', case sg.tipo
             when 'oficio' then
               (select count(*) from public.solicitudes_servicio ss
                 where ss.sugerencia_id = sg.id)
             + (select count(*) from public.proveedor_oficios_sugeridos pos
                 where pos.sugerencia_id = sg.id)
             else
               (select count(*) from public.solicitud_items si
                 where si.sugerencia_id = sg.id)
             + (select count(*) from public.ofrecimientos o
                 where o.sugerencia_id = sg.id)
           end,
           'parecidos', case sg.tipo
             when 'oficio' then (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'id', c.id, 'nombre', c.nombre, 'categoria', c.grupo)), '[]'::jsonb)
                 from public.catalogo_oficios c
                where c.activo
                  and exists (
                    select 1 from unnest(string_to_array(
                             lower(translate(sg.nombre_propuesto, 'áéíóúü', 'aeiouu')), ' ')) w
                     where char_length(w) >= 4
                       and lower(translate(c.nombre, 'áéíóúü', 'aeiouu')) like '%' || w || '%'))
             else (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'id', c.id, 'nombre', c.nombre, 'categoria', c.categoria)), '[]'::jsonb)
                 from public.catalogo_items c
                where c.activo
                  and exists (
                    select 1 from unnest(string_to_array(
                             lower(translate(sg.nombre_propuesto, 'áéíóúü', 'aeiouu')), ' ')) w
                     where char_length(w) >= 4
                       and lower(translate(c.nombre, 'áéíóúü', 'aeiouu')) like '%' || w || '%'))
           end
         ) order by sg.creada_at), '[]'::jsonb)
    into v_out
    from public.sugerencias_item sg
   where sg.estado = 'pendiente';

  return v_out;
end;
$function$;

revoke execute on function public.sugerencias_pendientes() from public, anon;
grant  execute on function public.sugerencias_pendientes() to authenticated;


-- ---------------------------------------------------------------------
-- 8 · `resolver_sugerencia` aprende la rama de oficio
--
-- Cambia de firma —entran el nombre corregido, la categoría y el
-- riesgo—, así que hay que tirar la anterior antes.
--
-- ⚠ `p_riesgo` NO tiene valor por defecto, y la pantalla tampoco lo
-- prellena. La regla de producto 7 cuelga de esa columna: un «cuidar a mi
-- sobrino después del colegio» aprobado como `bajo` porque el formulario
-- traía `bajo` puesto se salta el filtro entero —teléfono verificado Y
-- referencia confirmada— y sale publicado.
-- ---------------------------------------------------------------------

drop function if exists public.resolver_sugerencia(uuid, text, text, text);

create or replace function public.resolver_sugerencia(
  p_sugerencia_id uuid,
  p_accion        text,
  p_item_destino  text default null,
  p_nota          text default null,
  p_nombre_final  text default null,
  p_grupo         text default null,
  p_riesgo        text default null)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid     uuid := auth.uid();
  v_sug     public.sugerencias_item;
  v_destino text;
  v_estado  text;
  v_nombre  text;
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

  -- El administrador puede corregir el texto antes de aprobarlo: casi
  -- siempre es una tilde o un plural, y obligar a rechazar y esperar a
  -- que la persona lo vuelva a escribir es perder la propuesta.
  v_nombre := coalesce(nullif(btrim(p_nombre_final), ''), btrim(v_sug.nombre_propuesto));

  -- =================================================================
  -- Rechazar: igual para los dos tipos
  -- =================================================================
  if p_accion = 'rechazar' then
    update public.sugerencias_item
       set estado = 'rechazada', revisada_por = v_uid, revisada_at = now(),
           nota_revision = nullif(trim(p_nota), '')
     where id = p_sugerencia_id;

    -- Sin esto, el inventario que la referenciaba queda "por confirmar"
    -- para siempre: nadie lo va a resolver nunca. El inventario se puede
    -- volver a llenar; la solicitud no se toca, porque su necesidad es real
    -- y de todos modos se borra sola.
    delete from public.ofrecimientos where sugerencia_id = p_sugerencia_id;
    -- Y el oficio propuesto de una ficha, que nunca llegó a publicarse.
    delete from public.proveedor_oficios_sugeridos where sugerencia_id = p_sugerencia_id;
    return null;
  end if;

  -- El mismo guardia de siempre, y vale para los dos catálogos: los dos
  -- son de lectura pública y permanente, y no hay RPC para borrar de
  -- ninguno. Un clic distraído publicaría ese teléfono para siempre.
  if public.contiene_pii(v_nombre) then
    raise exception 'Esa sugerencia trae un teléfono o un correo: recházala, no la apruebes';
  end if;

  -- =================================================================
  -- Oficio (ADR 0013)
  -- =================================================================
  if v_sug.tipo = 'oficio' then
    if p_accion = 'aprobar' then
      if p_riesgo is null or p_riesgo not in ('bajo','alto') then
        raise exception 'Elige el riesgo del oficio: es lo que decide si se publica sin verificar';
      end if;

      v_destino := public.slug_oficio(v_nombre);
      insert into public.catalogo_oficios (id, grupo, nombre, riesgo, activo, orden)
      values (v_destino,
              coalesce(nullif(btrim(p_grupo), ''), v_sug.grupo_sugerido),
              v_nombre,
              p_riesgo,
              true,
              9999);
      v_estado := 'aprobada';
    else
      v_destino := p_item_destino;
      if v_destino is null then
        raise exception 'Indica con qué oficio se fusiona';
      end if;
      if not exists (select 1 from public.catalogo_oficios c where c.id = v_destino) then
        raise exception 'Ese oficio no existe en el catálogo';
      end if;
      v_estado := 'fusionada';
    end if;

    -- La solicitud pasa a apuntar al oficio de verdad. Su `detalle` se
    -- queda como estaba: es contexto de quien pidió, no el nombre.
    update public.solicitudes_servicio
       set oficio_id = v_destino, sugerencia_id = null
     where sugerencia_id = p_sugerencia_id;

    -- Y el oficio propuesto entra en la ficha, con el precio que su dueño
    -- ya había puesto. `on conflict do nothing` porque puede que entre
    -- tanto haya elegido a mano el oficio destino de una fusión: ahí gana
    -- lo que ya está publicado.
    insert into public.proveedor_oficios (proveedor_id, oficio_id, modo, precio_desde, unidad)
    select pos.proveedor_id, v_destino, pos.modo, pos.precio_desde, pos.unidad
      from public.proveedor_oficios_sugeridos pos
     where pos.sugerencia_id = p_sugerencia_id
    on conflict (proveedor_id, oficio_id) do nothing;

    delete from public.proveedor_oficios_sugeridos where sugerencia_id = p_sugerencia_id;

    update public.sugerencias_item
       set estado = v_estado, oficio_resultante_id = v_destino,
           revisada_por = v_uid, revisada_at = now(),
           nota_revision = nullif(trim(p_nota), '')
     where id = p_sugerencia_id;

    return v_destino;
  end if;

  -- =================================================================
  -- Ítem de insumos: lo de siempre, sin un cambio
  -- =================================================================
  if p_accion = 'aprobar' then
    v_destino := public.slug_item(v_nombre);
    insert into public.catalogo_items (id, categoria, nombre, unidad, orden, creado_por, origen, es_prueba)
    values (v_destino,
            coalesce(v_sug.categoria_sugerida, 'otros'),
            v_nombre,
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
$function$;

revoke execute on function public.resolver_sugerencia(uuid, text, text, text, text, text, text)
  from public, anon;
grant  execute on function public.resolver_sugerencia(uuid, text, text, text, text, text, text)
  to authenticated;
