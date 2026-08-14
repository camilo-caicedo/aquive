-- =====================================================================
-- Perfiles de prueba para el proyecto de PRUEBAS.
--
-- 🔴 NUNCA en producción.
--
-- Para qué existe: casi nada de lo que hay que mirar necesita *entrar*
-- como cinco personas distintas. El tablero, el directorio de
-- profesionales, los avisos push y el cruce de la Fase B necesitan que esas
-- personas **existan**, no que inicien sesión.
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
--
-- Van por `crear_perfil` y no por `insert` directo, para que pasen por las
-- mismas validaciones que la aplicación: longitud del nombre, al menos un
-- municipio, matrícula sin repetir y servicios que existan en el catálogo.
-- `auth.uid()` lee el `sub` de `request.jwt.claims`, así que suplantar es
-- ponerle ese valor antes de cada llamada.
-- ---------------------------------------------------------------------

-- Ofertador con bastante inventario, en dos municipios del Valle.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001"}', false);
select public.crear_perfil(
  'PRUEBA — Tienda La Esperanza', 'ofertador',
  array['76001','76109'], '3001110001', 'whatsapp',
  'Tienda de barrio. Podemos separar mercado y entregarlo en la mañana.');
select public.guardar_ofrecimientos('[
  {"item_id":"agua","cantidad":100},
  {"item_id":"arroz","cantidad":50},
  {"item_id":"aceite","cantidad":20},
  {"item_id":"panela","cantidad":30},
  {"item_id":"atun","cantidad":40}
]'::jsonb);

-- Ofertador en el Eje Cafetero, con un ítem sin cantidad a propósito:
-- "tengo cobijas, no sé cuántas" es el caso honesto más común.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002"}', false);
select public.crear_perfil(
  'PRUEBA — Bodega San Nicolas', 'ofertador',
  array['66001','17001'], '3001110002', 'telefono',
  'Bodega con enseres. Hay que venir a recoger.');
select public.guardar_ofrecimientos('[
  {"item_id":"cobija","cantidad":40},
  {"item_id":"colchoneta","cantidad":25},
  {"item_id":"jabon"},
  {"item_id":"papel_h","cantidad":60}
]'::jsonb);

-- Servidora con matrícula Y con insumos. Es el caso que existe desde que
-- el inventario dejó de ser exclusivo de los ofertadores: alguien con
-- matrícula también puede tener acetaminofén y suero en la casa.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003"}', false);
select public.crear_perfil(
  'PRUEBA — Marina Solis', 'servidor',
  array['76001'], '3001110003', 'whatsapp',
  'Medica general. Atiendo en albergues los fines de semana.',
  'Médica general', 'ReTHUS', 'PRUEBA-RM-0003',
  (select array_agg(c.id) from public.catalogo_servicios c
    where c.area = 'salud' and c.activo limit 1));
select public.guardar_ofrecimientos('[
  {"item_id":"acetaminofen","cantidad":10},
  {"item_id":"suero_oral","cantidad":50},
  {"item_id":"gasas"}
]'::jsonb);

-- Servidor SIN verificar y sin inventario: es como se ve un perfil recién
-- registrado en el directorio, con su advertencia.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000004"}', false);
select public.crear_perfil(
  'PRUEBA — Pablo Renteria', 'servidor',
  array['27001','27361'], '3001110004', 'whatsapp',
  'Ingeniero civil. Puedo revisar casas afectadas.',
  'Ingeniero civil', 'COPNIA', 'PRUEBA-IC-0004',
  (select array_agg(c.id) from public.catalogo_servicios c
    where c.area = 'ingenieria' and c.activo limit 2));

-- Ofertador suspendido. El inventario se guarda ANTES de suspenderlo,
-- porque `guardar_ofrecimientos` ya no deja escribir a un perfil suspendido.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000005"}', false);
select public.crear_perfil(
  'PRUEBA — Deposito Suspendido', 'ofertador',
  array['76001'], '3001110005', 'whatsapp',
  'Perfil suspendido a proposito, para ver que desaparece del tablero.');
select public.guardar_ofrecimientos('[{"item_id":"carpa","cantidad":5}]'::jsonb);

select set_config('request.jwt.claims', '', false);

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
       (select count(*) from public.ofrecimientos o where o.perfil_id = p.id) as items,
       p.municipios
  from public.perfiles p
  left join public.servidores sv on sv.perfil_id = p.id
 where p.nombre_visible like 'PRUEBA%'
 order by p.nombre_visible;

-- Y lo que se ve desde fuera, sin sesión:
--   select * from public.ofertadores_publicos;
--   select nombre_visible, verificado from public.servidores_publicos;
