-- =====================================================================
-- v3 · Fase T · 1 — el cruce al revés: «¿quién tiene lo que pido?»
--
-- Hasta ahora el cruce solo iba en un sentido. `solicitudes_que_calzan`
-- (v2-b1) responde «¿quién necesita lo que tengo?» y la responde para
-- cualquiera, sin cuenta, porque no expone nada que el tablero público no
-- exponga ya. Este es el sentido contrario, y NO puede resolverse igual.
--
-- ⚠ Por qué no basta con agregarle `contacto_publico` a
-- `ofertadores_publicos`. Esa vista dice, palabra por palabra, que va sin
-- contacto «a propósito: el contacto ocurre cuando el ofertador responde
-- una solicitud, no al revés», y que sus ítems van sin cantidades porque
-- «una lista pública de quién tiene cuánto y dónde es un mapa de
-- existencias». Ponerle teléfono a esa lista la convierte en un
-- directorio de a quién llamar para saber quién guarda qué, abierto a
-- cualquiera que entre sin publicar nada.
--
-- Lo que cambia aquí es otra cosa: el teléfono se destapa a QUIEN TIENE EL
-- TOKEN de una solicitud viva que de verdad pide eso, de a una persona, y
-- con tope. La vista pública no se toca y sigue sin contacto.
--
-- Las cuatro guardas, que son el diseño y no un adorno:
--
--   1 · Token portador de una solicitud activa y no vencida. Sin él no hay
--       ninguna respuesta, ni siquiera la lista.
--   2 · Que esa persona tenga de verdad algo de lo que la solicitud pide,
--       comprobado en SQL sobre `ofrecimientos`, no sobre lo que mande el
--       cliente.
--   3 · Mismo municipio. Agua en Bogotá no le sirve a quien pide en Cali,
--       y ensanchar el radio ensancharía justo lo que se quiere estrecho.
--   4 · Tope de 30 destapes por solicitud, contados en `destapes_contacto`.
--       Sin esto, una solicitud inventada con doce ítems se lleva la lista
--       de teléfonos del municipio en una tarde.
--
-- Y la regla M: con fundación acompañando NO se destapa ningún teléfono.
-- Ahí el contacto pasa por la fundación, que para eso está.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- El registro de destapes
--
-- Existe para el tope, y de paso deja rastro. NO es `accesos_identidad`:
-- aquello sobrevive a lo que registra porque es la prueba de quién leyó un
-- documento cifrado. Esto cuelga de la solicitud y se va con ella a las 72
-- horas, como todo lo demás — el borrado duro manda (regla 4), y aquí no
-- hay nada que probar: el dato que se destapa es un teléfono que su dueño
-- publicó voluntariamente.
--
-- Revocada entera y con RLS sin políticas, igual que `identidades`: la
-- única puerta son las dos funciones de abajo.
-- ---------------------------------------------------------------------

create table if not exists public.destapes_contacto (
  solicitud_id uuid not null references public.solicitudes(id) on delete cascade,
  perfil_id    uuid not null references public.perfiles(id)    on delete cascade,
  destapado_at timestamptz not null default now(),
  primary key (solicitud_id, perfil_id)
);

comment on table public.destapes_contacto is
  'Qué contactos destapó una solicitud. Sostiene el tope por solicitud. Sin PII: dos identificadores y una fecha. Muere con la solicitud.';

alter table public.destapes_contacto enable row level security;
revoke all on public.destapes_contacto from anon, authenticated;

-- ---------------------------------------------------------------------
-- La lista: quién tiene algo de lo que pide esta solicitud
--
-- Devuelve lo mismo que la ficha pública —nombre, municipios, descripción,
-- si puede trasladarse, y los NOMBRES de lo que tiene, sin cantidades— más
-- tres cosas nuevas: cuántas de las cosas pedidas calzan, qué ítem calza y
-- cuál no (para poder pintarlo), y si el contacto ya se destapó.
--
-- ⚠ NO devuelve `contacto_publico`. Eso es de `destapar_contacto`, de a
-- uno. Si viniera aquí, el tope de 30 sería decorativo: una sola llamada
-- traería veinte teléfonos.
--
-- `total` viene de `count(*) over ()`, que se calcula antes del `limit`:
-- sirve para el número de la pestaña sin traer la página entera.
-- ---------------------------------------------------------------------

