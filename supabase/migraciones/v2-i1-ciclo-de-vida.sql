-- =====================================================================
-- v2 · Fase I — Ciclo de vida, moderación y habeas data
--
-- La fase que evita que todo lo anterior borre lo que no debe. No agrega
-- funcionalidad visible: arregla las dos funciones que hoy borran a
-- ciegas, y abre la puerta que la ley exige que exista.
--
-- Lo que se arregla, y por qué importa:
--
--   1. `expirar_solicitudes()` borra a las 72 horas SIN MIRAR EL ESTADO.
--      Una solicitud en coordinación, con entrega agendada en el acopio
--      para mañana, desaparecía con su chat y su identidad dentro. Y
--      registraba `cumplida = false` para todas, así que `metricas`
--      —el aporte que sobrevive al proyecto— mentía sobre las que sí se
--      entregaron.
--   2. `resolver_reporte()` hace `delete from solicitudes` directo: un
--      moderador destruía una coordinación viva sin avisarle a nadie y
--      sin dejar métrica.
--
-- Y lo que se agrega:
--
--   · `devolver_a_directo`, que es la única salida del Flujo 2 (§7). No
--     es un botón de menú: se dispara por supresión pedida por el
--     titular, por fundación desactivada con hilos vivos, o por decisión
--     de moderación.
--   · `mis_datos` y `suprimir_mis_datos`, que son los artículos 14 y 15
--     de la Ley 1581 hechos pantalla.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. `metricas` distingue si hubo aliado
--
-- Con `flujo` sola no se puede responder la pregunta que importa: si
-- acompañar sirvió de algo. Una solicitud puede ser `acompanado` y no
-- haber tenido nunca a nadie a cargo.
-- ---------------------------------------------------------------------

alter table public.metricas
  add column if not exists con_aliado boolean not null default false;

comment on column public.metricas.con_aliado is
  'Si alguien de una fundación llegó a hacerse cargo. `flujo = acompanado` dice que se pidió acompañamiento; esto dice si de verdad lo hubo.';

-- ---------------------------------------------------------------------
-- 2. La única salida del Flujo 2
--
-- Borra la identidad, cierra los hilos y devuelve la solicitud a
-- `directo`. Los mensajes NO se borran: contienen palabras de otras dos
-- personas, y el hilo cerrado muere igual con la solicitud.
--
-- No la llama nadie desde un menú. La llaman las tres situaciones de §7,
-- y las tres son decisiones, no preferencias.
-- ---------------------------------------------------------------------

