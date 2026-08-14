# Dos proyectos: producción y pruebas

Cómo dejar configurados los dos proyectos de Supabase de la cuenta nueva,
con Google y Turnstile, sin duplicar trabajo ni mezclar datos reales con
datos de prueba.

Resumen de las tres decisiones, y luego el detalle:

| | Producción | Pruebas |
|---|---|---|
| **Google OAuth** | Mismo cliente | Mismo cliente, otro redirect URI |
| **Turnstile** | Widget real, dominio real | **Llaves de prueba de Cloudflare** |
| **Datos de personas reales** | Sí | **Nunca** |

---

## 1. Google: un solo cliente OAuth, dos redirect URIs

**No crees dos clientes.** Uno solo sirve a los dos proyectos, y hay una
razón concreta más allá de la comodidad: el `sub` que Google devuelve es
por cliente OAuth. Las identidades que migras en
`05-datos-cuentas.sql` traen los `sub` del cliente actual, así que si
producción usa un cliente distinto, **ninguna de las 5 personas engancha
con su perfil** y todas quedan huérfanas.

### En Google Cloud Console

APIs y servicios → Credenciales → tu cliente OAuth 2.0 → **Authorized
redirect URIs**. Deja los tres:

```
https://<REF-VIEJO>.supabase.co/auth/v1/callback     ← no lo borres todavía
https://<REF-PROD>.supabase.co/auth/v1/callback      ← nuevo
https://<REF-TEST>.supabase.co/auth/v1/callback      ← nuevo
```

El `REF` es el identificador del proyecto: sale en la URL del panel de
Supabase y en Settings → General.

Deja el viejo hasta que producción funcione. Es tu vuelta atrás.

### En cada proyecto de Supabase

Authentication → Sign In / Providers → Google, en **ambos**:

- Client ID y Client Secret: **los mismos** en los dos.
- Si no tienes el Secret guardado, sale de Google Cloud Console →
  Credenciales → tu cliente.

Authentication → URL Configuration, **distinto en cada uno**:

| | Site URL | Redirect URLs |
|---|---|---|
| **Prod** | `https://<tu-dominio-real>` | el dominio real |
| **Test** | `http://localhost:3000` | `http://localhost:3000`, y las URLs de preview de Vercel que uses |

### La pantalla de consentimiento

Si tu app está en modo **"Testing"** en Google Cloud, solo pueden entrar
las cuentas que listaste como *test users*, máximo 100. Si está **"In
production"**, entra cualquiera con Google.

Revísalo: es la causa más común de "me dice que la app no está verificada"
o de que alguien no pueda entrar y no sepas por qué.

### Un matiz sobre los uuid

El `sub` de Google es estable, pero el `uuid` de `auth.users` lo genera
cada proyecto por su cuenta. Es decir: tu cuenta de Google tendrá un uuid
en prod y otro distinto en test. Es normal.

Lo que importa es que dentro de **un mismo proyecto**, la fila de
`auth.identities` con `(provider='google', provider_id=<sub>)` apunte al
`user_id` correcto. Eso es exactamente lo que preserva
`05-datos-cuentas.sql` para producción.

---

## 2. Turnstile: widget real solo en producción

En pruebas **usa las llaves de prueba oficiales de Cloudflare**. No son un
atajo sucio: están documentadas para esto y **no tienen restricción de
hostname**, así que funcionan en `localhost` y en cualquier URL de preview
de Vercel — que son aleatorias (`aquive-git-rama-xxxx.vercel.app`) y por
eso jamás podrías meterlas todas en una lista blanca.

### Pruebas

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

Ese par **siempre pasa**. Si alguna vez necesitas probar el camino de
error, Cloudflare tiene otros pares:

| Sitekey | Secret | Qué hace |
|---|---|---|
| `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` | Siempre pasa |
| `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` | Siempre falla |
| `3x00000000000000000000FF` | — | Fuerza el reto interactivo |

### Producción

Widget real, con el dominio real en la lista de hostnames. Dos cosas de la
documentación que conviene saber:

- **Los subdominios se incluyen solos.** Si agregas `aquive.co`, cubre
  `aquive.co` y todos sus subdominios. Si agregas `www.aquive.co`, cubre
  *solo* eso y sus hijos — no el dominio padre.
- **Máximo 10 hostnames por widget** en plan gratuito.

🔴 **Nunca pongas las llaves de prueba en producción.** Dejan pasar a
cualquiera y el anti-spam queda de adorno.

⚠ Y recuerda el orden: el **site key es el corto** (~24 caracteres), el
**secret es el largo** (~35). Invertirlos da error `400020` y nadie puede
publicar una solicitud.

