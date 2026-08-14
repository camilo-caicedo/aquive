# Migración de AquíVe a la cuenta nueva de Supabase

Generado el 2026-08-14 desde el proyecto `aquive` (`oopjkazypcvadvllnaps`,
organización `coffeaorigenco`, región `ca-central-1`).

---

## Qué hay que mover, en realidad

Este proyecto está diseñado para ser desechable, y eso juega a favor: casi
todo se reconstruye desde el repositorio. Lo único irreemplazable son las
cuentas.

| Qué | Cuánto | Cómo se recupera |
|---|---|---|
| Esquema completo | — | `schema.sql` del repo |
| Municipios | 1.122 | `seed-municipios.sql` del repo |
| Catálogo de ítems | 182 (181 activos) | `seed-catalogo.sql` del repo |
| **Catálogo de servicios** | **36** | **`03-seed-servicios.sql` — no existía, ver abajo** |
| Cuentas Google + perfiles | 5 | `05-datos-cuentas.sql` |
| Servidor verificado | 1 | idem |
| Administrador | 1 | idem |
| Solicitudes vivas | 2 | **no se migran** — mueren solas en <72 h |
| Métricas | 0 | nada que mover |
| Suscripciones push | 2 | **no se migran** — ver nota al final |

### El archivo que faltaba en el repo

`catalogo_servicios` tenía 36 filas en producción y **ningún archivo del
repositorio las insertaba**. `schema.sql` solo crea la tabla, y
`seed-catalogo.sql` deriva ítems a partir de ella pero nunca la llena.

Levantar el proyecto desde cero dejaba vacía la categoría entera de
servicios profesionales: los 36 servicios **y** los 36 ítems derivados
(`serv_*`). El archivo `03-seed-servicios.sql` corrige eso.

**Cópialo a `supabase/seed-servicios.sql` en el repo**, no solo a esta
carpeta. Es un hueco que existía desde antes de esta migración y que
volvería a morder la próxima vez.

---

## Orden de ejecución

En el **SQL Editor del proyecto nuevo**, uno por uno, verificando cada paso.

| # | Archivo | De dónde sale |
|---|---|---|
| 1 | `schema.sql` | repo, `supabase/` |
| 2 | `seed-municipios.sql` | repo, `supabase/` |
| 3 | `03-seed-servicios.sql` | **esta carpeta** |
| 4 | `seed-catalogo.sql` | repo, `supabase/` |
| 5 | `05-datos-cuentas.sql` | **esta carpeta** |

El orden 3 → 4 no es negociable: `seed-catalogo.sql` hace
`insert into catalogo_items ... select from catalogo_servicios where activo`.
Si corres el 4 antes del 3, no deriva nada y te quedas sin los 36 ítems de
servicios, sin ningún error visible.

Antes del paso 5, **el proveedor de Google tiene que estar ya configurado**
(ver "Consola", punto 1).

---

## Verificación después de cada paso

```sql
-- Tras el paso 2
select count(*) from public.municipios;              -- 1122

-- Tras el paso 3
select count(*) from public.catalogo_servicios;      -- 36

-- Tras el paso 4
select count(*) from public.catalogo_items;          -- 182
select count(*) from public.catalogo_items where activo;  -- 181
select count(*) from public.catalogo_items where id like 'serv\_%';  -- 36

-- Tras el paso 5
select
  (select count(*) from auth.users)             as users,        -- 5
  (select count(*) from auth.identities)        as identities,   -- 5
  (select count(*) from public.perfiles)        as perfiles,     -- 5
  (select count(*) from public.servidores)      as servidores,   -- 1
  (select count(*) from public.administradores) as admins;       -- 1
```

Ese `181` frente a `182` es correcto: `panal_mascota` queda desactivado a
propósito por el propio seed, para no romper referencias históricas desde
`solicitud_items`.

En un proyecto nuevo el total es `181`, no `182`: `panal_mascota` era una
fila heredada del proyecto viejo y ningún archivo la crea.

### Después del paso 5, siempre

Insertar filas en `auth.users` a mano deja en `NULL` unas columnas que
GoTrue lee como texto, y el login falla con un error que no menciona nada
de esto:

```
sql: Scan error on column index 3, name "confirmation_token":
converting NULL to string is unsupported
```

El proveedor de Google queda bien configurado, los registros de Auth
muestran `/authorize` y `/callback` en `302` sin error, y aun así nadie
puede entrar. Se arregla con cadenas vacías:

```sql
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  email_change               = coalesce(email_change, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '');
```

`phone` **sí** se deja en `NULL`: tiene índice único y varias cadenas
vacías chocarían entre sí.

