# Configuración completa — leído del proyecto real

Todo lo de aquí está **leído del proyecto `aquive` en producción** el
2026-08-14, no escrito de memoria. Úsalo para dejar el proyecto nuevo
idéntico, y como referencia cuando se te olvide.

---

## 1. Extensiones de Postgres

Estado real del proyecto viejo:

| Extensión | Versión | Esquema | ¿La instala `schema.sql`? |
|---|---|---|---|
| `pgcrypto` | 1.3 | **`extensions`** | Sí, línea 9 |
| `pg_cron` | 1.6.4 | **`pg_catalog`** | Sí, línea 10 |
| `supabase_vault` | 0.3.1 | `vault` | No — **ya viene instalada** |
| `pg_stat_statements` | 1.11 | `extensions` | No — la pone Supabase |
| `uuid-ossp` | 1.1 | `extensions` | No — la pone Supabase |
| `plpgsql` | 1.0 | `pg_catalog` | No — base de Postgres |

**Lo que hay que recordar de esto:** `pgcrypto` vive en el esquema
`extensions`, no en `public`. Como todas las funciones del proyecto van con
`set search_path = ''`, hay que llamarla con prefijo. El esquema ya lo hace
bien: `extensions.digest(...)` en las líneas 479, 507, 555, 576 y 605.

Cuando llegue la Fase E del plan v2, el cifrado se escribe igual:
`extensions.pgp_sym_encrypt`, nunca a secas.

Y `supabase_vault` **ya está**: si `vault.decrypted_secrets` te falla, es
problema de permisos del rol dueño de la función, no de extensión ausente.

Verificar en el proyecto nuevo:

```sql
select e.extname, e.extversion, n.nspname
from pg_extension e join pg_namespace n on n.oid = e.extnamespace
order by 1;
```

---

## 2. El job de expiración

Es lo que hace real la promesa de borrado a 72 horas. Sin esto, todo el
aviso de privacidad es mentira.

| jobid | schedule | command | active |
|---|---|---|---|
| 1 | `0 * * * *` | `select public.expirar_solicitudes();` | `true` |

Lo crea `schema.sql` en su línea 944. **Verifícalo igual**, porque si
`pg_cron` no quedó habilitado, el `select cron.schedule(...)` falla y el
resto del script sigue como si nada:

```sql
select jobid, schedule, command, active from cron.job;
```

Si sale vacío: Database → Extensions → habilita `pg_cron`, y vuelve a
correr el bloque final de `schema.sql`.

---

## 3. Autenticación con Google

### 3.1 En el panel de Supabase

**Authentication → Sign In / Providers → Google**

- Usa **el mismo Client ID y Client Secret** del proyecto viejo. Es lo que
  hace que el `sub` de Google que trae `05-datos-cuentas.sql` corresponda y
  que las 5 personas entren a su perfil existente.
- El Client ID lo ves en el panel del proyecto viejo (mismo sitio) o en
  Google Cloud Console. El Secret aparece enmascarado: si no lo tienes
  guardado, sácalo de Google Cloud Console → APIs y servicios →
  Credenciales.

**Authentication → URL Configuration**

- `Site URL`: el dominio de producción.
- `Redirect URLs`: agrega el dominio de producción y `http://localhost:3000`
  para desarrollo.

### 3.2 En Google Cloud Console

APIs y servicios → Credenciales → tu cliente OAuth 2.0 → *Authorized
redirect URIs*. Agrega:

```
https://<REF-DEL-PROYECTO-NUEVO>.supabase.co/auth/v1/callback
```

**No borres el del proyecto viejo hasta que todo funcione.** Es tu única
vuelta atrás.

### 3.3 Cómo lo usa la aplicación

`src/app/auth/callback/route.ts` es el **único** punto donde entra la
sesión. De todo el objeto que devuelve Google se usa exclusivamente
`user.id`; el correo se ignora a propósito y no se guarda en ninguna tabla
del proyecto.

