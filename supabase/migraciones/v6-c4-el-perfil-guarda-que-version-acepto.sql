-- =====================================================================
-- v6 · Fase C · 4 — `perfiles` guarda QUÉ versión aceptó cada quien
--
-- Mínimo legal 2 de `CLAUDE.md`, Ley 1581 de 2012 artículo 9:
--
--   «Publicar el nombre, el teléfono o la foto de una persona necesita
--    casilla explícita, finalidad declarada y **versión de autorización
--    guardada con su fecha**.»
--
-- `perfiles` tenía la casilla (`acepto_publicacion`) y la fecha
-- (`acepto_politica_at`), y **ninguna columna de versión**. Y publica: la
-- vista `servidores_publicos` saca `nombre_visible` y `contacto_publico`
-- —el teléfono— con solo la casilla marcada, y eso se pinta en
-- `/profesionales`; `/ofertadores` publica el nombre.
--
-- Sin la versión no hay prueba de QUÉ texto aceptó esa persona. Es
-- justamente lo que un reclamo pide, y lo que todas las demás tablas sí
-- guardan: `proveedores.autorizacion_version`,
-- `publicaciones_muro.autorizacion_version`,
-- `referencias.consentimiento_version`, `proveedores.mapa_version`,
-- `proveedores.foto_version`. `perfiles` era el único hueco.
--
-- ⚠ Las filas que ya existen se rellenan con la versión que estaba escrita
-- cuando las aceptaron, no con la de hoy: decir que alguien aceptó un
-- texto que todavía no existía sería peor que no guardar nada. La constante
-- es la misma que ya usa el formulario de registro.
--
-- El CHECK no exige la versión cuando no hay publicación —un perfil de
-- aliado no publica nada— y sí cuando la hay. Mismo patrón que
-- `proveedores_mapa_completo` y `proveedores_foto_completa`.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

alter table public.perfiles
  add column if not exists autorizacion_version text;

update public.perfiles
   set autorizacion_version = 'perfil-2026-08-19'
 where acepto_publicacion and autorizacion_version is null;

alter table public.perfiles drop constraint if exists perfiles_autorizacion_completa;
alter table public.perfiles add constraint perfiles_autorizacion_completa
  check (not acepto_publicacion or autorizacion_version is not null);

-- ---------------------------------------------------------------------
-- `crear_perfil` la escribe.
--
-- Un parámetro más, con valor por defecto para no romper a quien la llame
-- sin él — aunque el único que la llama es el formulario de registro y sí
-- lo manda.
-- ---------------------------------------------------------------------

create or replace function public.crear_perfil(
  p_nombre_visible text,
  p_tipo text,
  p_municipios text[],
  p_contacto_publico text,
  p_contacto_tipo text,
  p_descripcion text,
  p_profesion text default null,
  p_entidad_matricula text default null,
  p_numero_matricula text default null,
  p_servicios text[] default '{}'::text[],
  p_puede_trasladarse boolean default false,
  p_autorizacion_version text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_publica boolean := p_tipo <> 'aliado';
  v_version text := nullif(btrim(coalesce(p_autorizacion_version, '')), '');
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if p_tipo not in ('ofertador','servidor','aliado') then
    raise exception 'Tipo de perfil no válido';
  end if;

  if coalesce(array_length(p_municipios, 1), 0) = 0 then
    raise exception 'Elige al menos un municipio';
  end if;

  -- Quien publica nombre y teléfono tiene que traer la versión del texto
  -- que aceptó. Sin ella no hay prueba de qué autorizó (artículo 9).
  if v_publica and v_version is null then
    raise exception 'Falta la versión del texto de autorización';
  end if;

  -- `aliado` está en la lista de tipos permitidos aunque nadie se declare
  -- aliado desde /registro; el tipo aparece al unirse a una organización, y
  -- esto existe para que un aliado pueda editar su nombre sin que la RPC lo
  -- rechace.
  insert into public.perfiles (
    id, nombre_visible, tipo, municipios, contacto_publico,
    contacto_tipo, descripcion, acepto_publicacion, acepto_politica_at,
    autorizacion_version, puede_trasladarse)
  values (
    v_uid, p_nombre_visible, p_tipo, p_municipios,
    case when p_tipo = 'aliado' then null else p_contacto_publico end,
    case when p_tipo = 'aliado' then 'whatsapp' else p_contacto_tipo end,
    nullif(trim(p_descripcion), ''),
    v_publica, now(),
    case when v_publica then v_version end,
    coalesce(p_puede_trasladarse, false))
  on conflict (id) do update set
    nombre_visible       = excluded.nombre_visible,
    tipo                 = excluded.tipo,
    municipios           = excluded.municipios,
    contacto_publico     = excluded.contacto_publico,
    contacto_tipo        = excluded.contacto_tipo,
    descripcion          = excluded.descripcion,
    acepto_publicacion   = excluded.acepto_publicacion,
    acepto_politica_at   = now(),
    autorizacion_version = excluded.autorizacion_version,
    puede_trasladarse    = excluded.puede_trasladarse;

  if p_tipo = 'servidor' then
    if coalesce(trim(p_profesion), '') = ''
       or coalesce(trim(p_numero_matricula), '') = ''
       or p_entidad_matricula is null then
      raise exception 'Indica profesión, entidad y número de matrícula';
    end if;

    if exists (select 1 from public.servidores sv
                where sv.entidad_matricula = p_entidad_matricula
                  and sv.numero_matricula = trim(p_numero_matricula)
                  and sv.perfil_id <> v_uid) then
      raise exception 'Esa matrícula ya está registrada por otra persona';
    end if;

    if exists (select 1 from unnest(p_servicios) s
                where s not in (select c.id from public.catalogo_servicios c where c.activo)) then
      raise exception 'Servicio no válido';
    end if;

    insert into public.servidores (perfil_id, profesion, entidad_matricula, numero_matricula, servicios)
    values (v_uid, trim(p_profesion), p_entidad_matricula, trim(p_numero_matricula), p_servicios)
    on conflict (perfil_id) do update set
      profesion         = excluded.profesion,
      entidad_matricula = excluded.entidad_matricula,
      numero_matricula  = excluded.numero_matricula,
      servicios         = excluded.servicios;
  else
    delete from public.servidores where perfil_id = v_uid;
  end if;
end;
$function$;

-- La firma vieja, de once parámetros, se retira: dejarla viva sería dejar
-- una puerta que publica sin guardar la versión.
drop function if exists public.crear_perfil(
  text, text, text[], text, text, text, text, text, text, text[], boolean);

-- Comprobar:
--   select count(*) from public.perfiles
--    where acepto_publicacion and autorizacion_version is null;   -- 0
