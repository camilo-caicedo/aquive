# Verificar el dominio y aprobar la marca en Google

Guía paso a paso para quitar el `oopjkazypcvadvllnaps.supabase.co` de la
pantalla de inicio de sesión con Google.

## Por qué en este orden

Los pasos dependen unos de otros y saltárselos hace perder días:

```
1. Verificar aquive.co en Search Console
        ↓  (sin esto, el paso 2 no te deja)
2. Agregar aquive.co como "Authorized domain" en Google Auth Platform
        ↓  (sin esto, el paso 3 se rechaza)
3. Enviar la marca a verificación
```

Google ya te rechazó una vez por tres motivos. El primero —"the website of
your home page URL is not registered to you"— es este bloqueo. Los otros
dos fueron porque el revisor entró mientras el sitio estaba en
mantenimiento: vio una página que no explicaba el propósito y que mostraba
el nombre en mayúsculas. Por eso el paso 0.

---

## Paso 0 · Llevar los cambios a producción

**Esto va primero porque la verificación se hace contra `aquive.co`, que es
`main`.** Los parches están en `develop` y ahí no le sirven a Google.

Dos archivos cambiaron:

| Archivo | Qué hace |
|---|---|
| `src/app/layout.tsx` | Agrega la etiqueta de verificación |
| `src/lib/mantenimiento.ts` | Nombre en capitalización real + línea de propósito |

Como `develop` tiene trabajo a medias que todavía no quieres en producción,
llévalos con una rama de arreglo desde `main`:

```bash
git checkout main
git pull
git checkout -b arreglo/verificacion-google

git checkout develop -- src/app/layout.tsx src/lib/mantenimiento.ts
git commit -m "fix: verificacion de dominio y marca en la pagina de mantenimiento"
```

**No lo mezcles todavía.** Primero necesitas el código de Search Console
para reemplazar el marcador de posición. Vuelves aquí en el paso 2.

---

## Paso 1 · Search Console, propiedad de Dominio (el TXT)

Esta es la que de verdad desbloquea. Cubre `aquive.co`, todos sus
subdominios y los dos protocolos de una sola vez.

### 1.1 Crear la propiedad

