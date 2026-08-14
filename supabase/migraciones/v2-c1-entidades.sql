-- =====================================================================
-- v2 · Entidades — directorio informativo, sin aval
--
-- Organizaciones que prestan servicios. Las crea SOLO un administrador, no
-- tienen cuenta, no entran a la plataforma y no escriben nada. Una ficha
-- con nombre, subtítulo, descripción, botones de enlace y una nota final.
--
-- Lo que esta tabla NO es: no es `organizaciones` de PLAN-V2 §5.2. Esa
-- tiene NIT, slug, miembros, permisos y acopio físico, y su existencia ES
-- la verificación. Esta es lo contrario: aparecer aquí no dice nada. Si
-- algún día una entidad del directorio se vuelve aliada, tendrá las dos
-- filas y una columna `organizacion_id` las unirá — ese día, no hoy.
--
-- La regla 5 de CLAUDE.md no se les aplica, y eso queda escrito allá como
-- excepción: el alcance cerrado gobierna lo que AquíVe *opera* —emparejar
-- personas, coordinar entregas—, y esto no opera nada, solo dice que una
-- organización existe y enlaza a su sitio.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. El validador de enlaces
--
-- Es la superficie nueva más delicada del proyecto: botones que sacan a
-- gente vulnerable hacia sitios que no controlamos.
--
-- ⚠ LISTA BLANCA DE UN SOLO ESQUEMA, nunca lista negra. `javascript:`,
-- `data:`, `vbscript:`, `blob:` y `file:` no se enumeran en ninguna parte:
-- quedan fuera por no estar aquí. Una lista negra pierde siempre contra
-- `java\tscript:`, `JaVaScRiPt:` o `\x01javascript:`.
--
-- `http://` también queda fuera. El público entra por wifi de albergue y
-- datos compartidos: una página en claro es reescribible en tránsito. Si
-- una entidad no tiene TLS, esa entidad no debería tener botón.
--
-- `tel:` y `mailto:` tampoco, y no es purismo: la regla 3 dice que el
-- contacto nunca pasa por la plataforma. Si mañana hace falta el teléfono
-- de una entidad, va como columna propia con su propio tratamiento, no
-- como enlace libre en un campo que ningún control mira.
--
-- `immutable` y sin subconsultas a tablas, para poder usarla dentro de un
-- CHECK. La llaman DOS sitios a propósito: el CHECK de la tabla, para que
-- una fila mala no pueda existir ni escribiéndola desde el editor SQL, y
-- `guardar_entidad`, para que el administrador lea un mensaje en vez de un
-- error crudo de Postgres — igual que `crear_item_catalogo` con la
-- categoría.
--
-- Gemela de `esEnlaceSeguro` en src/lib/validacion.ts. Si cambia una,
-- cambia la otra.
-- ---------------------------------------------------------------------

create or replace function public.enlaces_validos(p_enlaces jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_enlaces) = 'array'
     and jsonb_array_length(p_enlaces) <= 6
     and not exists (
       select 1 from jsonb_array_elements(p_enlaces) e
        where jsonb_typeof(e) <> 'object'
           -- Exactamente dos llaves, y esas dos. Sin esto se cuelan campos
           -- que ninguna pantalla mira y nadie valida.
           or (select count(*) from jsonb_object_keys(e) k
                where k not in ('etiqueta','url')) > 0
           or e->>'etiqueta' is null
           or e->>'url'      is null
           or char_length(trim(e->>'etiqueta')) not between 2 and 40
           or char_length(e->>'url') not between 12 and 200
           -- Toda la URL, no solo el dominio: sin el `$` final, un
           -- `https://ok.org/<script>` pasaba entero.
           or e->>'url' !~ '^https://[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+(:[0-9]{1,5})?(/[!-~]*)?$'
           -- Solo ASCII imprimible: cierra el homógrafo IDN. «аquive.co»
           -- con «а» cirílica se ve idéntico a «aquive.co». Un dominio
           -- internacional legítimo se pega en punycode y se ve el `xn--`.
           or e->>'url' ~ '[^ -~]'
           -- `https://fundacion-real.org@evil.com/`: el ojo lee lo de la
           -- izquierda y el navegador va a lo de la derecha. Mostrar la URL
           -- completa debajo del botón NO desmiente este caso: lo confirma.
           -- Por eso se prohíbe la arroba entera.
           or e->>'url' like '%@%'
           -- Espacios, comillas y ángulos: ninguna URL legítima los lleva
           -- sin escapar, y son la materia prima para romper el atributo.
           or e->>'url' ~ '[[:space:]<>"'']'
     );
$$;

revoke execute on function public.enlaces_validos(jsonb) from public, anon, authenticated;

