-- =====================================================================
-- Perfiles de prueba para el proyecto de PRUEBAS.
--
-- 🔴 NUNCA en producción.
--
-- Para qué existe: casi nada de lo que hay que mirar necesita *entrar*
-- como cinco personas distintas. El directorio de profesionales y los
-- avisos push necesitan que esas personas **existan**, no que inicien
-- sesión.
--
-- Un perfil necesita una fila en `auth.users` porque `perfiles.id` la
-- referencia, pero nada obliga a que esa fila pueda autenticarse: estas no
-- tienen contraseña ni identidad de Google, así que son invisibles para el
-- login. Solo pueblan la base.
--
-- Los uuid son fijos y empiezan por `00000000-0000-4000-8000-`, que es lo
-- que le permite a `limpiar-pruebas.sql` encontrarlas después. Los nombres
-- llevan el prefijo `PRUEBA — ` por la misma razón, y porque se ven.
--
-- Re-ejecutable: vuelve a dejar los cinco perfiles como estaban.
--
-- Para iniciar sesión de verdad como una segunda persona no sirve esto:
-- hace falta otra cuenta de Google, y si la pantalla de consentimiento
-- está en modo Testing, agregarla como *test user* en Google Cloud.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Las cuentas
--
-- Las columnas en cadena vacía no son adorno: GoTrue las lee como texto y
-- una fila insertada a mano con NULL ahí revienta el login del proyecto
-- entero con "converting NULL to string is unsupported" — está documentado
-- en 00-RUNBOOK.md. `phone` sí se deja en NULL: tiene índice único y
-- varias cadenas vacías chocarían entre sí.
-- ---------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone_change,
  phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000',
  v.id::uuid, 'authenticated', 'authenticated', v.email, now(),
  now(), now(), '{"provider":"seed","providers":["seed"]}'::jsonb, '{}'::jsonb,
  '', '', '', '', '', '', '', ''
from (values
  ('00000000-0000-4000-8000-000000000001', 'prueba-tienda@ejemplo.invalid'),
  ('00000000-0000-4000-8000-000000000002', 'prueba-bodega@ejemplo.invalid'),
  ('00000000-0000-4000-8000-000000000003', 'prueba-medica@ejemplo.invalid'),
  ('00000000-0000-4000-8000-000000000004', 'prueba-ingeniero@ejemplo.invalid'),
  ('00000000-0000-4000-8000-000000000005', 'prueba-suspendido@ejemplo.invalid')
) as v(id, email)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Los perfiles
-- ---------------------------------------------------------------------

-- ⚠ Van por `insert` directo y no por una RPC. Antes iban por
-- `crear_perfil`, que se retiró con el módulo de insumos (ADR 0014): hacía
-- tres cosas a la vez y el navegador la llamaba directo. Lo que hoy la
-- reemplaza son procedimientos del contrato, que no se pueden llamar desde
-- SQL. Las validaciones que importan siguen puestas donde tienen que estar
-- —los CHECK de la tabla—, y son las que esta semilla tiene que respetar.

-- Tres vecinos: la cuenta de cualquiera. Sin teléfono público y sin
-- autorización, que es como nace una cuenta desde el ADR 0015.
insert into public.perfiles (
  id, nombre_visible, tipo, municipios, contacto_publico,
  contacto_tipo, descripcion, acepto_publicacion, autorizacion_version)
values
  ('00000000-0000-4000-8000-000000000001'::uuid,
   'PRUEBA — Tienda La Esperanza', 'vecino', array['76001','76109'],
   null, 'whatsapp', null, false, null),
  ('00000000-0000-4000-8000-000000000002'::uuid,
   'PRUEBA — Bodega San Nicolas', 'vecino', array['66001','17001'],
   null, 'telefono', null, false, null),
  ('00000000-0000-4000-8000-000000000005'::uuid,
   'PRUEBA — Deposito Suspendido', 'vecino', array['76001'],
   null, 'whatsapp', null, false, null)