Ojo con el matiz: **Supabase sí guarda el correo en `auth.users`**, porque
es parte de su esquema y no lo controlas. La regla de `CLAUDE.md` es sobre
las tablas del proyecto. Por eso `05-datos-cuentas.sql` lleva correos y por
eso hay que borrarlo tras ejecutarlo.

El callback no crea el perfil: solo decide a dónde mandar a la persona.
Si tiene perfil va a `/`, si no va a `/registro`.

---

## 4. Seguridad de la base — la parte que no se puede perder

Esta es la configuración que hace que el proyecto sea defendible. Si algo
de esto no queda igual en el proyecto nuevo, hay una fuga.

### 4.1 Tablas sin acceso directo

Tres tablas tienen el `SELECT` **revocado** para `anon` y `authenticated`.
No se leen nunca desde el cliente: solo por RPC.

| Tabla | RLS | Políticas | ¿anon lee? | ¿authenticated lee? |
|---|---|---|---|---|
| `solicitudes` | sí | 0 | **no** | **no** |
| `push_suscripciones` | sí | 0 | **no** | **no** |
| `push_ofertadores` | sí | 0 | **no** | **no** |

Que tengan **cero políticas es correcto y deliberado**: el acceso está
cortado un nivel más arriba, en el `GRANT`. Si alguna vez ves que
`solicitudes` responde desde la API REST, algo se rompió.

### 4.2 Tablas con RLS y políticas

| Tabla | Políticas |
|---|---|
| `perfiles` | 5 |
| `servidores` | 4 |
| `respuestas` | 3 |
| `reportes` | 3 |
| `administradores` | 1 |
| `catalogo_items` | 1 |
| `catalogo_servicios` | 1 |
| `municipios` | 1 |
| `metricas` | 1 |
| `solicitud_items` | 1 |

La de `administradores` es de fila propia (`auth.uid() = user_id`). Sin
ella, `/admin` queda inaccesible **para todo el mundo**, incluido el
administrador: RLS activo con cero políticas devuelve vacío.

### 4.3 Vistas públicas

Seis vistas, todas legibles por `anon` y `authenticated`, ninguna con RLS
propio: `solicitudes_publicas`, `servidores_publicos`,
`ofertadores_publicos`, `municipios_con_solicitudes`,
`municipios_con_servidores`, `municipios_con_ofertadores`.

**Son `SECURITY DEFINER` a propósito.** El cliente tiene revocado el acceso
a `solicitudes`; la vista *es* la frontera de seguridad, y por eso excluye
`token_hash`. No las cambies a `security_invoker` sin entender esto — está
documentado en `README.md`.

### 4.4 Funciones expuestas a la API REST

Esto es lo más delicado de toda la configuración. Toda función en `public`
queda expuesta en `/rest/v1/rpc/` según su `GRANT`.

**Llamables sin sesión (`anon`)** — son el flujo del solicitante, que no
tiene cuenta:

| Función | Por qué es pública |
|---|---|
| `crear_solicitud` | Publicar sin cuenta |
| `leer_solicitud` | Ver la propia con el token portador |
| `renovar_solicitud` | Renovar con el token |
| `cerrar_solicitud` | "Ya me ayudaron" |
| `guardar_push` | Suscripción atada a la solicitud |
| `crear_reporte` | Reportar es público a propósito |
| `listar_municipios` | Los 1.122 en una fila jsonb |

**Solo con sesión (`authenticated`)**: `crear_perfil`,
`responder_solicitud`, `guardar_push_ofertador`, `quitar_push_ofertador`,
`verificar_servidor`, `suspender_perfil`, `resolver_reporte`.

**Sin `EXECUTE` para nadie** — internas, y esto es crítico:

| Función | Qué pasaría si se expone |
|---|---|
| `expirar_solicitudes` | **Borrado masivo disparable desde internet** |
| `generar_codigo` | Enumeración de códigos |
| `es_admin` | — |

> Postgres concede `EXECUTE` a `PUBLIC` por defecto. `schema.sql` las
> revoca explícitamente por eso. Si al migrar corres alguna función suelta
> sin su `revoke`, queda abierta sin que nadie lo note.