comment on function public.enlaces_validos(jsonb) is
  'Gemela de esEnlaceSeguro en src/lib/validacion.ts. Si cambia una, cambia la otra. Lista blanca de https:// — nunca la conviertas en lista negra. El EXECUTE revocado no estorba al CHECK porque la única ruta de escritura es una security definer de postgres.';

-- ---------------------------------------------------------------------
-- 2. La tabla
--
-- `cobertura` existe para que el filtro de municipio sea correcto: una
-- entidad nacional también atiende en Cali, así que filtrar por Cali tiene
-- que devolver las locales de Cali Y todas las nacionales. Lo nacional
-- cubre además lo virtual, que no está atado a ningún municipio.
-- ---------------------------------------------------------------------

create table if not exists public.entidades (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (char_length(trim(nombre)) between 3 and 80),
  subtitulo      text check (char_length(subtitulo) between 1 and 120),
  descripcion    text check (char_length(descripcion) <= 600),
  -- [{"etiqueta":"...","url":"https://..."}]. El ORDEN DEL ARRAY es el
  -- orden en pantalla: por eso jsonb y no tabla aparte — reordenar es
  -- mover un elemento, no N updates de una columna.
  enlaces        jsonb not null default '[]'::jsonb,
  -- Nota de cierre libre: horarios, cobertura, aclaraciones. Es texto
  -- libre, pero lo escribe el responsable del proyecto, no un usuario: la
  -- restricción de la regla 2 aquí es la longitud más el hecho de que la
  -- única ruta de escritura exige `es_admin()`.
  pie            text check (char_length(pie) <= 400),
  cobertura      text not null default 'nacional'
                   check (cobertura in ('nacional','local')),
  municipios     text[] not null default '{}',
  orden          integer not null default 0,
  activa         boolean not null default true,
  -- ⚠ SET NULL, jamás CASCADE. `limpiar-pruebas.sql` borra cuentas de
  -- `auth.users` por prefijo de uuid; con CASCADE eso se llevaría fichas
  -- reales creadas desde una cuenta de prueba con permisos de admin. Y si
  -- el administrador ejerce su derecho de supresión, un NO ACTION le haría
  -- fallar el borrado. Mismo criterio que `servidores.verificado_por`.
  creada_por     uuid references auth.users(id) on delete set null,
  creada_at      timestamptz not null default now(),
  actualizada_at timestamptz not null default now(),
  -- Temporal. La deriva `guardar_entidad` del prefijo del NOMBRE, que es
  -- un campo visible, nunca por parámetro. `creada_por` es el admin, que
  -- es una cuenta real: por ahí no se distingue una ficha de prueba.
  es_prueba      boolean not null default false,
  -- Una entidad local sin municipios quedaría invisible en el filtro y
  -- nadie sabría por qué.
  constraint entidades_cobertura_coherente
    check (cobertura = 'nacional' or array_length(municipios, 1) >= 1)
);

-- `add constraint` no es idempotente; el par drop/add sí, y además
-- revalida las filas que ya estuvieran.
alter table public.entidades drop constraint if exists entidades_enlaces_validos;
alter table public.entidades add  constraint entidades_enlaces_validos
  check (public.enlaces_validos(enlaces));

comment on table public.entidades is
  'Directorio SIN AVAL. Aparecer aquí no es recomendación ni verificación. Antes de enlazar, mirar dos cosas: que el destino no sea una página de donación —el plan Hobby de Vercel las cuenta como uso comercial, ver PLAN-V2 §13.8— y que la regla 5 no se esté eludiendo por la vía de enlazar a un tercero. Mismo espíritu que el comentario de catalogo_servicios.';

comment on column public.entidades.enlaces is
  'Array [{etiqueta,url}] validado por el CHECK entidades_enlaces_validos. Solo https://, sin arroba, solo ASCII, máximo 6.';

create index if not exists idx_entidades_activa on public.entidades(activa, orden);

-- ---------------------------------------------------------------------
-- 3. RLS y la vista pública
--
-- Mismo principio que `solicitudes`: el público no toca la tabla, toca la
-- vista, y la vista ES la frontera. Una sola política, la del
-- administrador, que necesita ver también las retiradas en /admin.
--
-- El EXISTS va a mano contra `administradores`: `es_admin()` tiene EXECUTE
-- revocado y dentro de una política falla con «permission denied» para
-- todo el mundo.
-- ---------------------------------------------------------------------

alter table public.entidades enable row level security;
revoke all on public.entidades from anon, authenticated;

drop policy if exists "admin lee entidades" on public.entidades;
create policy "admin lee entidades" on public.entidades
  for select to authenticated
  using (exists (select 1 from public.administradores a
                  where a.user_id = (select auth.uid())));