create or replace function public.devolver_a_directo(
  p_solicitud_id uuid,
  p_motivo       text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe por qué se devuelve al flujo directo';
  end if;

  -- La identidad primero: es lo que hay que quitar de en medio.
  delete from public.identidades where solicitud_id = p_solicitud_id;

  update public.conversaciones
     set estado = 'cerrada', cerrada_at = now()
   where solicitud_id = p_solicitud_id
     and estado <> 'cerrada';

  -- El CHECK de coherencia exige que `directo` no tenga organización, así
  -- que las dos columnas se tocan a la vez o no se toca ninguna.
  update public.solicitudes
     set flujo = 'directo',
         organizacion_id = null,
         estado = case when estado = 'en_coordinacion' then 'abierta' else estado end
   where id = p_solicitud_id;
end;
$$;

revoke execute on function public.devolver_a_directo(uuid,text) from public, anon, authenticated;

comment on function public.devolver_a_directo(uuid,text) is
  'La única salida del Flujo 2 (§7). Sin grant a nadie: la llaman otras RPC security definer —supresión pedida por el titular, moderación— y nunca un cliente. No hay botón de «volver a anónimo».';

-- ---------------------------------------------------------------------
-- 3. `expirar_solicitudes` deja de borrar coordinaciones vivas
--
-- Tres pasos, y el orden es el que hace que funcione:
--
--   1. Auto-renovar las vencidas que tengan hilo vivo, con TECHO DURO de
--      14 días desde que se publicaron. El techo existe para que una
--      coordinación estancada no mantenga una identidad cifrada viva para
--      siempre: la promesa es que esto se borra, no que se borra pronto.
--   2. Cerrar los hilos de las que ya no se renuevan. Al llegar al techo
--      se cierra, no se prolonga.
--   3. Métrica y borrado, ahora con `cumplida` de verdad.
--
-- ⚠ Sigue sin tener EXECUTE para nadie: la dispara `pg_cron`. Nunca se
-- llama a mano — para probar la lógica, se hace una variante acotada a una
-- sola fila.
-- ---------------------------------------------------------------------

create or replace function public.expirar_solicitudes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  -- 1 · Lo que sigue vivo se renueva solo.
  update public.solicitudes s
     set expira_at = now() + interval '72 hours'
   where s.expira_at <= now()
     and s.creada_at > now() - interval '14 days'
     and exists (select 1 from public.conversaciones c
                  where c.solicitud_id = s.id and c.estado <> 'cerrada');

  -- 2 · Lo que llegó al techo se cierra antes de borrarse, para que el
  -- hilo no desaparezca a mitad de una frase.
  update public.conversaciones c
     set estado = 'cerrada', cerrada_at = now()
   where c.estado <> 'cerrada'
     and exists (select 1 from public.solicitudes s
                  where s.id = c.solicitud_id and s.expira_at <= now());

  -- 3 · La métrica, ahora sin mentir: `entregada_parcial` y `cumplida`
  -- cuentan como cumplidas, porque hubo entrega.
  insert into public.metricas (
    municipio, categoria, cumplida, horas_hasta_respuesta,
    horas_hasta_cierre, num_respuestas, es_prueba, flujo, con_aliado)
  select s.municipio, s.categoria,
         s.estado in ('cumplida','entregada_parcial'),
         extract(epoch from (min(r.creada_at) - s.creada_at)) / 3600,
         extract(epoch from (s.expira_at - s.creada_at)) / 3600,
         count(r.id), s.es_prueba, s.flujo,
         exists (select 1 from public.conversaciones c
                  where c.solicitud_id = s.id and c.aliado_id is not null)
    from public.solicitudes s
    left join public.respuestas r on r.solicitud_id = s.id
   where s.expira_at <= now()
   group by s.id, s.municipio, s.categoria, s.creada_at, s.expira_at,
            s.es_prueba, s.flujo, s.estado;

  delete from public.solicitudes where expira_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.expirar_solicitudes() from public, anon, authenticated;

-- Y `cerrar_solicitud` también, por lo mismo: si alguien cierra una
-- solicitud que estuvo acompañada, la métrica tiene que decirlo.
create or replace function public.cerrar_solicitud(p_token text, p_cumplida boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_sol public.solicitudes;
begin
  select * into v_sol from public.solicitudes
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then raise exception 'Solicitud no encontrada'; end if;

  insert into public.metricas (
    municipio, categoria, cumplida, horas_hasta_respuesta,
    horas_hasta_cierre, num_respuestas, es_prueba, flujo, con_aliado)
  select v_sol.municipio, v_sol.categoria, p_cumplida,
         extract(epoch from (min(r.creada_at) - v_sol.creada_at)) / 3600,
         extract(epoch from (now() - v_sol.creada_at)) / 3600,
         count(r.id), v_sol.es_prueba, v_sol.flujo,
         exists (select 1 from public.conversaciones c
                  where c.solicitud_id = v_sol.id and c.aliado_id is not null)
    from public.respuestas r where r.solicitud_id = v_sol.id;

  delete from public.solicitudes where id = v_sol.id;   -- CASCADE limpia todo
end;
$$;

grant execute on function public.cerrar_solicitud(text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Moderar una solicitud deja de ser una demolición
--
-- Antes: `delete from solicitudes` y ya. Un moderador destruía una
-- coordinación viva sin avisarle al aliado ni al ofertador, y sin dejar
-- rastro en `metricas`. Ahora se cierra, se cuenta y después se borra.
-- ---------------------------------------------------------------------

create or replace function public.resolver_reporte(p_reporte_id uuid, p_borrar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rep public.reportes;
  v_sol public.solicitudes;
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select * into v_rep from public.reportes where id = p_reporte_id;
  if not found then raise exception 'Reporte no encontrado'; end if;

  if p_borrar then
    if v_rep.tipo_objeto = 'solicitud' then
      select * into v_sol from public.solicitudes where id = v_rep.objeto_id;

      if v_sol.id is not null then
        -- Cerrar los hilos antes de borrar: los participantes ven que se
        -- cerró, no un hueco donde había una conversación.
        update public.conversaciones
           set estado = 'cerrada', cerrada_at = now()
         where solicitud_id = v_sol.id and estado <> 'cerrada';

        -- Y dejar la métrica, que si no se pierde: es la única huella de
        -- que esa solicitud existió.
        insert into public.metricas (
          municipio, categoria, cumplida, horas_hasta_respuesta,
          horas_hasta_cierre, num_respuestas, es_prueba, flujo, con_aliado)
        select v_sol.municipio, v_sol.categoria, false,
               extract(epoch from (min(r.creada_at) - v_sol.creada_at)) / 3600,
               extract(epoch from (now() - v_sol.creada_at)) / 3600,
               count(r.id), v_sol.es_prueba, v_sol.flujo,
               exists (select 1 from public.conversaciones c
                        where c.solicitud_id = v_sol.id and c.aliado_id is not null)
          from public.respuestas r where r.solicitud_id = v_sol.id;

        delete from public.solicitudes where id = v_sol.id;
      end if;

    elsif v_rep.tipo_objeto = 'respuesta' then
      delete from public.respuestas where id = v_rep.objeto_id;
    elsif v_rep.tipo_objeto = 'perfil' then
      update public.perfiles set suspendido = true where id = v_rep.objeto_id;
    elsif v_rep.tipo_objeto = 'entidad' then
      -- Se retira, no se borra: si el enlace se recupera, se vuelve a subir
      -- sin tener que escribir la ficha entera otra vez.
      update public.entidades set activa = false, actualizada_at = now()
       where id = v_rep.objeto_id;
    end if;
  end if;

  update public.reportes set atendido = true where id = p_reporte_id;
end;
$$;

revoke execute on function public.resolver_reporte(uuid,boolean) from public, anon;
grant  execute on function public.resolver_reporte(uuid,boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Bloquear a quien ofrece
--
-- Cierra el hilo y suspende el perfil. Lo puede hacer el administrador, y
-- el aliado con permiso de moderar sobre los hilos de su organización:
-- quien está viendo el problema en tiempo real es la fundación, y hacerla
-- esperar a que un administrador se despierte es dejarla sola.
-- ---------------------------------------------------------------------

create or replace function public.bloquear_ofertador(
  p_conversacion_id uuid,
  p_motivo          text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_conv public.conversaciones;
begin
  if char_length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe por qué se bloquea';
  end if;

  select * into v_conv from public.conversaciones c where c.id = p_conversacion_id;

  if v_conv.id is null then
    raise exception 'Esa conversación no existe';
  end if;

  if not (public.es_admin(v_uid)
          or exists (select 1 from public.miembros_organizacion mo
                      where mo.organizacion_id = v_conv.organizacion_id
                        and mo.perfil_id = v_uid
                        and mo.estado = 'activo'
                        and mo.puede_moderar)) then
    raise exception 'No autorizado';
  end if;

  update public.conversaciones
     set estado = 'cerrada', cerrada_at = now()
   where id = p_conversacion_id;

  update public.perfiles set suspendido = true where id = v_conv.ofertador_id;
end;
$$;

revoke execute on function public.bloquear_ofertador(uuid,text) from public, anon;
grant  execute on function public.bloquear_ofertador(uuid,text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Habeas data — artículos 14 y 15 de la Ley 1581
--
-- Consultar y suprimir, con el token y sin cuenta. En Flujo 1 esta
-- pantalla no hace falta porque no hay nada que consultar; se deja que
-- responda igual, diciendo justamente eso.
--
-- `mis_datos` NO descifra el documento: devuelve el tipo y los cuatro
-- últimos, que es lo que hace falta para reconocer que son los suyos. Ver
-- su propia cédula completa en pantalla no le dice nada que no sepa, y
-- multiplica los sitios por donde ese dato puede salir.
-- ---------------------------------------------------------------------

create or replace function public.mis_datos(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_sol   public.solicitudes;
  v_ident public.identidades;
begin
  select * into v_sol from public.solicitudes s
   where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if v_sol.id is null then
    raise exception 'Solicitud no encontrada o vencida';
  end if;

  select * into v_ident from public.identidades i where i.solicitud_id = v_sol.id;

  return jsonb_build_object(
    'codigo',      v_sol.codigo,
    'flujo',       v_sol.flujo,
    'municipio',   (select m.nombre from public.municipios m
                     where m.codigo_dane = v_sol.municipio),
    'barrio',      v_sol.barrio,
    'nota',        v_sol.nota,
    'creada_at',   v_sol.creada_at,
    'expira_at',   v_sol.expira_at,
    'organizacion', (select o.nombre from public.organizaciones o
                      where o.id = v_sol.organizacion_id),
    'identidad', case when v_ident.id is null then null else jsonb_build_object(
      'documento_tipo',       v_ident.documento_tipo,
      'documento_ultimos4',   v_ident.documento_ultimos4,
      'tiene_telefono',       v_ident.telefono_cifrado is not null,
      'autorizacion_version', v_ident.autorizacion_version,
      'autorizacion_at',      v_ident.autorizacion_at
    ) end,
    -- Quién ha visto esos datos, cuándo y con qué motivo. Es el derecho a
    -- saber, y es exactamente para lo que existe `accesos_identidad`.
    'accesos', case when v_ident.id is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
               'rol',    a.rol_lector,
               'motivo', a.motivo,
               'cuando', a.leida_at
             ) order by a.leida_at desc), '[]'::jsonb)
        from public.accesos_identidad a where a.identidad_id = v_ident.id) end,
    'entregas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'item',       coalesce(c.nombre, sg.nombre_propuesto),
               'cantidad',   e.cantidad,
               'unidad',     coalesce(c.unidad, sg.unidad_sugerida, 'unidad'),
               'confirmada', e.confirmada_por_solicitante_at is not null
             ) order by e.recibido_at), '[]'::jsonb)
        from public.entregas e
        left join public.catalogo_items c    on c.id = e.item_id
        left join public.sugerencias_item sg on sg.id = e.sugerencia_id
       where e.solicitud_codigo = v_sol.codigo)
  );
