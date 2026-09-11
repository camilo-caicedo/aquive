# TASK_PLAN: Referencia confirmada, teléfono verificado y suspensión — a Route Handler, con aviso

**Estado:** LISTO PARA EJECUCIÓN — depende de `Planes/Terminados/campanita-mis-avisos-reescrita.md`
**Arquitecto:** Claude Code
**Constructor:** Antigravity

## Trazabilidad

- **Fuente:** revisión conjunta con el usuario, 2026-09-10 — "el fallo más grande de la app
  son las notificaciones". El usuario pidió explícitamente mover estas tres acciones a
  servidor ya, no dejarlas para una migración aparte.
- **Sin ADR** — no cambia ninguna regla dura ni quién la sostiene: la comprobación de
  permiso (`es_admin()` / `es_miembro_activo()` / `puede_leer_referencia()`) sigue viviendo
  **dentro** de la función de Postgres, exactamente igual que hoy. Lo único que cambia es
  desde dónde se llama esa función — del navegador a un Route Handler — y que ahora, si
  tiene éxito, también dispara un aviso. Si mañana se decide envolver esto en un contrato
  oRPC de admin/aliado de verdad (no existe ninguno todavía), es una decisión aparte y más
  grande que este plan no toma por su cuenta.

## 1. Análisis de impacto en el sistema

- **Módulo de dominio:** ninguno nuevo — las tres funciones de Postgres ya existen y ya
  comprueban el permiso adentro. Este plan no toca `src/server/`.
- **Archivos nuevos:** tres Route Handlers (o uno solo con una rama por acción, a tu
  criterio — ver Sección 2):
  - `src/app/api/admin/verificar-telefono/route.ts` (o el nombre que sigas)
  - `src/app/api/admin/suspender-proveedor/route.ts`
  - `src/app/api/admin/marcar-referencia/route.ts`
- **Archivos a modificar:**
  - `src/app/admin/panel-servicios.tsx` — los dos puntos del dispatcher genérico `llamar(fn,
    args)` que hoy llaman `verificar_telefono_proveedor` y `suspender_proveedor` directo.
  - `src/app/aliado/panel-proveedores.tsx` — mismas dos acciones, del lado del aliado.
  - `src/app/aliado/panel-referencias.tsx` — `marcar_referencia`.
- **Dependencias nuevas:** ninguna.

## 2. Blueprint arquitectónico y contratos

### El punto crítico: qué cliente de Supabase usar

Las tres funciones son `security definer` y comprueban el permiso **con `auth.uid()`
adentro** — `es_admin(auth.uid())`, `es_miembro_activo(v_org, auth.uid())`,
`puede_leer_referencia(p_id)` (esta última también resuelve `auth.uid()` adentro). Si el
Route Handler llama al RPC con un cliente de **service role**
(`createServiceClient()`, el que usa `api/servicios/confirmar/route.ts` porque esa ruta no
tiene sesión), `auth.uid()` da `NULL` dentro de la función y el `raise exception 'No
autorizado'` la tumba siempre.

**Usa el cliente de sesión** (`createClient()` de `@/lib/supabase/server`, el que lee
cookies) — el mismo patrón que ya usa `src/app/api/perfil/route.ts:22-26` para tener sesión
en un Route Handler. Con ese cliente, `supabase.rpc(...)` corre con el JWT de quien hizo el
request, y `auth.uid()` adentro de la función funciona exactamente igual que hoy corriendo
desde el navegador — no hay que repetir la comprobación de permiso en TypeScript, ya está
cubierta.

### Un Route Handler por acción (recomendado) o uno con rama — tu criterio

Las tres acciones son independientes (payload distinto, tabla distinta, texto de aviso
distinto). Un archivo por acción es más simple de seguir que un dispatcher genérico nuevo —
pero si prefieres un solo `route.ts` con un `switch` sobre un campo `accion` del body, es
aceptable siempre que cada rama quede clara. Lo que no vale es reproducir el patrón
`llamar(fn, args)` genérico del cliente (línea ~101-119 de `panel-servicios.tsx`) del lado
del servidor: ahí es donde ese patrón generaliza demasiado y esconde qué RPC exacto se
llama con qué permiso.

### Patrón por acción, con el ejemplo de teléfono verificado

```ts
// src/app/api/admin/verificar-telefono/route.ts
import { createClient } from '@/lib/supabase/server'
import { db } from '@/db/cliente'
import { proveedores } from '@/db/esquema'
import { eq } from 'drizzle-orm'
import { avisar } from '@/server/avisos/push'

export async function POST(request: Request) {
  const { proveedor_id, verificado } = await request.json()
  const supabase = await createClient()

  const { error } = await supabase.rpc('verificar_telefono_proveedor', {
    p_proveedor_id: proveedor_id,
    p_verificado: verificado,
  })
  if (error) {
    return Response.json({ motivo: error.message }, { status: 400 })
  }

  if (verificado) {
    const [fila] = await db
      .select({ perfilId: proveedores.perfilId })
      .from(proveedores)
      .where(eq(proveedores.id, proveedor_id))
      .limit(1)
    if (fila) {
      await avisar(db, fila.perfilId, {
        cuerpo: 'Verificamos tu teléfono. Tu ficha ya se ve en el directorio.',
        url: '/perfil/verificaciones',
        tag: `telefono-verificado-${proveedor_id}`,
      })
    }
  }

  return Response.json({ ok: true })
}
```