-- ⚠ SIN `security_invoker = on`. La vista es de `postgres` y evalúa el
-- select con sus permisos, que es lo que la hace atravesar el RLS de la
-- tabla. Si alguien se lo pone «por seguridad» —el linter de Supabase lo
-- sugiere— ninguna política alcanza a `anon` y la pestaña queda VACÍA en
-- producción. `solicitudes_publicas` y `servidores_publicos` dependen de
-- exactamente lo mismo.
--
-- No sale `creada_por`: es el uuid de `auth.users` de una persona real y
-- esto lo lee una página anónima. Tampoco `es_prueba`, que en pruebas hay
-- que poder ver lo que uno crea y el nombre ya se autodelata.
create or replace view public.entidades_publicas as
select e.id, e.nombre, e.subtitulo, e.descripcion, e.enlaces, e.pie,
       e.cobertura, e.municipios, e.orden
from public.entidades e
where e.activa;

grant select on public.entidades_publicas to anon, authenticated;

-- Solo los municipios de las entidades locales: las nacionales están en
-- todos y no aportan nada al desplegable.
create or replace view public.municipios_con_entidades as
select distinct m.codigo_dane, m.nombre, m.departamento
from public.municipios m
join public.entidades e on m.codigo_dane = any(e.municipios)
where e.activa and e.cobertura = 'local';

grant select on public.municipios_con_entidades to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Alta y edición
-- ---------------------------------------------------------------------

create or replace function public.guardar_entidad(
  p_id          uuid,                          -- null = crear
  p_nombre      text,
  p_subtitulo   text    default null,
  p_descripcion text    default null,
  p_enlaces     jsonb   default '[]'::jsonb,
  p_pie         text    default null,
  p_cobertura   text    default 'nacional',
  p_municipios  text[]  default '{}',
  p_orden       integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
  v_mun text[];
begin
  if not public.es_admin(v_uid) then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(coalesce(p_nombre, ''))) not between 3 and 80 then
    raise exception 'El nombre debe tener entre 3 y 80 caracteres';
  end if;

  if p_cobertura not in ('nacional','local') then
    raise exception 'La cobertura debe ser nacional o local';
  end if;

  if p_cobertura = 'local' and coalesce(array_length(p_municipios, 1), 0) = 0 then
    raise exception 'Una entidad local necesita al menos un municipio';
  end if;

  if p_cobertura = 'local' and exists (
       select 1 from unnest(p_municipios) m
        where m not in (select mu.codigo_dane from public.municipios mu)) then
    raise exception 'Hay un municipio que no existe';
  end if;

  -- El mismo control que el CHECK, aquí para que salga un mensaje legible
  -- y no un error crudo de Postgres.
  if not public.enlaces_validos(coalesce(p_enlaces, '[]'::jsonb)) then
    raise exception 'Cada enlace necesita un texto de 2 a 40 caracteres y una dirección que empiece por https://, sin espacios y sin arroba. Máximo 6 enlaces.';
  end if;

  v_mun := case when p_cobertura = 'local' then p_municipios else '{}'::text[] end;

  if p_id is null then
    insert into public.entidades
      (nombre, subtitulo, descripcion, enlaces, pie,
       cobertura, municipios, orden, creada_por, es_prueba)
    values
      (trim(p_nombre),
       nullif(trim(p_subtitulo), ''),
       nullif(trim(p_descripcion), ''),
       coalesce(p_enlaces, '[]'::jsonb),
       nullif(trim(p_pie), ''),
       p_cobertura, v_mun, coalesce(p_orden, 0), v_uid,
       trim(p_nombre) ilike 'prueba%')
    returning id into v_id;
  else
    update public.entidades
       set nombre         = trim(p_nombre),
           subtitulo      = nullif(trim(p_subtitulo), ''),
           descripcion    = nullif(trim(p_descripcion), ''),
           enlaces        = coalesce(p_enlaces, '[]'::jsonb),
           pie            = nullif(trim(p_pie), ''),
           cobertura      = p_cobertura,
           municipios     = v_mun,
           orden          = coalesce(p_orden, 0),
           -- Se RECALCULA, no se conserva. La marca tiene que seguir
           -- diciendo lo que se ve en pantalla: si alguien renombra
           -- «PRUEBA Fundación X» a «Fundación X», dejó de ser de prueba, y
           -- conservarla haría que la limpieza borrara una ficha real.
           es_prueba      = trim(p_nombre) ilike 'prueba%',
           actualizada_at = now()
     where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Esa entidad no existe';
    end if;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.guardar_entidad(uuid,text,text,text,jsonb,text,text,text[],integer) from public, anon;