end;
$$;

grant execute on function public.mis_datos(text) to anon, authenticated;

-- Supresión. Borra la identidad, devuelve la solicitud a `directo` y
-- cierra los hilos.
--
-- ⚠ El hilo NO se borra: contiene palabras de otras dos personas. Lo que
-- se hace con los mensajes del titular es reemplazar el cuerpo, dejando el
-- rol y la fecha, para que la conversación siga siendo legible sin
-- conservar lo que él escribió. El hilo muere igual con la solicitud.
create or replace function public.suprimir_mis_datos(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol public.solicitudes;
  v_n   integer;
begin
  select * into v_sol from public.solicitudes s
   where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if v_sol.id is null then
    raise exception 'Solicitud no encontrada o vencida';
  end if;

  if v_sol.flujo = 'directo' then
    raise exception 'Esta solicitud no tiene datos personales guardados';
  end if;

  update public.mensajes m
     set cuerpo = '[mensaje suprimido a petición del titular]'
   where m.autor_rol = 'solicitante'
     and m.conversacion_id in (select c.id from public.conversaciones c
                                where c.solicitud_id = v_sol.id);
  get diagnostics v_n = row_count;

  perform public.devolver_a_directo(v_sol.id, 'Supresión pedida por el titular');

  return jsonb_build_object('mensajes_suprimidos', v_n);
end;
$$;

grant execute on function public.suprimir_mis_datos(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Lo que el administrador necesita ver
--
-- La cola de hilos sin fundación —el fallback de §8-F5— y la bitácora de
-- accesos a identidades. Las dos por RPC, porque las tablas están
-- revocadas y así tiene que seguir.
-- ---------------------------------------------------------------------

create or replace function public.panel_admin_flujo2()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select case when not public.es_admin(auth.uid()) then '{}'::jsonb
  else jsonb_build_object(
    'sin_aliado', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id',        c.id,
               'codigo',    s.codigo,
               'municipio', m.nombre,
               'creada_at', c.creada_at
             ) order by c.creada_at), '[]'::jsonb)
        from public.conversaciones c
        join public.solicitudes s on s.id = c.solicitud_id
        join public.municipios m  on m.codigo_dane = s.municipio
       where c.estado = 'esperando_aliado'),
    -- Sin PII: quién leyó, cuándo y por qué. Nunca qué leyó.
    'accesos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'rol',    a.rol_lector,
               'motivo', a.motivo,
               'cuando', a.leida_at,
               'huerfano', a.identidad_id is null
             ) order by a.leida_at desc), '[]'::jsonb)
        from (select * from public.accesos_identidad
               order by leida_at desc limit 50) a),
    'hilos_abiertos', (select count(*) from public.conversaciones
                        where estado not in ('cerrada','entregada'))
  ) end;
$$;

revoke execute on function public.panel_admin_flujo2() from public, anon;
grant  execute on function public.panel_admin_flujo2() to authenticated;

-- Comprobar, contra una solicitud de PRUEBA y NUNCA llamando a
-- `expirar_solicitudes()` a mano:
--
--   -- Auto-renovado: con hilo vivo y menos de 14 días, la fecha se mueve.
--   -- Con más de 14 días, no se mueve y el hilo queda cerrado.
--   -- La métrica de una `entregada_parcial` sale con cumplida = true.
--   -- `suprimir_mis_datos` deja la solicitud en `directo`, sin identidad,
--   -- con los hilos cerrados y los mensajes del titular reemplazados.
