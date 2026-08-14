-- =====================================================================
-- v2 · Fase G — Chat tripartito
--
-- Solo para el Flujo 2. Tres roles hablan en el mismo hilo: quien pidió
-- (por token), quien ofrece (por sesión) y el aliado de la fundación (por
-- sesión). El administrador puede leer y escribir en cualquiera, y cuando
-- lo hace se ve.
--
-- Las dos reglas que sostienen esto, y que van en la base y no en la
-- interfaz:
--
--   L · Ninguna conversación puede ser bilateral. Un hilo sin aliado
--       asignado no acepta mensajes. Sin excepción y sin que lo decidan
--       los participantes: si se permite el aparte, no queda nada que
--       distinga al Flujo 2 del Flujo 1 salvo la recolección de datos,
--       que sería lo peor de los dos mundos.
--   M · El chat filtra datos de contacto. Sin esto la regla L es
--       decorativa: se intercambian el teléfono en el primer mensaje y la
--       conversación sigue por fuera.
--
-- El hilo NO es un archivo. Muere con la solicitud, por CASCADE, y eso se
-- le dice a los tres en pantalla.
--
-- Idempotente. Se puede volver a correr.
--
-- ---------------------------------------------------------------------
-- Sobre el tiempo real, y por qué aquí no hace falta
--
-- El plan pedía Supabase Realtime «no polling», y la razón que daba era
-- de cuota: veinte conversaciones sondeando desde Vercel se comen el
-- millón de invocaciones del plan Hobby en tres días.
--
-- Ese razonamiento no aplica a cómo quedó el chat: las lecturas van del
-- NAVEGADOR a Supabase por RPC, sin pasar por Vercel, así que sondear no
-- gasta ni una invocación. Y Realtime sí tendría un costo real aquí:
-- `postgres_changes` respeta RLS, y estas tablas están revocadas enteras
-- con cero políticas —la frontera son las RPC—, así que habría que
-- abrirles un `select` a `authenticated`… y aun así el solicitante, que
-- es anónimo con token, no tiene `auth.uid()` con el que autorizarlo.
--
-- Queda entonces lo que el propio plan admite como respaldo: sondeo de 30
-- segundos, solo con la conversación visible en pantalla.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Regla M — el filtro anti-contacto
--
-- Más estricto que `contiene_pii`, y aparte de él a propósito: aquel
-- protege una nota de solicitud, este protege un canal de conversación,
-- que es donde alguien va a intentar en serio saltarse el filtro.
--
-- Cubre lo de `contiene_pii` más los tres atajos evidentes: los acortadores
-- de mensajería, las arrobas de red social y —el que aparece a los diez
-- minutos de que alguien descubra el filtro— los dígitos escritos con
-- letras: «tres uno cero, dos cuatro…».
--
-- Gemela de `contieneContacto` en src/lib/validacion.ts. Si cambia una,
-- cambia la otra.
-- ---------------------------------------------------------------------

create or replace function public.contiene_contacto(p_texto text)
returns boolean
language sql
security definer
immutable
set search_path = ''
as $$
  select p_texto is not null
     and (
       public.contiene_pii(p_texto)
       -- Enlaces de mensajería y de redes. No es una lista completa y no
       -- pretende serlo: cierra lo que la gente escribe de verdad.
       or p_texto ~* '(wa\.me|api\.whatsapp|chat\.whatsapp|whatsapp\.com|t\.me|telegram\.|m\.me|messenger\.com|instagram\.com|facebook\.com|linktr\.ee)'
       -- Una arroba pegada a cualquier cosa, aunque no parezca correo.
       or p_texto ~* '@[a-z0-9._-]'
       -- Cuatro o más dígitos seguidos escritos con letras. Cuatro y no
       -- tres para no reventar en «los tres niños de la casa dos».
       or lower(p_texto) ~ '((cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)[^[:alnum:]]+){3,}(cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)'
     );
$$;

revoke execute on function public.contiene_contacto(text) from public, anon, authenticated;

comment on function public.contiene_contacto(text) is
  'Regla M. Gemela de contieneContacto en src/lib/validacion.ts. Más estricta que contiene_pii: cubre además wa.me, t.me, arrobas sueltas y dígitos escritos con letras. Sin esto, la regla L es decorativa.';

-- ---------------------------------------------------------------------
-- 2. Las dos tablas
--
-- NO hay tabla de participantes: los tres roles son columnas. Con tres
-- roles fijos, una tabla de participantes solo agrega un join y la
-- posibilidad de un hilo con dos ofertadores, que no existe.
-- ---------------------------------------------------------------------

