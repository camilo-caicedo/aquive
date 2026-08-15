-- =====================================================================
-- v2 · La fundación entrega de su propia bodega
--
-- Faltaba un caso entero: una fundación que YA TIENE lo que alguien pidió
-- no podía entregárselo. Tenía que esperar a que apareciera un ofertador,
-- porque toda entrega colgaba de una conversación con uno.
--
-- Ahora puede abrir un hilo con quien pidió, sin ofertador de por medio,
-- y usar el mismo camino de siempre: registrar la entrega, exportar la
-- planilla, esperar la confirmación.
--
-- Sin inventario de organizaciones, a propósito: la fundación ve la
-- solicitud entera y decide a ojo qué saca de la bodega. Un inventario que
-- alguien tiene que mantener al día es un cruce que miente en cuanto se
-- descuida.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cómo se reconoce un hilo sin ofertador
--
-- ⚠ NO se puede reconocer por `ofertador_id is null`, y esto es lo más
-- importante de esta migración.
--
-- Esa columna va en ON DELETE SET NULL porque borrar la cuenta es un
-- derecho: cuando un ofertador borra la suya, SU hilo también se queda con
-- `ofertador_id` nulo. Un índice único parcial sobre la nulidad haría que,
-- si esa solicitud ya tenía un hilo directo, el borrado de cuenta violara
-- el índice y FALLARA — exactamente el problema que el SET NULL existe
-- para evitar (§5.7-4). Y además `null` significaría dos cosas distintas.
--
-- Por eso, columna explícita.
-- ---------------------------------------------------------------------

alter table public.conversaciones
  add column if not exists directa boolean not null default false;

comment on column public.conversaciones.directa is
  'La fundación entrega de su bodega: no hay ofertador. NO se deduce de `ofertador_id is null` — esa columna va en ON DELETE SET NULL y también queda nula cuando el ofertador borra su cuenta, que es otra cosa.';

-- Uno por solicitud. Cada solicitud acompañada tiene una sola
-- organización, así que la organización no hace falta en la clave.
create unique index if not exists conversaciones_directa_uniq
  on public.conversaciones (solicitud_id) where directa;

-- Un hilo directo no gana un ofertador después. Este CHECK sí es seguro:
-- SET NULL solo puede llevar `ofertador_id` a null, que es lo que exige.
--
-- ⚠ NO añadir aquí `aliado_id is not null`: esa columna también es SET
-- NULL, y el CHECK rompería el borrado de la cuenta del aliado. Que haya
-- aliado lo garantiza la RPC de abajo, no un CHECK.
alter table public.conversaciones
  drop constraint if exists conversaciones_directa_sin_ofertador;
alter table public.conversaciones
  add  constraint conversaciones_directa_sin_ofertador
  check (not directa or ofertador_id is null);

-- ---------------------------------------------------------------------
-- 2. Abrir el hilo
--
-- Sobre la regla L: este hilo NO la viola. La regla dice que un hilo sin
-- aliado a cargo no acepta mensajes, y este nace con `aliado_id` puesto en
-- el mismo INSERT: nunca existe un instante sin nadie a cargo.
--
-- Y de fondo: lo que la regla L impide es el aparte entre dos desconocidos
-- coordinando un encuentro sin un tercero responsable delante. Aquí las
-- dos partes son quien pidió y la organización que él mismo eligió, dada
-- de alta por un administrador que miró el RUES y el NIT. Hay una persona
-- menos viendo el hilo, no una más.
--
-- `exigir_hilo_con_aliado` NO se toca: es lo único que sostiene la regla L
-- en producción.
-- ---------------------------------------------------------------------