grant  execute on function public.guardar_entidad(uuid,text,text,text,jsonb,text,text,text[],integer) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Bajar, subir y borrar
--
-- `activar_entidad` va aparte y no dentro de `guardar_entidad`: retirar
-- una ficha tiene que ser un clic desde la lista, sin reenviar el
-- formulario y sin que uno a medio llenar blanquee la fila. Misma forma
-- que `suspender_perfil` y `verificar_servidor`.
-- ---------------------------------------------------------------------

create or replace function public.activar_entidad(p_id uuid, p_activa boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;
  update public.entidades
     set activa = p_activa, actualizada_at = now()
   where id = p_id;
end;
$$;

revoke execute on function public.activar_entidad(uuid,boolean) from public, anon;
grant  execute on function public.activar_entidad(uuid,boolean) to authenticated;

create or replace function public.borrar_entidad(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;
  delete from public.entidades where id = p_id;
end;
$$;

revoke execute on function public.borrar_entidad(uuid) from public, anon;
grant  execute on function public.borrar_entidad(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Reportar una entidad
--
-- El riesgo real de este directorio no es `javascript:` —eso lo para el
-- validador—: es que un dominio revisado hoy esté vendido, estacionado o
-- secuestrado en seis semanas, y AquíVe siga poniendo un botón grande
-- hacia él. Ninguna validación de esquema toca eso.
--
-- El botón de reportar es el único canal por el que alguien puede avisar,
-- y son tres líneas. Un verificador automático por cron sería salida de
-- red desde Vercel y no vale la pena.
-- ---------------------------------------------------------------------

alter table public.reportes drop constraint if exists reportes_tipo_objeto_check;
alter table public.reportes add  constraint reportes_tipo_objeto_check
  check (tipo_objeto in ('solicitud','respuesta','perfil','entidad'));

create or replace function public.crear_reporte(
  p_tipo_objeto text,
  p_objeto_id   uuid,
  p_motivo      text,
  p_nota        text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tipo_objeto not in ('solicitud','respuesta','perfil','entidad') then
    raise exception 'Tipo de contenido inválido';
  end if;
  if p_motivo not in ('datos_personales','estafa','contenido_ofensivo',
                      'informacion_falsa','menor_de_edad','otro') then
    raise exception 'Motivo inválido';
  end if;

  insert into public.reportes (tipo_objeto, objeto_id, motivo, nota)
  values (p_tipo_objeto, p_objeto_id, p_motivo, nullif(trim(p_nota), ''));
end;
$$;

grant execute on function public.crear_reporte(text,uuid,text,text) to anon, authenticated;

create or replace function public.resolver_reporte(p_reporte_id uuid, p_borrar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_rep public.reportes;
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select * into v_rep from public.reportes where id = p_reporte_id;
  if not found then raise exception 'Reporte no encontrado'; end if;

  if p_borrar then
    if v_rep.tipo_objeto = 'solicitud' then
      delete from public.solicitudes where id = v_rep.objeto_id;
    elsif v_rep.tipo_objeto = 'respuesta' then
      delete from public.respuestas where id = v_rep.objeto_id;
    elsif v_rep.tipo_objeto = 'perfil' then
      update public.perfiles set suspendido = true where id = v_rep.objeto_id;
    elsif v_rep.tipo_objeto = 'entidad' then
      -- Se retira, no se borra: si el enlace se recupera, se vuelve a
      -- subir sin volver a escribir la ficha entera.
      update public.entidades set activa = false, actualizada_at = now()
       where id = v_rep.objeto_id;
    end if;
  end if;

  update public.reportes set atendido = true where id = p_reporte_id;
end;
$$;

revoke execute on function public.resolver_reporte(uuid,boolean) from public, anon;
grant  execute on function public.resolver_reporte(uuid,boolean) to authenticated;

-- Comprobar:
--   select has_table_privilege('anon','public.entidades','SELECT');              -- f
--   select has_function_privilege('anon','public.enlaces_validos(jsonb)','EXECUTE'); -- f
--   select public.enlaces_validos('[{"etiqueta":"Ir","url":"javascript:alert(1)"}]'::jsonb);        -- f
--   select public.enlaces_validos('[{"etiqueta":"Ir","url":"https://a.org@evil.com/"}]'::jsonb);    -- f
--   select public.enlaces_validos('[{"etiqueta":"Ir","url":"http://ejemplo.org"}]'::jsonb);         -- f
--   select public.enlaces_validos('[{"etiqueta":"Ver su página","url":"https://ejemplo.org/ayuda"}]'::jsonb); -- t
--   select nombre, cobertura, municipios from public.entidades_publicas;