Y recuerda: `es_admin()` tiene `EXECUTE` revocado, así que **no se puede
usar dentro de una política RLS** — la expresión corre con los permisos de
quien consulta y fallaría para todos. Las políticas hacen el `EXISTS`
contra `administradores` a mano.

Verificar en el proyecto nuevo:

```sql
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by 1;
```

Las tres internas deben dar `false, false`.

---

## 5. Point-in-Time Recovery: DESACTIVADO

Regla 4 de `CLAUDE.md`. `README.md` lo dice sin rodeos: si PITR está
activo, el aviso de privacidad miente, porque prometemos borrado duro y
habría copias recuperables.

Confírmalo en Settings → Database del proyecto nuevo. En plan Free no
debería estar disponible, pero verifícalo igual.

---

## 6. Variables de entorno

De `.env.local.example`. Van en Vercel (Settings → Environment Variables) y
en tu `.env.local` local.

### Cambian con la migración

```
NEXT_PUBLIC_SUPABASE_URL        https://<REF-NUEVO>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY       sb_secret_...
```

Settings → API del proyecto nuevo. Formato nuevo de llaves: la
*publishable* es la que antes se llamaba `anon`, la *secret* la que antes
era `service_role`.

⚠ La *secret* **salta el RLS por completo**. Solo en variables de entorno,
jamás en el repositorio ni en un mensaje.

### No cambian

```
VAPID_PUBLIC_KEY                no depende de Supabase
VAPID_PRIVATE_KEY               no depende de Supabase
NEXT_PUBLIC_VAPID_PUBLIC_KEY    la pública va dos veces
VAPID_SUBJECT                   mailto: real, Apple y Google lo usan
TURNSTILE_SECRET_KEY            el largo, ~35 caracteres
NEXT_PUBLIC_TURNSTILE_SITE_KEY  el corto, ~24 caracteres
```

Si regeneras las VAPID, **todas las suscripciones push existentes mueren**.
No las toques en esta migración.

Invertir las dos de Turnstile da error `400020` y nadie puede publicar. El
site key es el corto.

### 🔴 La que se te va a olvidar

```
MANTENIMIENTO=0
MANTENIMIENTO_LLAVE=<hex de 16 bytes>
```

**Si `MANTENIMIENTO` no existe, la aplicación queda CERRADA.** Es a
propósito —es preferible mostrar "volvemos pronto" que dejar publicar
contra una base a medio migrar— pero significa que si configuras las
variables nuevas en Vercel y se te olvida esta, **el sitio se cae en
silencio** y vas a creer que rompiste la migración.

De hecho, úsalo a favor: déjalo cerrado mientras migras y ábrelo al final.
Para entrar a verificar con el sitio cerrado:

```
https://<tu-dominio>/?llave=LA-LLAVE
```

Deja una cookie de 8 horas y la llave desaparece de la URL. Generarla:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

---

## 7. Cloudflare Turnstile

No cambia con la migración, pero revísalo porque se olvida:

El widget tiene una lista de *hostnames* permitidos. Debe incluir
`localhost` para desarrollo y el dominio real de producción. Si el dominio
no está, el widget falla y **nadie puede publicar una solicitud**.

Las llaves de prueba (`1x0000...`) dejan pasar a cualquiera. Nunca en
producción.

---

## 8. Orden recomendado el día de la migración

1. `MANTENIMIENTO=1` en Vercel → sitio cerrado, nadie escribe.
2. Google como proveedor en el proyecto nuevo (§3).
3. Los 5 archivos SQL en orden (ver `00-RUNBOOK.md`).
4. Verificar con `99-verificar.sql`.
5. Cambiar las tres variables de Supabase en Vercel.
6. Redesplegar.
7. Entrar con `?llave=` y hacer la prueba de humo del runbook.
8. `MANTENIMIENTO=0` → abierto.
9. Dejar el proyecto viejo activo unos días.