---

## Consola — lo que no se puede automatizar

### 1. Google como proveedor de Auth
**Antes del paso 5.** Authentication → Providers → Google. Usa el mismo
Client ID y Client Secret del proyecto viejo, para que el `sub` de Google
que trae `05-datos-cuentas.sql` corresponda.

En Google Cloud Console, agrega el nuevo callback a los *Authorized redirect
URIs*: `https://<REF-NUEVO>.supabase.co/auth/v1/callback`. **No borres el
viejo todavía** — si algo falla, es tu única vuelta atrás.

### 2. URL Configuration
Authentication → URL Configuration. `Site URL` y `Redirect URLs` con el
dominio de producción (`https://aquive.vercel.app` y el que uses).

### 3. Point-in-Time Recovery: DESACTIVADO
Regla 4 de `CLAUDE.md`. `README.md` lo dice sin rodeos: si PITR está
activo, el aviso de privacidad miente. Confírmalo en el proyecto nuevo, no
lo des por hecho.

### 4. El job de expiración
`schema.sql` lo crea en su línea 944, pero **verifícalo**: sin él no hay
borrado a 72 h y toda la promesa de privacidad se cae en silencio.

```sql
select jobid, schedule, command, active from cron.job;
-- esperado: 1 | 0 * * * * | select public.expirar_solicitudes(); | t
```

Si `cron.job` está vacío, `pg_cron` no quedó habilitado. Actívalo en
Database → Extensions y vuelve a correr el bloque final de `schema.sql`.

### 5. Variables de entorno
En Vercel y en tu `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL       ← nueva URL del proyecto
NEXT_PUBLIC_SUPABASE_ANON_KEY  ← nueva anon key
SUPABASE_SERVICE_ROLE_KEY      ← nueva service role key
```

Las de VAPID y Turnstile **no cambian**: no dependen de Supabase.

⚠ La `service_role` key nueva salta el RLS por completo. Que quede solo en
las variables de Vercel y en `.env.local`, nunca en el repositorio.

### 6. Redespliega en Vercel
Un redespliegue completo, no un *rollback* de caché, para que tome las
variables nuevas.

---

## Prueba de humo, en este orden

1. Abre el tablero público sin sesión → carga y no muestra tokens.
2. Filtra por municipio → el desplegable trae los 1.122.
3. **Inicia sesión con Google con una de las 5 cuentas migradas.** Debe
   entrar directo a su perfil existente, sin pedir registro de nuevo. Si
   pide registrarse, la identidad no enganchó: revisa que el Client ID de
   Google sea el mismo.
4. Entra a `/admin` con la cuenta de administrador.
5. Abre `/servidores` → Valentina aparece **con sello de verificada**.
6. Publica una solicitud de prueba con `barrio` = `PRUEBA — migración`,
   confirma que aparece en el tablero, y **bórrala**.
7. `select public.expirar_solicitudes();` **no**. No la corras a mano: no
   tiene filtro y borra todo lo vencido. Espera a que el cron actúe.

---

## Después de que funcione

- [ ] Copiar `03-seed-servicios.sql` a `supabase/seed-servicios.sql` en el
      repo y commitearlo. Actualizar la tabla de `README.md` y el orden de
      ejecución que ahí aparece, que hoy lista solo tres archivos.
- [ ] **Borrar `05-datos-cuentas.sql`.** Contiene correos, teléfonos,
      nombres y un número de matrícula profesional. Si lo dejas en el
      repositorio, agrégalo a `.gitignore` primero — pero lo correcto es
      borrarlo una vez ejecutado.
- [ ] Avisar a las 4 personas con perfil que su cuenta sigue viva. No hay
      que hacer nada de su lado, pero es cortesía.
- [ ] Dejar el proyecto viejo **activo unos días** como red de seguridad, y
      recién después pausarlo o borrarlo.
- [ ] Revisar cuántos proyectos activos quedan: el plan Free permite 2.

## Nota sobre las suscripciones push

Las 2 filas de `push_ofertadores` no se migran a propósito. El `endpoint`
lo emite el navegador y está atado a la clave VAPID, que no cambia — así
que técnicamente seguirían sirviendo. Pero son 2 filas de 2 personas que
recuperan el aviso simplemente volviendo a activarlo desde su perfil, y
mover endpoints de push entre bases es una fuente de errores silenciosos
que no vale la pena por dos registros.

## Las 11 cuentas que no se migran

Once personas iniciaron sesión con Google y nunca completaron el registro.
No tienen perfil, ni respuestas, ni nada asociado. No se migran: es un dato
personal menos que mover, y si vuelven, se registran normal.