on conflict (id) do update set
  nombre_visible = excluded.nombre_visible,
  tipo           = excluded.tipo,
  municipios     = excluded.municipios;

-- Y dos profesionales con matrícula. Estos sí publican nombre y teléfono
-- —es lo que hace `servidores_publicos`— así que llevan su autorización
-- con su versión, igual que la escribiría `servicios.guardarMatricula`.
insert into public.perfiles (
  id, nombre_visible, tipo, municipios, contacto_publico,
  contacto_tipo, descripcion, acepto_publicacion, autorizacion_version)
values
  ('00000000-0000-4000-8000-000000000003'::uuid,
   'PRUEBA — Marina Solis', 'servidor', array['76001'],
   '3001110003', 'whatsapp',
   'Medica general. Atiendo en albergues los fines de semana.',
   true, 'perfil-2026-08-19'),
  ('00000000-0000-4000-8000-000000000004'::uuid,
   'PRUEBA — Pablo Renteria', 'servidor', array['27001','27361'],
   '3001110004', 'whatsapp',
   'Ingeniero civil. Puedo revisar casas afectadas.',
   true, 'perfil-2026-08-19')
on conflict (id) do update set
  nombre_visible       = excluded.nombre_visible,
  tipo                 = excluded.tipo,
  municipios           = excluded.municipios,
  contacto_publico     = excluded.contacto_publico,
  contacto_tipo        = excluded.contacto_tipo,
  descripcion          = excluded.descripcion,
  acepto_publicacion   = excluded.acepto_publicacion,
  autorizacion_version = excluded.autorizacion_version;

insert into public.servidores (
  perfil_id, profesion, entidad_matricula, numero_matricula, servicios)
values
  ('00000000-0000-4000-8000-000000000003'::uuid,
   'Médica general', 'ReTHUS', 'PRUEBA-RM-0003',
   coalesce((select array_agg(c.id) from (
      select id from public.catalogo_servicios
       where area = 'salud' and activo order by orden limit 1) c), '{}')),
  ('00000000-0000-4000-8000-000000000004'::uuid,
   'Ingeniero civil', 'COPNIA', 'PRUEBA-IC-0004',
   coalesce((select array_agg(c.id) from (
      select id from public.catalogo_servicios
       where area = 'ingenieria' and activo order by orden limit 2) c), '{}'))
on conflict (perfil_id) do update set
  profesion         = excluded.profesion,
  entidad_matricula = excluded.entidad_matricula,
  numero_matricula  = excluded.numero_matricula,
  servicios         = excluded.servicios;

-- ---------------------------------------------------------------------
-- 3. Estados que no se pueden poner desde el formulario
-- ---------------------------------------------------------------------

-- Verificar la matrícula de la médica. Va por `verificar_servidor` si hay
-- un administrador en el proyecto, que es el camino real; si no lo hay,
-- queda sin verificar y se nota en el directorio.
do $$
declare v_admin uuid;
begin
  select a.user_id into v_admin from public.administradores a limit 1;
  if v_admin is null then
    raise notice 'No hay administrador: la matricula queda SIN verificar.';
    return;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin)::text, false);
  perform public.verificar_servidor('00000000-0000-4000-8000-000000000003'::uuid, true);
  perform set_config('request.jwt.claims', '', false);
end
$$;

update public.perfiles
   set suspendido = true
 where id = '00000000-0000-4000-8000-000000000005'::uuid;

-- ---------------------------------------------------------------------
-- 4. Comprobar
-- ---------------------------------------------------------------------

select p.nombre_visible, p.tipo, p.suspendido,
       coalesce(sv.verificado, false) as matricula_verificada,
       p.municipios
  from public.perfiles p
  left join public.servidores sv on sv.perfil_id = p.id
 where p.nombre_visible like 'PRUEBA%'
 order by p.nombre_visible;

-- Y lo que se ve desde fuera, sin sesión:
--   select nombre_visible, verificado from public.servidores_publicos;