create table if not exists public.conversaciones (
  id              uuid primary key default gen_random_uuid(),
  -- CASCADE: el hilo muere con la solicitud, a las 72 horas o cuando la
  -- cierren. No es un archivo y no debe sobrevivirla.
  solicitud_id    uuid not null references public.solicitudes(id) on delete cascade,
  -- ⚠ Los dos en SET NULL, no CASCADE. Si fueran CASCADE, borrar una
  -- cuenta —que es un derecho y ya está implementado— se llevaría el hilo
  -- entero, incluidos los mensajes de las otras dos personas. Y con NO
  -- ACTION el borrado de cuenta empezaría a fallar (§5.7-4).
  ofertador_id    uuid references public.perfiles(id) on delete set null,
  aliado_id       uuid references public.perfiles(id) on delete set null,
  organizacion_id uuid references public.organizaciones(id) on delete set null,
  -- `asignada` existe por la regla L: sin ese estado, un hilo con
  -- organización pero sin persona a cargo quedaría «abierto» y sería
  -- bilateral de hecho, que es justo lo prohibido.
  estado          text not null default 'esperando_aliado'
                    check (estado in ('esperando_aliado','asignada','abierta',
                                      'acordada','entregada','cerrada')),
  creada_at       timestamptz not null default now(),
  cerrada_at      timestamptz,
  -- Un ofertador, un hilo por solicitud. Volver a escribir no abre otro.
  unique (solicitud_id, ofertador_id)
);

comment on table public.conversaciones is
  'Chat tripartito del Flujo 2. Muere con la solicitud (CASCADE). Sin tabla de participantes: los tres roles son columnas, y los dos que son cuentas van en SET NULL para no romper el borrado de cuenta.';

create index if not exists idx_conversaciones_solicitud
  on public.conversaciones(solicitud_id);
create index if not exists idx_conversaciones_organizacion
  on public.conversaciones(organizacion_id, estado);

create table if not exists public.mensajes (
  id              uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  autor_rol       text not null
                    check (autor_rol in ('solicitante','ofertador','aliado','admin')),
  -- NULL para el solicitante, que no tiene cuenta, y para cuando la
  -- cuenta del autor se borre. El `autor_rol` sobrevive igual, así que el
  -- hilo se sigue leyendo.
  autor_perfil_id uuid references public.perfiles(id) on delete set null,
  cuerpo          text not null check (char_length(cuerpo) between 1 and 1000),
  creado_at       timestamptz not null default now(),
  -- Moderar oculta, no borra: si un mensaje hay que atenderlo, la
  -- evidencia de que existió tiene que quedar hasta que muera el hilo.
  oculto          boolean not null default false,
  oculto_por      uuid references auth.users(id) on delete set null,
  oculto_at       timestamptz
);

create index if not exists idx_mensajes_conversacion
  on public.mensajes(conversacion_id, creado_at);

-- ---------------------------------------------------------------------
-- 3. Regla L, en la base
--
-- Un hilo sin aliado a cargo no acepta mensajes. El trigger es el que lo
-- sostiene; las RPC lo repiten para dar un mensaje legible.
--
-- ⚠ La excepción del mensaje inicial. `iniciar_conversacion` tiene que
-- poder guardar el primer mensaje mientras el hilo está en `asignada`, y
-- lo hace prendiendo `aquive.mensaje_inicial` en la transacción.
--
-- Lo que impide que un cliente prenda esa variable NO es que la RPC sea
-- `security definer` —eso es irrelevante aquí—: es que `set_config` vive
-- en `pg_catalog` y PostgREST no la expone como RPC. Si algún día se
-- expone una función que llame a `set_config` con un parámetro que venga
-- del cliente, esta defensa cae y la regla L se puede saltar desde fuera.
-- ---------------------------------------------------------------------

create or replace function public.exigir_hilo_con_aliado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
begin
  select c.estado into v_estado
    from public.conversaciones c where c.id = new.conversacion_id;

  if v_estado in ('esperando_aliado','asignada')
     and coalesce(current_setting('aquive.mensaje_inicial', true), 'off') <> 'on' then
    raise exception 'Este hilo todavía no tiene a nadie de la fundación a cargo';
  end if;

  if v_estado in ('cerrada','entregada') then
    raise exception 'Esta conversación ya está cerrada';
  end if;

  return new;
end;
$$;

drop trigger if exists tr_hilo_con_aliado on public.mensajes;
create trigger tr_hilo_con_aliado
  before insert on public.mensajes
  for each row execute function public.exigir_hilo_con_aliado();

