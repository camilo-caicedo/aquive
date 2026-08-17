-- =====================================================================
-- v2 · k4 · contacto opcional de quien pide ayuda
--
-- ⚠ ESTA MIGRACIÓN PISA LA REGLA 1 DE CLAUDE.md («cero datos personales
-- del lado del solicitante»), a pedido explícito del responsable del
-- proyecto el 17 de agosto de 2026, por una necesidad operativa urgente
-- de poder comunicarse directamente con quien pidió ayuda. No se coló:
-- se preguntó primero, se confirmó dos veces (la excepción y el alcance
-- de quién puede verlo) y se deja este rastro para que quede escrito por
-- qué existe.
--
-- Lo que se mantiene de las reglas de siempre, porque nadie pidió
-- soltarlo:
--   · Nada de esto entra a `solicitudes` ni a `solicitudes_publicas`
--     (regla 1 original: la tabla pública sigue sin una sola columna de
--     identidad). Vive en una tabla aparte, cuelga de la solicitud y
--     muere con ella — mismo patrón que `identidades`.
--   · Los tres campos son opcionales. Si se deja alguno, hace falta la
--     versión del aviso de privacidad aceptado (regla R del espíritu:
--     nunca el camino de menor resistencia sin avisar).
--   · Nada de esto va en una URL ni se loggea (regla 6, intacta).
--   · Borrado duro a las 72 horas junto con la solicitud (regla 4,
--     intacta): `on delete cascade`.
--   · Solo lo ve el administrador y quien responda ESA solicitud
--     puntual, nunca el tablero público ni un anónimo. Es la decisión
--     que se tomó al preguntar el alcance.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

create table if not exists public.solicitudes_contacto (
  solicitud_id uuid primary key references public.solicitudes(id) on delete cascade,
  nombre       text check (nombre is null or char_length(nombre) between 1 and 80),
  telefono     text check (telefono is null or telefono ~ '^[0-9+()\- ]{6,20}$'),
  correo       text check (correo is null or correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- La fecha del texto que se aceptó, mismo patrón que
  -- `identidades.autorizacion_version`: si el aviso cambia, esto dice
  -- cuál versión vio la persona.
  consentimiento_version text,
  creada_at    timestamptz not null default now(),
  constraint solicitudes_contacto_tiene_algo check (
    nombre is not null or telefono is not null or correo is not null
  ),
  constraint solicitudes_contacto_con_consentimiento check (
    consentimiento_version is not null
  )
);

comment on table public.solicitudes_contacto is
  'Contacto opcional que deja quien pide ayuda. Excepción explícita a la regla 1 de CLAUDE.md, pedida el 17 de agosto de 2026 — ver el comentario de esta migración. Cuelga de la solicitud, muere con ella. Solo la lee el administrador y quien responde esa solicitud puntual: nunca sale en solicitudes_publicas ni en el tablero.';

create index if not exists idx_solicitudes_contacto_solicitud
  on public.solicitudes_contacto(solicitud_id);

revoke all on public.solicitudes_contacto from public, anon, authenticated;

-- Se escribe con el token, igual que `activar_acompanamiento`: solo quien
-- tiene el enlace de SU solicitud puede dejar un contacto en ella. No pide
-- sesión porque quien pide ayuda no tiene cuenta.
create or replace function public.agregar_contacto_solicitante(
  p_token    text,
  p_nombre   text default null,
  p_telefono text default null,
  p_correo   text default null,
  p_version  text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       uuid;
  v_nombre   text := nullif(trim(p_nombre), '');
  v_telefono text := nullif(trim(p_telefono), '');
  v_correo   text := nullif(trim(p_correo), '');
begin
  -- Nada que guardar: silencioso, no es un error dejar los tres en blanco.
  if v_nombre is null and v_telefono is null and v_correo is null then
    return;
  end if;

  if p_version is null then
    raise exception 'Falta aceptar el aviso de privacidad';
  end if;

  select id into v_id from public.solicitudes
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if not found then
    raise exception 'Solicitud no encontrada o vencida';
  end if;

  insert into public.solicitudes_contacto (solicitud_id, nombre, telefono, correo, consentimiento_version)
  values (v_id, v_nombre, v_telefono, v_correo, p_version)
  on conflict (solicitud_id) do update
    set nombre = excluded.nombre,
        telefono = excluded.telefono,
        correo = excluded.correo,
        consentimiento_version = excluded.consentimiento_version;
end;
$$;

grant execute on function public.agregar_contacto_solicitante(text,text,text,text,text)
  to anon, authenticated;

-- Lo lee quien va a responder ESA solicitud puntual — mismo patrón de
-- guardia que `movilidad_solicitud`: sesión con perfil activo, y solo
-- mientras la solicitud siga viva. Nunca `anon`: esto es lo que separa
-- «lo ve quien responde» de «lo ve cualquiera que entre a la página».
create or replace function public.contacto_solicitante(p_codigo text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object(
           'nombre', sc.nombre, 'telefono', sc.telefono, 'correo', sc.correo
         )
    from public.solicitudes s
    join public.solicitudes_contacto sc on sc.solicitud_id = s.id
   where s.codigo = upper(trim(p_codigo))
     and public.estado_activo(s.estado)
     and s.expira_at > now()
     and exists (select 1 from public.perfiles p
                  where p.id = auth.uid() and p.suspendido = false);
$$;

revoke execute on function public.contacto_solicitante(text) from public, anon;
grant  execute on function public.contacto_solicitante(text) to authenticated;

-- `solicitudes_admin` gana el contacto, para que el administrador pueda
-- coordinar directamente cuando haga falta. Copiada de la definición viva
-- —no reescrita de memoria— con un único campo agregado.
create or replace function public.solicitudes_admin()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select case when not public.es_admin(auth.uid()) then '[]'::jsonb
         else coalesce((
           select jsonb_agg(jsonb_build_object(
             'codigo',      s.codigo,
             'municipio',   m.nombre || ', ' || m.departamento,
             'barrio',      s.barrio,
             'categoria',   s.categoria,
             'nota',        s.nota,
             'nota_admin',  s.nota_admin,
             'estado',      s.estado,
             'creada_at',   s.creada_at,
             'expira_at',   s.expira_at,
             'respuestas',  (select count(*) from public.respuestas r where r.solicitud_id = s.id),
             'items',       (select coalesce(jsonb_agg(jsonb_build_object(
                                      'nombre',   coalesce(ci.nombre, sg.nombre_propuesto),
                                      'cantidad', si.cantidad,
                                      'unidad',   coalesce(ci.unidad, sg.unidad_sugerida, 'unidad'))
                                    order by coalesce(ci.orden, 9999)), '[]'::jsonb)
                               from public.solicitud_items si
                               left join public.catalogo_items ci   on ci.id = si.item_id
                               left join public.sugerencias_item sg on sg.id = si.sugerencia_id
                              where si.solicitud_id = s.id),
             'contacto',    (select jsonb_build_object(
                                      'nombre', sc.nombre, 'telefono', sc.telefono, 'correo', sc.correo)
                               from public.solicitudes_contacto sc
                              where sc.solicitud_id = s.id)
           ) order by s.creada_at desc)
             from public.solicitudes s
             join public.municipios m on m.codigo_dane = s.municipio
         ), '[]'::jsonb)
         end;
$$;

revoke execute on function public.solicitudes_admin() from public, anon;
grant  execute on function public.solicitudes_admin() to authenticated;