create or replace function public.abrir_entrega_directa(
  p_solicitud_id uuid,
  p_mensaje      text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_sol  public.solicitudes;
  v_conv uuid;
begin
  select * into v_sol from public.solicitudes s
   where s.id = p_solicitud_id
     and public.estado_activo(s.estado)
     and s.expira_at > now();

  if v_sol.id is null then
    raise exception 'Esa solicitud ya no está disponible';
  end if;

  -- Innegociable, y por la misma razón que en `coincidencias_para_aliado`:
  -- sin esto la fundación podría abrirle un hilo a alguien del Flujo 1,
  -- que nunca aceptó nada ni sabe que existe. Sería la regla R rota por la
  -- puerta de atrás.
  if v_sol.flujo <> 'acompanado' then
    raise exception 'Esa solicitud no tiene acompañamiento';
  end if;

  if not public.es_miembro_activo(v_sol.organizacion_id, v_uid) then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(p_mensaje)) < 10 or char_length(p_mensaje) > 1000 then
    raise exception 'El mensaje debe tener entre 10 y 1000 caracteres';
  end if;

  -- Regla M, igual que en cualquier otro hilo. No se relaja porque quien
  -- escribe sea la fundación.
  if public.contiene_contacto(p_mensaje) then
    raise exception 'No escribas teléfonos, correos ni enlaces de mensajería';
  end if;

  insert into public.conversaciones
    (solicitud_id, ofertador_id, aliado_id, organizacion_id, estado, directa)
  values
    (v_sol.id, null, v_uid, v_sol.organizacion_id, 'abierta', true)
  on conflict (solicitud_id) where directa do nothing
  returning id into v_conv;

  if v_conv is null then
    raise exception 'Ya abriste una conversación de entrega para esta solicitud';
  end if;

  -- Sin `aquive.mensaje_inicial`: el hilo ya nace `abierta` y el trigger lo
  -- deja pasar. La excepción solo hace falta cuando nace `asignada`.
  insert into public.mensajes (conversacion_id, autor_rol, autor_perfil_id, cuerpo)
  values (v_conv, 'aliado', v_uid, trim(p_mensaje));

  update public.solicitudes set estado = 'en_coordinacion'
   where id = v_sol.id and estado = 'abierta';

  return v_conv;
end;
$$;

revoke execute on function public.abrir_entrega_directa(uuid,text) from public, anon;
grant  execute on function public.abrir_entrega_directa(uuid,text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Qué puede atender la fundación por su cuenta
--
-- Sin `v_cruces` y sin `ofrecimientos`: no hay inventario de
-- organizaciones y no se va a inventar uno. Esto es la lista de lo que su
-- organización acompaña y todavía no ha atendido; la fundación mira los
-- ítems y decide.
--
-- Devuelve lo mismo que ya es público en el tablero. Cero PII: el nombre
-- de quien pidió sigue saliendo solo por `exportar_planilla`, con motivo y
-- rastro en `accesos_identidad`.
-- ---------------------------------------------------------------------

create or replace function public.solicitudes_de_mi_organizacion()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'creada_at'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'solicitud_id',  s.id,
        'codigo',        s.codigo,
        'municipio',     m.nombre,
        'barrio',        s.barrio,
        'categoria',     s.categoria,
        'nota',          s.nota,
        'creada_at',     s.creada_at,
        'puede_recoger', s.puede_recoger,
        -- Cuántos hilos vivos tiene ya: si alguien más está trayendo esto,
        -- la fundación decide distinto.
        'hilos',         (select count(*) from public.conversaciones c
                           where c.solicitud_id = s.id and c.estado <> 'cerrada'),
        'pendientes',    (select coalesce(jsonb_agg(jsonb_build_object(
                                  'nombre',   coalesce(ci.nombre, sg.nombre_propuesto),
                                  'cantidad', si.cantidad,
                                  'unidad',   coalesce(ci.unidad, sg.unidad_sugerida, 'unidad')
                                ) order by coalesce(ci.orden, 9999)), '[]'::jsonb)
                            from public.solicitud_items si
                            left join public.catalogo_items ci   on ci.id = si.item_id
                            left join public.sugerencias_item sg on sg.id = si.sugerencia_id
                           where si.solicitud_id = s.id and si.cubierto = false)
      ) as x
      from public.solicitudes s
      join public.municipios m on m.codigo_dane = s.municipio
     where s.flujo = 'acompanado'
       and public.estado_activo(s.estado)
       and s.expira_at > now()
       and public.es_miembro_activo(s.organizacion_id, auth.uid())
       and exists (select 1 from public.solicitud_items si
                    where si.solicitud_id = s.id and si.cubierto = false)
       and not exists (select 1 from public.conversaciones c
                        where c.solicitud_id = s.id and c.directa)
    ) t;