revoke execute on function public.exigir_hilo_con_aliado() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. RLS — revocadas, cero políticas
--
-- Como `solicitudes`, como las tres de la Fase D y como las dos de la E.
-- Aquí no hay alternativa: uno de los tres participantes es anónimo con
-- token, así que no hay `auth.uid()` con el que escribir una política que
-- lo incluya. La frontera son las RPC.
-- ---------------------------------------------------------------------

alter table public.conversaciones enable row level security;
alter table public.mensajes       enable row level security;

revoke all on public.conversaciones from anon, authenticated;
revoke all on public.mensajes       from anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Pertenencia al hilo
--
-- Una sola función que responde qué papel juega quien pregunta, para no
-- repetir la condición en cinco RPC. Devuelve NULL si no es nadie.
-- ---------------------------------------------------------------------

create or replace function public.rol_en_conversacion(p_conversacion_id uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when public.es_admin(auth.uid()) then 'admin'
    when exists (select 1 from public.conversaciones c
                  where c.id = p_conversacion_id and c.ofertador_id = auth.uid())
      then 'ofertador'
    when exists (select 1 from public.conversaciones c
                  where c.id = p_conversacion_id
                    and public.es_miembro_activo(c.organizacion_id, auth.uid()))
      then 'aliado'
  end;
$$;

revoke execute on function public.rol_en_conversacion(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Abrir el hilo — F5
--
-- Lo llama quien ofrece, sobre una solicitud acompañada. Antes de esto la
-- pantalla tiene que haberle explicado que la entrega es en el acopio,
-- que le van a pedir documento allá, y cuánto vive ese dato.
-- ---------------------------------------------------------------------

create or replace function public.iniciar_conversacion(p_codigo text, p_mensaje text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_sol  public.solicitudes;
  v_org  public.organizaciones;
  v_conv uuid;
  v_estado text;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not exists (select 1 from public.perfiles p
                  where p.id = v_uid and p.suspendido = false) then
    raise exception 'Necesitas completar tu perfil antes de escribir';
  end if;

  if char_length(trim(p_mensaje)) < 10 or char_length(p_mensaje) > 1000 then
    raise exception 'El mensaje debe tener entre 10 y 1000 caracteres';
  end if;

  if public.contiene_contacto(p_mensaje) then
    raise exception 'No escribas teléfonos, correos ni enlaces de mensajería: la coordinación ocurre aquí';
  end if;

  select * into v_sol from public.solicitudes s
   where s.codigo = upper(trim(p_codigo))
     and public.estado_activo(s.estado)
     and s.expira_at > now();

  if v_sol.id is null then
    raise exception 'Esa solicitud ya no está disponible';
  end if;

  -- El hilo tripartito existe solo para el Flujo 2. En el Flujo 1 la
  -- plataforma no se mete en la conversación, y eso es la regla 3.
  if v_sol.flujo <> 'acompanado' then
    raise exception 'Esa solicitud no tiene acompañamiento: respóndela como siempre';
  end if;

  select * into v_org from public.organizaciones o
   where o.id = v_sol.organizacion_id and o.activa;

  -- Fallback de §8-F5: si la fundación se desactivó entre medias, el hilo
  -- nace esperando y no se pierde. Devolver la solicitud a `directo` es
  -- decisión de la Fase I, no de aquí.
  v_estado := case when v_org.id is null then 'esperando_aliado' else 'asignada' end;

  insert into public.conversaciones (solicitud_id, ofertador_id, organizacion_id, estado)
  values (v_sol.id, v_uid, v_org.id, v_estado)
  on conflict (solicitud_id, ofertador_id) do nothing
  returning id into v_conv;

  if v_conv is null then
    raise exception 'Ya tienes una conversación abierta sobre esta solicitud';
  end if;

  -- La excepción de la regla L, acotada a esta transacción. Ver el
  -- comentario del trigger: lo que impide que esto lo prenda un cliente
  -- no es `security definer`.
  perform set_config('aquive.mensaje_inicial', 'on', true);

  insert into public.mensajes (conversacion_id, autor_rol, autor_perfil_id, cuerpo)
  values (v_conv, 'ofertador', v_uid, trim(p_mensaje));

  perform set_config('aquive.mensaje_inicial', 'off', true);

  return v_conv;
end;
$$;

revoke execute on function public.iniciar_conversacion(text,text) from public, anon;
grant  execute on function public.iniciar_conversacion(text,text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Hacerse cargo — `asignada` → `abierta`
--
-- Aquí es donde el hilo empieza a aceptar mensajes, y donde la solicitud
-- pasa a `en_coordinacion`: no cuando alguien escribe, sino cuando hay
-- una persona concreta respondiendo por ella.
-- ---------------------------------------------------------------------

create or replace function public.asignar_aliado(p_conversacion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_conv public.conversaciones;
begin
  select * into v_conv from public.conversaciones c where c.id = p_conversacion_id;

  if v_conv.id is null then
    raise exception 'Esa conversación no existe';
  end if;

  if not public.es_miembro_activo(v_conv.organizacion_id, v_uid) then
    raise exception 'No autorizado';
  end if;

  if v_conv.estado not in ('asignada','esperando_aliado') then
    raise exception 'Esa conversación ya tiene a alguien a cargo';
  end if;

  update public.conversaciones
     set aliado_id = v_uid, estado = 'abierta'
   where id = p_conversacion_id;

  update public.solicitudes
     set estado = 'en_coordinacion'
   where id = v_conv.solicitud_id
     and estado = 'abierta';
end;
$$;

revoke execute on function public.asignar_aliado(uuid) from public, anon;
grant  execute on function public.asignar_aliado(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Escribir
--
-- Dos puertas porque hay dos formas de ser alguien aquí: una sesión, o el
-- token de la solicitud. La validación es la misma en las dos.
-- ---------------------------------------------------------------------

create or replace function public.enviar_mensaje(p_conversacion_id uuid, p_cuerpo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text := public.rol_en_conversacion(p_conversacion_id);
  v_id  uuid;
begin
  if v_rol is null then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(p_cuerpo)) < 1 or char_length(p_cuerpo) > 1000 then
    raise exception 'El mensaje debe tener entre 1 y 1000 caracteres';
  end if;

  if public.contiene_contacto(p_cuerpo) then
    raise exception 'No escribas teléfonos, correos ni enlaces de mensajería: la coordinación ocurre aquí';
  end if;

  insert into public.mensajes (conversacion_id, autor_rol, autor_perfil_id, cuerpo)
  values (p_conversacion_id, v_rol, auth.uid(), trim(p_cuerpo))
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.enviar_mensaje(uuid,text) from public, anon;
grant  execute on function public.enviar_mensaje(uuid,text) to authenticated;

create or replace function public.enviar_mensaje_token(
  p_token text,
  p_conversacion_id uuid,
  p_cuerpo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- El token no autoriza «cualquier conversación»: solo las de SU
  -- solicitud. Sin esta comprobación, quien tenga un token cualquiera
  -- podría escribir en el hilo de otra persona.
  if not exists (
    select 1 from public.conversaciones c
      join public.solicitudes s on s.id = c.solicitud_id
     where c.id = p_conversacion_id
       and s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(p_cuerpo)) < 1 or char_length(p_cuerpo) > 1000 then
    raise exception 'El mensaje debe tener entre 1 y 1000 caracteres';
  end if;

  if public.contiene_contacto(p_cuerpo) then
    raise exception 'No escribas tu teléfono ni tu correo: la coordinación ocurre aquí, y así queda constancia';
  end if;

  insert into public.mensajes (conversacion_id, autor_rol, autor_perfil_id, cuerpo)
  values (p_conversacion_id, 'solicitante', null, trim(p_cuerpo))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.enviar_mensaje_token(text,uuid,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. Leer
--
-- Tres lecturas para tres formas de estar en el hilo. Ninguna devuelve un
-- identificador de cuenta: los mensajes salen con el rol de quien escribe
-- y su nombre visible, que es lo que hace falta para seguir la
-- conversación.
-- ---------------------------------------------------------------------

create or replace function public.leer_conversacion(p_conversacion_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_rol  text := public.rol_en_conversacion(p_conversacion_id);
  v_conv public.conversaciones;
begin
  if v_rol is null then
    raise exception 'No autorizado';
  end if;

  select * into v_conv from public.conversaciones c where c.id = p_conversacion_id;

  return jsonb_build_object(
    'id',       v_conv.id,
    'estado',   v_conv.estado,
    'mi_rol',   v_rol,
    'codigo',   (select s.codigo from public.solicitudes s where s.id = v_conv.solicitud_id),
    'acopio',   (select jsonb_build_object('nombre', o.nombre,
                          'direccion', o.direccion_acopio,
                          'horario', o.horario_acopio)
                   from public.organizaciones o where o.id = v_conv.organizacion_id),
    'mensajes', public.mensajes_de(p_conversacion_id)
  );
end;
$$;

revoke execute on function public.leer_conversacion(uuid) from public, anon;
grant  execute on function public.leer_conversacion(uuid) to authenticated;

-- Los mensajes de un hilo, sin comprobar permisos: la comprueban las tres
-- funciones que la llaman. Por eso queda revocada para todo el mundo.
create or replace function public.mensajes_de(p_conversacion_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',        m.id,
           'rol',       m.autor_rol,
           'nombre',    p.nombre_visible,
           'cuerpo',    case when m.oculto then null else m.cuerpo end,
           'oculto',    m.oculto,
           'creado_at', m.creado_at
         ) order by m.creado_at), '[]'::jsonb)
    from public.mensajes m
    left join public.perfiles p on p.id = m.autor_perfil_id
   where m.conversacion_id = p_conversacion_id;
$$;

revoke execute on function public.mensajes_de(uuid) from public, anon, authenticated;

-- Lo que ve quien pidió ayuda: todos los hilos de SU solicitud.
create or replace function public.mis_conversaciones_token(p_token text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',       c.id,
           'estado',   c.estado,
           'ofertador', (select p.nombre_visible from public.perfiles p
                          where p.id = c.ofertador_id),
           'aliado',    (select p.nombre_visible from public.perfiles p
                          where p.id = c.aliado_id),
           'acopio',   (select jsonb_build_object('nombre', o.nombre,
                                 'direccion', o.direccion_acopio,
                                 'horario', o.horario_acopio)
                          from public.organizaciones o where o.id = c.organizacion_id),
           'mensajes', public.mensajes_de(c.id)
         ) order by c.creada_at), '[]'::jsonb)
    from public.conversaciones c
    join public.solicitudes s on s.id = c.solicitud_id
   where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

grant execute on function public.mis_conversaciones_token(text) to anon, authenticated;

-- Lo que ve una cuenta: los hilos donde ofrece, y los de las
-- organizaciones donde es miembro activo.
create or replace function public.mis_hilos()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'creada_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id',            c.id,
        'estado',        c.estado,
        'creada_at',     c.creada_at,
        'codigo',        s.codigo,
        'municipio',     m.nombre,
        'barrio',        s.barrio,
        'soy_ofertador', c.ofertador_id = auth.uid(),
        'ofertador',     (select p.nombre_visible from public.perfiles p where p.id = c.ofertador_id),
        'aliado',        (select p.nombre_visible from public.perfiles p where p.id = c.aliado_id),
        'sin_asignar',   c.aliado_id is null,
        'mensajes_total',(select count(*) from public.mensajes mm where mm.conversacion_id = c.id)
      ) as x
      from public.conversaciones c
      join public.solicitudes s on s.id = c.solicitud_id
      join public.municipios m  on m.codigo_dane = s.municipio
     where c.ofertador_id = auth.uid()
        or public.es_miembro_activo(c.organizacion_id, auth.uid())
    ) t;
$$;

revoke execute on function public.mis_hilos() from public, anon;
grant  execute on function public.mis_hilos() to authenticated;

-- ---------------------------------------------------------------------
-- 10. Moderar — oculta, no borra
-- ---------------------------------------------------------------------

create or replace function public.moderar_mensaje(p_mensaje_id uuid, p_oculto boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  select c.organizacion_id into v_org
    from public.mensajes m
    join public.conversaciones c on c.id = m.conversacion_id
   where m.id = p_mensaje_id;

  if v_org is null and not public.es_admin(v_uid) then
    raise exception 'Ese mensaje no existe';
  end if;

  -- El administrador siempre; el aliado solo si su coordinador le dio el
  -- permiso de moderar, y solo en los hilos de su organización.
  if not (public.es_admin(v_uid)
          or exists (select 1 from public.miembros_organizacion mo
                      where mo.organizacion_id = v_org
                        and mo.perfil_id = v_uid
                        and mo.estado = 'activo'
                        and mo.puede_moderar)) then
    raise exception 'No autorizado';
  end if;

  update public.mensajes
     set oculto = p_oculto,
         oculto_por = case when p_oculto then v_uid end,
         oculto_at  = case when p_oculto then now() end
   where id = p_mensaje_id;
end;
$$;

revoke execute on function public.moderar_mensaje(uuid,boolean) from public, anon;
grant  execute on function public.moderar_mensaje(uuid,boolean) to authenticated;

-- Comprobar:
--   select has_table_privilege('authenticated','public.mensajes','SELECT');   -- f
--   select public.contiene_contacto('escríbeme al tres uno cero dos cuatro'); -- t
--   select public.contiene_contacto('te mando por wa.me/123');                -- t
--   select public.contiene_contacto('llevo tres bultos y dos cajas');         -- f
--
--   -- Regla L: un insert directo en un hilo `asignada` tiene que fallar,
--   -- y el mismo insert dentro de iniciar_conversacion tiene que pasar.