Mismo molde para `suspender_proveedor` (avisar solo cuando `p_suspendido` es `true` — no
tiene sentido avisar al reactivar una ficha) y `marcar_referencia` (avisar solo cuando
`p_estado === 'confirmada'`, resolviendo `proveedor_id` desde `referencias.proveedor_id`
antes de buscar el `perfil_id`).

Los tres textos de aviso tienen que ser idénticos, palabra por palabra, a los que ya escribe
`mis_avisos()` para estos mismos eventos (migración `v6-h1`):
- `'Verificamos tu teléfono. Tu ficha ya se ve en el directorio.'`
- `'Un administrador suspendió tu ficha.'`
- `'Una persona de la fundación confirmó una de tus referencias.'`

### ⚠ No confundir los dos `avisar()`

`panel-proveedores.tsx:220` y `panel-referencias.tsx:88` ya tienen una función **local**
llamada `avisar()` — es un toast en pantalla para quien administra ("guardado", "error"),
**no** tiene nada que ver con el `avisar()` de `src/server/avisos/push.ts` (push real). Son
cosas distintas con el mismo nombre. El `avisar()` de push se llama **solo en el Route
Handler nuevo**, del lado del servidor — los componentes cliente (`panel-*.tsx`) siguen
usando su `avisar()` local de toast exactamente igual que hoy, sin tocarlo. No renombres el
toast local para "liberar" el nombre: son archivos y capas distintas, no hay colisión real
de identificadores, solo de lectura humana — basta con que quien lo construya no los
confunda al escribir el Route Handler.

### Los componentes cliente cambian de destino, no de forma

En los tres archivos (`panel-servicios.tsx`, `panel-proveedores.tsx`,
`panel-referencias.tsx`), donde hoy hacen `supabase.rpc('verificar_telefono_proveedor', {
... })` (o las otras dos), cambia esa llamada por un `fetch('/api/admin/verificar-telefono',
{ method: 'POST', body: JSON.stringify({...}) })` al Route Handler nuevo. El resto del
componente —estado de carga, manejo de error, el toast local `avisar()`— no cambia de
forma, solo de qué llama.

## 3. Pasos de implementación (Antigravity)

- [ ] **Paso 1:** Route Handler para `verificar_telefono_proveedor`, con `createClient()` de
      sesión, avisando solo cuando `verificado === true`.
- [ ] **Paso 2:** Route Handler para `suspender_proveedor`, avisando solo cuando
      `suspendido === true`.
- [ ] **Paso 3:** Route Handler para `marcar_referencia`, avisando solo cuando `estado ===
      'confirmada'`.
- [ ] **Paso 4:** `panel-servicios.tsx` — las dos ramas del dispatcher en alcance (teléfono,
      suspensión) pasan a llamar los Route Handlers nuevos. Las otras tres ramas
      (`ocultar_resena`, `borrar_resena`, `revisar_solicitud_servicio`) NO se tocan, quedan
      en RPC directo — fuera de alcance de este plan.
- [ ] **Paso 5:** `panel-proveedores.tsx` — mismas dos acciones, del lado del aliado.
- [ ] **Paso 6:** `panel-referencias.tsx` — `marcar_referencia`.

## 4. Criterios de aceptación

- Un admin puede verificar un teléfono, suspender una ficha, y un aliado puede marcar una
  referencia como confirmada — exactamente igual que hoy, mismos permisos, mismo resultado
  visible en pantalla.
- Alguien sin permiso (ni admin ni miembro activo de la organización) sigue recibiendo `No
  autorizado` — la comprobación no se debilitó al moverse.
- Verificar un teléfono, confirmar una referencia o suspender una ficha ahora manda un push
  al prestador dueño de esa ficha, y el evento aparece en su campanita al recargar.
- Reactivar una ficha (`suspendido: false`) o marcar una referencia como `no_contesta` /
  `rechazada` **no** manda push — solo el evento positivo avisa.

## 5. Verificación y puerta de calidad

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] Probar las tres acciones de punta a punta, con una cuenta admin y una de aliado, y
      confirmar que sigue fallando para quien no tiene el permiso.
- [ ] Confirmar que las tres ramas del dispatcher de `panel-servicios.tsx` que quedan fuera
      de alcance (reseñas, solicitudes) siguen funcionando sin cambios.
- [ ] Sin warnings de build.
- [ ] Aprobación del `git diff` por Claude Code.

## 6. Notas y bloqueos

- Si al construir esto encuentras que alguna de las tres funciones de Postgres necesita un
  dato que hoy no devuelve (por ejemplo, para poder avisar sin una consulta extra), no
  cambies la función de Postgres por tu cuenta — repórtalo aquí. Es esquema, y el arquitecto
  lo ejecuta.
- Cuando esto quede aprobado, el arquitecto actualiza la fila "2 · Eliminar el acceso a
  datos desde el navegador" de `AGENTS.md` §"Estado de la migración" — tres archivos menos
  de los ~20 pendientes. No lo edites tú.
