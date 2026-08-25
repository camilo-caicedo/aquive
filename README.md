# AquíVe · Ayuda directa en Colombia

AquíVe es una plataforma gratuita que conecta, en Colombia, a quien
necesita algo con quien puede darlo: insumos que alguien entrega sin
cobrar, servicios de profesionales con matrícula, y el trabajo de gente que
vive de su oficio.

> Esta frase es la misma, palabra por palabra, que la de `src/app/page.tsx`
> y las tres de `src/app/layout.tsx`. Si dos dejan de coincidir, la revisión
> de la marca de Google encuentra dos versiones de qué es esto.

**En vivo:** https://aquive.co

## La idea en tres líneas

Un necesitado publica qué insumos le faltan, sin dar ningún dato personal.
Ofertadores y profesionales con matrícula ven las solicitudes y responden.
El contacto ocurre por fuera de la plataforma, y todo se borra a las 72 horas.

No es una app de mapas. Ya existen varias y funcionan.

## Lo que no es negociable

- Las solicitudes describen **cosas, no personas**
- Borrado real a las 72 horas, sin Point-in-Time Recovery
- Sin dinero, sin alojamiento de personas, sin menores, sin transporte
- Sin rescate ni atención de urgencias: eso es del 123
- El contacto nunca pasa por la plataforma

Estas reglas son la protección jurídica del proyecto, no preferencias de
diseño. Ver `CLAUDE.md` antes de tocar nada.

## Estado

Las seis fases están implementadas y desplegadas. Lo que falta para
lanzar de verdad está en `docs/PENDIENTES-LEGALES.md`.

El backend se está migrando de PL/pgSQL a una capa de dominio en
TypeScript. Ver `docs/decisiones/0001-backend-tipado-en-typescript.md`.

| Flujo | Estado |
|---|---|
| Publicar solicitud sin cuenta (token portador) | Probado en producción |
| Tablero público con filtros | Probado |
| Cruce inverso: "¿quién necesita lo que tengo?" | Probado en el proyecto de pruebas |
| Login con Google, perfiles de ofertador y servidor | Probado en producción |
| Responder una solicitud | Probado |
| Directorio de profesionales con matrícula | Probado |
| Notificaciones push (Web Push + VAPID) | Probado en producción |
| Renovar, cerrar y borrado duro a 72 h | Probado, incluido el job de `pg_cron` |
| Panel de moderación y verificación de matrículas | Probado |
| Borrado permanente de cuenta | Implementado |
| Inventario de quien ofrece, e ítems sugeridos | Probado en el proyecto de pruebas |

Bug abierto: en `/mis-solicitudes` la lista guardada en `localStorage` no
siempre aparece. El enlace directo y el QR sí funcionan.

## Stack

Next.js 16 (App Router, Server Components), TypeScript, Tailwind v4,
shadcn/ui sobre **Base UI**, Supabase (Postgres + Auth + pg_cron),
`web-push` con VAPID, Cloudflare Turnstile, desplegado en Vercel.

Sin librería de mapas, sin geocoding, sin analítica.

## Cómo levantarlo

```bash
npm install
cp .env.local.example .env.local   # y llena los valores
npm run dev
```

En Supabase, en este orden:

1. `supabase/schema.sql` — tablas, RLS, RPC, vistas y el job de expiración
2. `supabase/seed-municipios.sql` — los 1.122 municipios con código DANE
3. `supabase/seed-servicios.sql` — los 36 servicios profesionales
4. `supabase/seed-catalogo.sql` — 145 insumos y los servicios pedibles

El 3 va antes del 4 y no es negociable: `seed-catalogo.sql` deriva los ítems
`serv_*` con un `select` sobre `catalogo_servicios`. Al revés no deriva nada
y te quedas sin la categoría de servicios, sin ningún error visible.

Eso es para levantar un proyecto **desde cero**. Sobre una base que ya
existe van los archivos de `supabase/migraciones/`, en orden de nombre.
`schema.sql` es el espejo de todos ellos y sigue siendo la fuente de verdad:
cada migración se refleja ahí en el mismo commit.

Después: activa Google como proveedor de Auth, pon el dominio en
**Authentication → URL Configuration**, y **confirma que Point-in-Time
Recovery está desactivado** (si está activo, el aviso de privacidad
miente).

Para que `/admin` sea accesible hay que insertar a mano la primera fila
en `administradores` con el id del usuario que va a moderar.

## Mapa del repositorio

| Ruta | Para qué |
|---|---|
| `CLAUDE.md` | Contexto y **reglas duras**. El archivo más importante. |
| `docs/decisiones/` | Por qué el proyecto es como es. Empezar por el LEEME. |
| `docs/PENDIENTES-LEGALES.md` | Bloqueantes que no se resuelven programando. |
| `docs/ESPECIFICACION.md` | Roles, flujos y modelo de datos. |
| `docs/legal/PLANTILLAS.md` | Aviso de privacidad, términos y autorización. |
| `supabase/schema.sql` | Esquema completo. Fuente de verdad de la base. |
| `supabase/seed-*.sql` | Municipios, insumos y servicios. Re-ejecutables. |
| `supabase/migraciones/` | Cambios sobre una base que ya existe, en orden de nombre. |
| `supabase/limpiar-pruebas.sql` | Borra lo marcado como prueba. Cuenta primero, borra después. |
| `migracion/` | Levantar la base en un proyecto nuevo: runbook, configuración y verificación. |
| `src/lib/config.ts` | Responsable, correo y fecha de los legales. Tiene efecto legal. |
| `src/lib/types.ts` | Tipos de la base, escritos a mano. Actualizar junto al esquema. |
| `src/proxy.ts` | Refresca la sesión de Supabase (en Next 16 ya no se llama `middleware`). |

## Decisiones que parecen raras y no lo son

- **Las vistas públicas son `SECURITY DEFINER` a propósito.** El cliente
  tiene revocado el acceso a `solicitudes`; la vista *es* la frontera de
  seguridad y por eso excluye `token_hash`.
- **`es_admin()` no se puede usar dentro de una política RLS.** Tiene
  `EXECUTE` revocado, y la expresión de una política corre con los
  permisos de quien consulta: cualquier lectura fallaría. Las políticas
  hacen el `EXISTS` contra `administradores` a mano.
- **Los filtros de municipio solo listan los que tienen contenido.**
  Mandar los 1.122 en cada carga pesaba más que el resto de la página.
- **Un solo tema claro, sin modo oscuro.** El modo oscuro automático
  rompía el contraste de los controles nativos en gama baja.
- **El desplegable de municipio es `<select>` nativo hasta que hidrata.**
  Se quedó así porque funciona bien y no cuesta nada, no porque haga falta:
  el requisito de funcionar sin JavaScript se quitó en agosto de 2026.
- **Las animaciones son solo CSS.** No por presupuesto de JS, sino porque
  una animación que se traba se lee como una aplicación rota.

## Lo que decide si esto sirve

Conseguir que coordinadores de albergues lo usen. Eso importa más que
cualquier línea de código de este repositorio.