$$;

revoke execute on function public.solicitudes_de_mi_organizacion() from public, anon;
grant  execute on function public.solicitudes_de_mi_organizacion() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Las cuatro lecturas que hay que enterar
--
-- Todo lo demás —`registrar_entrega`, `confirmar_recepcion`,
-- `exportar_planilla`, `rol_en_conversacion`, `enviar_mensaje`,
-- `asignar_aliado`, `destinatarios_conversacion`— funciona sin tocarse.
-- `rol_en_conversacion` sobre todo: con `ofertador_id` nulo la comparación
-- da NULL, no true, así que cae a la rama de miembro y devuelve 'aliado'.
-- ---------------------------------------------------------------------

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
           'directa',  c.directa,
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
        'directa',       c.directa,
        -- `coalesce` y no la comparación pelada: en un hilo directo
        -- `ofertador_id` es nulo, y `null = uuid` da NULL, no false. Sin
        -- esto el campo llega como null al navegador y `soy_ofertador`
        -- deja de ser un booleano.
        'soy_ofertador', coalesce(c.ofertador_id = auth.uid(), false),
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
    'directa',  v_conv.directa,
    'codigo',   (select s.codigo from public.solicitudes s where s.id = v_conv.solicitud_id),
    'acopio',   (select jsonb_build_object('nombre', o.nombre,
                          'direccion', o.direccion_acopio,
                          'horario', o.horario_acopio)
                   from public.organizaciones o where o.id = v_conv.organizacion_id),
    'pendientes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id',            si.id,
               'item_id',       si.item_id,
               'sugerencia_id', si.sugerencia_id,
               'nombre',        coalesce(c.nombre, sg.nombre_propuesto),
               'cantidad',      si.cantidad,
               'unidad',        coalesce(c.unidad, sg.unidad_sugerida, 'unidad')
             ) order by coalesce(c.orden, 9999)), '[]'::jsonb)
        from public.solicitud_items si
        left join public.catalogo_items c    on c.id = si.item_id
        left join public.sugerencias_item sg on sg.id = si.sugerencia_id
       where si.solicitud_id = v_conv.solicitud_id and si.cubierto = false),
    'mensajes', public.mensajes_de(p_conversacion_id)
  );
end;
$$;

revoke execute on function public.leer_conversacion(uuid) from public, anon;
grant  execute on function public.leer_conversacion(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Elegir fundación viendo dónde queda cada una
--
-- `aliado_en_municipio` devolvía UNA y solo `{id, nombre}`: omitía el
-- acopio a propósito. Pero sin dirección no se puede elegir «la que me
-- quede más fácil», que es justo lo que hace falta al publicar.
--
-- Publicar la dirección de acopio a `anon` es un cambio deliberado. Es la
-- dirección de una ORGANIZACIÓN, no de una persona.
-- ---------------------------------------------------------------------

create or replace function public.aliados_del_municipio(p_municipio text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',               o.id,
           'nombre',           o.nombre,
           'direccion_acopio', o.direccion_acopio,
           'horario_acopio',   o.horario_acopio
         ) order by o.nombre), '[]'::jsonb)
    from public.organizaciones o
   where o.activa and p_municipio = any(o.municipios);
$$;

grant execute on function public.aliados_del_municipio(text) to anon, authenticated;

drop function if exists public.aliado_en_municipio(text);

-- Comprobar:
--   -- La que justifica la columna `directa`: con un hilo directo y otro
--   -- tripartito en la misma solicitud, borrar la cuenta del ofertador
--   -- tiene que pasar. Con un índice sobre `ofertador_id is null`, falla.
--   select public.solicitudes_de_mi_organizacion();
--   select public.aliados_del_municipio('76001');