create or replace function public.ofertadores_que_calzan(
  p_token  text,
  p_limite integer default 20,
  p_desde  integer default 0
)
returns table (
  id                uuid,
  nombre_visible    text,
  municipios        text[],
  descripcion       text,
  puede_trasladarse boolean,
  items             jsonb,
  total_items       bigint,
  coincidencias     integer,
  destapado         boolean,
  total             bigint
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_sol    public.solicitudes;
  v_items  text[];
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_desde  integer := greatest(coalesce(p_desde, 0), 0);
begin
  select * into v_sol
    from public.solicitudes s
   where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and public.estado_activo(s.estado)
     and s.expira_at > now();

  -- Sin token válido no se dice nada, ni siquiera que no hay nada: esta
  -- función no puede servir para averiguar si un token existe.
  if v_sol.id is null then
    return;
  end if;

  select coalesce(array_agg(si.item_id) filter (where si.item_id is not null), '{}')
    into v_items
    from public.solicitud_items si
   where si.solicitud_id = v_sol.id;

  -- Una solicitud hecha solo de sugerencias todavía no tiene con qué
  -- cruzar: los ítems propuestos no están en el catálogo, así que nadie
  -- puede tenerlos declarados.
  if cardinality(v_items) = 0 then
    return;
  end if;

  return query
  select p.id,
         p.nombre_visible,
         p.municipios,
         p.descripcion,
         p.puede_trasladarse,
         -- Lo que calza va primero y marcado, para que la tarjeta pueda
         -- pintarlo aparte sin volver a comparar en el cliente.
         (select coalesce(
                   jsonb_agg(t.x order by (t.x->>'calza') desc, t.x->>'nombre'),
                   '[]'::jsonb)
            from (
              select jsonb_build_object(
                       'nombre',        coalesce(c.nombre, sg.nombre_propuesto),
                       'por_confirmar', o.sugerencia_id is not null,
                       'calza',         o.item_id = any(v_items)
                     ) as x
                from public.ofrecimientos o
                left join public.catalogo_items c    on c.id = o.item_id
                left join public.sugerencias_item sg on sg.id = o.sugerencia_id
               where o.perfil_id = p.id and o.disponible
               order by (o.item_id = any(v_items)) desc, coalesce(c.orden, 9999)
               limit 12
            ) t) as items,
         (select count(*) from public.ofrecimientos o
           where o.perfil_id = p.id and o.disponible) as total_items,
         calza.n::integer as coincidencias,
         exists (select 1 from public.destapes_contacto d
                  where d.solicitud_id = v_sol.id and d.perfil_id = p.id) as destapado,
         count(*) over () as total
    from public.perfiles p
    cross join lateral (
      select count(*) as n
        from public.ofrecimientos o
       where o.perfil_id = p.id
         and o.disponible
         and o.item_id = any(v_items)
    ) calza
   where p.suspendido = false
     and p.acepto_publicacion = true
     -- Un aliado no tiene ficha pública ni contacto publicado, así que
     -- tampoco puede aparecer aquí aunque haya declarado inventario.
     and p.tipo <> 'aliado'
     and p.contacto_publico is not null
     and v_sol.municipio = any(p.municipios)
     and calza.n > 0
   order by calza.n desc, p.puede_trasladarse desc, p.creado_at desc
   limit v_limite offset v_desde;
end;
$$;

grant execute on function public.ofertadores_que_calzan(text,integer,integer)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- El destape, de a uno
--
-- Se separa de la lista a propósito: es el único sitio donde sale un
-- teléfono, y así el tope se cuenta sobre actos deliberados de una persona
-- y no sobre cuántas veces se recargó una pantalla.
-- ---------------------------------------------------------------------

create or replace function public.destapar_contacto(
  p_token     text,
  p_perfil_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol   public.solicitudes;
  v_p     public.perfiles;
  v_usados integer;
begin
  select * into v_sol
    from public.solicitudes s
   where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and public.estado_activo(s.estado)
     and s.expira_at > now();

  if v_sol.id is null then
    raise exception 'Solicitud no encontrada o vencida';
  end if;

  -- Regla M. Con una fundación coordinando, los teléfonos no se
  -- intercambian por aquí: ellos hablan con los dos.
  if v_sol.flujo = 'acompanado' then
    raise exception 'Esta solicitud la coordina una fundación: el contacto pasa por ellos';
  end if;

  select * into v_p
    from public.perfiles p
   where p.id = p_perfil_id
     and p.suspendido = false
     and p.acepto_publicacion = true
     and p.tipo <> 'aliado'
     and p.contacto_publico is not null
     and v_sol.municipio = any(p.municipios);

  if v_p.id is null then
    raise exception 'Esa persona ya no está disponible';
  end if;

  -- Que de verdad tenga algo de lo que ESTA solicitud pide. Es la guarda
  -- que impide usar la pantalla como agenda: sin ella, un identificador de
  -- perfil cualquiera devolvería un teléfono.
  if not exists (
    select 1
      from public.ofrecimientos o
      join public.solicitud_items si on si.item_id = o.item_id
     where o.perfil_id = v_p.id
       and o.disponible
       and si.solicitud_id = v_sol.id
  ) then
    raise exception 'Esa persona no tiene nada de lo que pediste';
  end if;

  select count(*) into v_usados
    from public.destapes_contacto d
   where d.solicitud_id = v_sol.id;

  -- El tope cuenta personas distintas, no toques: volver a mirar un
  -- contacto que ya se destapó no gasta nada.
  if v_usados >= 30
     and not exists (select 1 from public.destapes_contacto d
                      where d.solicitud_id = v_sol.id and d.perfil_id = v_p.id) then
    raise exception 'Ya viste el contacto de 30 personas con esta solicitud';
  end if;

  insert into public.destapes_contacto (solicitud_id, perfil_id)
  values (v_sol.id, v_p.id)
  on conflict (solicitud_id, perfil_id) do nothing;

  return jsonb_build_object(
    'nombre',        v_p.nombre_visible,
    'contacto',      v_p.contacto_publico,
    'contacto_tipo', v_p.contacto_tipo
  );
end;
$$;

grant execute on function public.destapar_contacto(text,uuid) to anon, authenticated;

-- Comprobar:
--   select nombre_visible, coincidencias, total from public.ofertadores_que_calzan('<token>');
--   select public.destapar_contacto('<token>', '<perfil_id>');
--   select * from public.destapes_contacto;
