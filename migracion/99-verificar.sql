-- =====================================================================
-- Verificación post-migración. Correr ENTERO en el SQL Editor del
-- proyecto NUEVO, después de los 5 archivos.
--
-- Cada bloque dice qué debe salir. Si algo no coincide, no sigas: revisa
-- 01-CONFIGURACION.md antes de abrir el sitio.
-- =====================================================================


-- 1. EXTENSIONES ------------------------------------------------------
-- Esperado: pgcrypto en `extensions`, pg_cron en `pg_catalog`,
--           supabase_vault en `vault`.
select e.extname, e.extversion, n.nspname as esquema
from pg_extension e join pg_namespace n on n.oid = e.extnamespace
where e.extname in ('pgcrypto','pg_cron','supabase_vault')
order by 1;


-- 2. JOB DE EXPIRACIÓN ------------------------------------------------
-- Esperado: 1 fila | 15 * * * * | select public.expirar_servicios(); | t
-- Si sale vacío: pg_cron no quedó habilitado. Sin esto NO hay borrado
-- a 72 horas y el aviso de privacidad miente.
select jobid, schedule, command, active from cron.job;


-- 3. CONTEOS DE CATÁLOGO ----------------------------------------------
-- Esperado: 1122 | 36 | 182 | 181 | 36
select
  (select count(*) from public.municipios)                          as municipios,
  (select count(*) from public.catalogo_servicios)                  as servicios,
  (select count(*) from public.catalogo_items)                      as items,
  (select count(*) from public.catalogo_items where activo)         as items_activos,
  (select count(*) from public.catalogo_items where id like 'serv\_%') as items_servicio;
-- items_servicio en 0 = corriste seed-catalogo.sql ANTES que
-- seed-servicios.sql. Vuelve a correr seed-catalogo.sql: es idempotente.


-- 4. CUENTAS Y PERFILES -----------------------------------------------
-- Esperado: 5 | 5 | 5 | 1 | 1
select
  (select count(*) from auth.users)             as users,
  (select count(*) from auth.identities)        as identities,
  (select count(*) from public.perfiles)        as perfiles,
  (select count(*) from public.servidores)      as servidores,
  (select count(*) from public.administradores) as admins;


-- 5. NINGÚN PERFIL HUÉRFANO -------------------------------------------
-- Esperado: 0 filas. Si sale algo, la copia de auth.users quedó
-- incompleta y esas personas no van a poder entrar.
select p.id, p.nombre_visible
from public.perfiles p
left join auth.users u on u.id = p.id
where u.id is null;


-- 6. IDENTIDADES DE GOOGLE --------------------------------------------
-- Esperado: 5 filas, todas provider='google', con provider_id numérico
-- largo (el `sub`). Si provider_id no coincide con el del proyecto
-- viejo, la persona entrará como usuario NUEVO y su perfil quedará
-- huérfano.
select provider, count(*) as n from auth.identities group by 1;


-- 7. TABLAS SIN ACCESO DIRECTO ----------------------------------------
-- Esperado: las 3 con anon=false y auth=false.
-- Que tengan 0 políticas es correcto: el corte está en el GRANT.
select c.relname as tabla,
       c.relrowsecurity as rls,
       has_table_privilege('anon', c.oid, 'SELECT')          as anon,
       has_table_privilege('authenticated', c.oid, 'SELECT') as auth
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('solicitudes_servicio','push_avisos','publicaciones_muro')
order by 1;


-- 8. FUNCIONES INTERNAS CERRADAS --------------------------------------
-- Esperado: las 3 en false/false.
-- `expirar_servicios` expuesta = borrado masivo disparable desde
-- internet. Postgres concede EXECUTE a PUBLIC por defecto, así que esto
-- se rompe solo si algo se corrió sin su REVOKE.
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('expirar_servicios','generar_codigo','es_admin')
order by 1;


-- 9. FUNCIONES PÚBLICAS ABIERTAS --------------------------------------
-- Esperado: las 7 con anon=true. Son el flujo del solicitante, que no
-- tiene cuenta. Si alguna sale en false, ese flujo está roto.
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('crear_solicitud','leer_solicitud','renovar_solicitud',
                    'cerrar_solicitud','guardar_push','crear_reporte',
                    'listar_municipios')
order by 1;


-- 10. VISTAS PÚBLICAS -------------------------------------------------
-- Esperado: 6 vistas, todas legibles por anon.
select c.relname,
       has_table_privilege('anon', c.oid, 'SELECT') as anon
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
order by 1;


-- 11. EL TOKEN NO SE FILTRA -------------------------------------------
-- Esperado: 0 filas. `token_hash` jamás puede estar en una vista
-- pública.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and column_name = 'token_hash'
  and table_name in (
    select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='v');


-- 12. POLÍTICA DE ADMINISTRADORES -------------------------------------
-- Esperado: 1 fila. Sin ella, /admin queda inaccesible para TODOS,
-- incluido el administrador: RLS activo con 0 políticas devuelve vacío.
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'administradores';


-- =====================================================================
-- Módulo de Servicios (PLAN-V3)
-- =====================================================================

-- 13. CATÁLOGOS SEMBRADOS ----------------------------------------------
-- Esperado: 41 oficios y 37 zonas (22 comunas + 15 corregimientos de
-- Cali). Si oficios da 0, faltó `seed-oficios.sql`; si zonas da 0, faltó
-- `seed-zonas.sql`, y el desplegable de comuna sale vacío sin dar error.
select (select count(*) from public.catalogo_oficios) as oficios,
       (select count(*) from public.zonas)            as zonas;


-- 14. LOS OFICIOS DE RIESGO SIGUEN EN RIESGO ---------------------------
-- Esperado: 4 filas — cuidado de niños, de personas mayores,
-- acompañamiento y transporte de pasajeros. Si alguno bajó a `bajo`, se
-- publica sin verificación ni referencia (regla S) y eso es una decisión
-- sobre personas, no un ajuste de datos.
select id, nombre, riesgo from public.catalogo_oficios
where riesgo = 'alto' order by id;


-- 15. LAS REFERENCIAS ESTÁN REVOCADAS ----------------------------------
-- Esperado: 4 filas, todas en `false`. Son datos cifrados de terceros que
-- no usan la plataforma: si `anon` o `authenticated` pueden leerlas, la
-- regla U está rota y el material cifrado es volcable.
select r.rol, t.tabla, has_table_privilege(r.rol, t.tabla, 'SELECT') as puede_leer
from (values ('anon'), ('authenticated')) r(rol),
     (values ('public.referencias'), ('public.accesos_referencia')) t(tabla)
order by 1, 2;


-- 16. EL JOB DE EXPIRACIÓN DE SERVICIOS --------------------------------
-- Esperado: 1 fila, activa. Sin él las solicitudes de servicio no se
-- borran nunca y la promesa de los 15 días es mentira.
select jobname, schedule, active from cron.job
where jobname = 'expirar-servicios';


-- 17. NI EL TOKEN NI EL CÓDIGO SE FILTRAN ------------------------------
-- Esperado: 0 filas. Mismo criterio que el punto 11, para las columnas
-- que el módulo de Servicios agregó.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and column_name in ('token_hash', 'codigo_hash',
                      'nombre_cifrado', 'telefono_cifrado')
  and table_name in (
    select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='v');