1. Entra a **[search.google.com/search-console](https://search.google.com/search-console)**.
2. 🔴 **Con la cuenta de Google que es propietaria del proyecto de GCP** —
   la misma que tiene el cliente OAuth. **No** con la que compró el
   dominio: eso da igual, Search Console no mira al registrador.
3. Arriba a la izquierda, el selector de propiedades → **Agregar
   propiedad**.
4. Elige la columna de la izquierda, **Dominio**.
5. Escribe `aquive.co` (sin `https://`, sin `www`).
6. Te muestra un registro TXT así:
   `google-site-verification=AbCdEf123...`
   Cópialo entero. **Deja esa ventana abierta.**

### 1.2 Poner el TXT en Vercel

1. Entra a **[vercel.com](https://vercel.com)** y selecciona el equipo
   **Coffea Origen Co**.
2. En la barra superior, pestaña **Domains** (es del equipo, no de un
   proyecto).
3. Clic en **aquive.co**.
4. Pestaña o sección **DNS Records** → botón **Add Record** o
   **Create Record**.
5. Llénalo así:

   | Campo | Valor |
   |---|---|
   | **Name** | déjalo **vacío** (o `@`, según cómo lo muestre) |
   | **Type** | `TXT` |
   | **Value** | `google-site-verification=AbCdEf123...` |
   | **TTL** | el que venga por defecto |

6. **Add** / **Save**.

> ⚠ Vacío en Name significa la raíz del dominio. Si escribes `aquive.co`
> ahí, Vercel crea el registro en `aquive.co.aquive.co` y no funciona.

### 1.3 Verificar

1. Vuelve a la ventana de Search Console.
2. **Verificar**.
3. Si dice que no encuentra el registro, espera unos minutos y reintenta.
   Los DNS de Vercel suelen propagar rápido, pero a veces tarda.

---

## Paso 2 · Search Console, propiedad de prefijo de URL (la etiqueta)

Esta es el respaldo. Vale la pena porque si algún día tocas el DNS —por
ejemplo al configurar Zoho— y borras el TXT sin darte cuenta, no pierdes la
verificación.

1. En Search Console, **Agregar propiedad** otra vez.
2. Ahora la columna de la derecha, **Prefijo de la URL**.
3. Escribe `https://aquive.co` (esta vez **sí** con `https://`).
4. En la lista de métodos, despliega **Etiqueta HTML**.
5. Te muestra algo así:
   `<meta name="google-site-verification" content="XyZ789..." />`
   **Copia solo el valor de `content`**, sin las comillas ni el resto.
6. Abre `src/app/layout.tsx` en tu rama `arreglo/verificacion-google`,
   busca la línea 42 y reemplaza el marcador:

   ```ts
   verification: { google: "XyZ789..." },
   ```

7. Guarda y commitea:

   ```bash
   git add src/app/layout.tsx
   git commit -m "chore: codigo de verificacion de Search Console"
   ```

**Todavía no verifiques.** Falta que esté desplegado y que el sitio esté
abierto. Sigue al paso 3.

---

## Paso 3 · Abrir el sitio y desplegar

La página de mantenimiento devuelve `503` y **no incluye tu `layout.tsx`**,
así que con el sitio cerrado la etiqueta no existe y la verificación falla.
Es el mismo motivo por el que te rechazaron la marca.

### 3.1 Abrir

1. Vercel → proyecto **aquive** → **Settings** → **Environment Variables**.
2. Busca `MANTENIMIENTO`.
3. Que en el entorno **Production** valga `0`.
4. Guarda.

### 3.2 Desplegar

```bash
git checkout main
git merge arreglo/verificacion-google
git push origin main
```

Espera a que Vercel termine el despliegue.

### 3.3 Comprobar antes de seguir

Abre `https://aquive.co` en una ventana de incógnito. Tienes que ver la
aplicación real, **no** "Estamos haciendo un ajuste".

Y confirma que la etiqueta llegó: clic derecho → Ver código fuente → busca
`google-site-verification`. Si no está, el despliegue no terminó o el
merge no llegó.

---

## Paso 4 · Verificar la segunda propiedad

Vuelve a Search Console, a la propiedad de prefijo de URL, y dale
**Verificar**.

Ahora deberías tener **dos propiedades verificadas**: `aquive.co` (dominio)
y `https://aquive.co` (prefijo).

---

## Paso 5 · Configurar la marca en Google

1. Entra a **[console.cloud.google.com/auth/branding](https://console.cloud.google.com/auth/branding)**.
2. 🔴 Confirma arriba a la izquierda que estás **en el proyecto de GCP
   correcto** — el que contiene el cliente OAuth que usa Supabase.
3. Llena **exactamente** esto:

   | Campo | Valor |
   |---|---|
   | **App name** | `AquíVe` — con la tilde, con esa capitalización, sin el "· Ayuda directa en Colombia" |
   | **User support email** | tu correo |
   | **App logo** | el mismo ícono del sitio |
   | **Application home page** | `https://aquive.co` |
   | **Privacy policy link** | `https://aquive.co/privacidad` |
   | **Terms of service link** | `https://aquive.co/terminos` |
   | **Authorized domains** | `aquive.co` |
   | **Developer contact** | tu correo |

> El campo **Authorized domains** solo acepta dominios verificados en
> Search Console con esa misma cuenta. Si te lo rechaza, es que el paso 1
> no quedó bien.

4. **Save**.
5. En **Audience**, confirma que el estado sea **In production**, no
   "Testing".
6. Vuelve a **Branding** y envía a verificación.

---

## Paso 6 · Mientras Google revisa

**No cierres el sitio.** Nada de `MANTENIMIENTO=1` hasta que te respondan.
Si el revisor cae en una ventana de mantenimiento, te rechazan otra vez —
que es exactamente lo que pasó la primera.

La revisión tarda varios días hábiles. Google responde por correo a la
dirección de contacto del desarrollador.

---

## Lo que falta y es contenido, no configuración

El revisor está evaluando **un cliente OAuth**, no la aplicación en
general. Tu portada explica muy bien qué es AquíVe, pero no dice en ningún
lado para qué se usa el inicio de sesión con Google ni qué se hace con ese
dato.

Agrega una línea visible en la portada, del estilo:

> Quien quiere ayudar entra con su cuenta de Google. Solo guardamos el
> identificador de la cuenta; el correo no se almacena.

Y es verdad, que es más de lo que suele poner la mayoría: el callback en
`src/app/auth/callback/route.ts` usa exclusivamente `user.id` y descarta el
correo a propósito.

---

## Si te vuelven a rechazar

Lee el motivo literal y contrástalo con esto:

| Motivo | Qué revisar |
|---|---|
| "not registered to you" | El paso 1 o 2 no quedó verificado, o lo hiciste con otra cuenta de Google |
| "does not explain the purpose" | El sitio estaba cerrado, o falta la línea del inicio de sesión con Google |
| "name does not match" | El sitio estaba cerrado, o el App name no es exactamente `AquíVe` |

Las tres veces, lo primero que hay que descartar es que el sitio estuviera
en mantenimiento.