---

## 3. Qué SQL corre en cada proyecto

**Producción** — los cinco, en orden:

```
schema.sql → seed-municipios.sql → 03-seed-servicios.sql
           → seed-catalogo.sql → 05-datos-cuentas.sql
```

**Pruebas** — los cuatro primeros. **`05-datos-cuentas.sql` NO va nunca.**

Ese archivo tiene correos, teléfonos, nombres y un número de matrícula
médica de personas reales. Meterlos en un entorno de pruebas —donde vas a
experimentar, donde la seguridad es más laxa y donde probablemente le des
acceso a alguien más— es exactamente el tipo de fuga que el resto del
proyecto está diseñado para evitar.

Para tener un administrador en pruebas: entra con Google normalmente, y
después:

```sql
-- En el proyecto de PRUEBAS, tras iniciar sesión al menos una vez:
insert into public.administradores (user_id)
select id from auth.users where email = 'camilo.cai16@gmail.com'
on conflict do nothing;
```

Y verifica los dos con `99-verificar.sql`. En pruebas, el bloque 4 dará
números distintos (los tuyos), no 5/5/5/1/1 — todo lo demás debe coincidir.

Para tener algo que mirar en el tablero de pruebas, `98-seed-pruebas.sql`
crea cinco solicitudes en cinco municipios y categorías distintas. Va por
`crear_solicitud`, así que pasa por las mismas validaciones que la
aplicación. Expiran solas a las 72 horas y se puede volver a ejecutar.
**Nunca en producción**: sus tokens están escritos en el archivo.

---

## 4. Variables de entorno en Vercel

Vercel tiene tres entornos y cada variable se puede fijar por entorno. Ese
es el mecanismo que hace útil tener dos proyectos:

| Entorno de Vercel | Apunta a | Cuándo se usa |
|---|---|---|
| **Production** | Supabase **prod** | La rama principal, el dominio real |
| **Preview** | Supabase **test** | Cada rama y cada pull request |
| **Development** | Supabase **test** | Tu `.env.local` |

Al crear cada variable en Settings → Environment Variables, marca solo las
casillas del entorno que corresponde.

### Qué cambia entre entornos

```
NEXT_PUBLIC_SUPABASE_URL         distinto
NEXT_PUBLIC_SUPABASE_ANON_KEY    distinto
SUPABASE_SERVICE_ROLE_KEY        distinto
NEXT_PUBLIC_TURNSTILE_SITE_KEY   real en prod, de prueba en test
TURNSTILE_SECRET_KEY             real en prod, de prueba en test
```

### Qué puede ser igual

```
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_SUBJECT
```

Las suscripciones push son por origen, así que compartir el par VAPID entre
prod y test no las mezcla. Si prefieres aislarlas del todo, genera un par
aparte solo para test con `npx web-push generate-vapid-keys`.

🔴 **Nunca regeneres el par de producción.** Si lo cambias, todas las
suscripciones push existentes mueren de golpe y nadie recibe avisos.

### La que se te va a olvidar

```
MANTENIMIENTO=0
MANTENIMIENTO_LLAVE=<hex de 16 bytes>
```

**En los tres entornos.** Si falta, la aplicación queda **cerrada** — es
a propósito, pero en preview te va a parecer que rompiste algo.

En producción déjala en `1` mientras migras y pásala a `0` al final.

---

## 5. Dos cosas del plan Free que te van a morder

**Solo 2 proyectos activos por organización.** Con prod y test ya estás en
el tope: no vas a poder crear un tercero sin pausar alguno. El proyecto
`aquive` viejo está en la otra organización, así que no cuenta contra esta.

**Los proyectos se pausan tras una semana de inactividad.** El de pruebas
es el candidato natural: lo vas a encontrar pausado cada vez que vuelvas
después de unos días. Se reactiva con un clic desde el panel, no se pierde
nada, pero no te asustes cuando pase.

---

## 6. Cómo saber a cuál estás apuntando

Cuando lleves un rato y ya no te acuerdes de cuál es cuál:

```sql
-- En el SQL Editor. Prod tendrá 5 perfiles; test los tuyos.
select current_database(),
       (select count(*) from public.perfiles) as perfiles,
       (select count(*) from auth.users)      as usuarios;
```

Y del lado de la aplicación, `NEXT_PUBLIC_SUPABASE_URL` es visible en el
navegador: en las herramientas de desarrollo, cualquier petición a
Supabase muestra el `REF` del proyecto en el dominio.

Vale la pena anotar los dos `REF` en algún lado antes de que se confundan:

```
PROD: https://__________.supabase.co
TEST: https://__________.supabase.co
```
