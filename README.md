# AquíVe · Ayuda directa en Colombia

Una red de vecinos donde quien necesita un servicio encuentra a quien lo
ofrece, sin intermediarios. Sin comisiones, sin intermediar el pago.

> Esta frase es la misma, palabra por palabra, que la de
> `src/components/bienvenida.tsx` —que es lo que se sirve en `/`, y por tanto
> lo que ve el revisor de Google— y las tres de `src/app/layout.tsx`. Si dos
> dejan de coincidir, la revisión de la marca encuentra dos versiones de qué
> es esto y vuelve a caer.

**En vivo:** https://aquive.co

## La idea en tres líneas

Quien vive de su trabajo publica su ficha: sus oficios, sus precios, su zona
y sus horarios. Quien necesita algo busca cerca, pide, acuerda por el chat de
aquí dentro y califica con un código que le entregan al terminar.

La plataforma no mueve dinero y no coordina la entrega. Conecta, y se aparta.

## Los cuatro módulos

| Módulo | Qué es |
|---|---|
| **Servicios** | El directorio de prestadores y el tablero de quién está pidiendo |
| **Comunidad** | El muro —lo que sobra y lo que falta— y «Hecho en el barrio», los productos |
| **Centros de acopio** | Lugares físicos donde se deja y se recoge, y que registran lo que entra y lo que sale |
| **Moderación** | Colas de trabajo, verificación de matrículas, revisión de imágenes y PQR |

## Lo que no es negociable

- **Datos de menores: ninguno.** No se piden, no se guardan, no se publican
- **Autorización previa** con su versión y su fecha para publicar el nombre,
  el teléfono o la foto de alguien
- **Habeas data**: consulta en 10 días hábiles, reclamo y supresión en 15, por
  `/pqr`, que es la única puerta que funciona sin cuenta
- **Borrado real**, `DELETE`, con las imágenes del almacén. Sin Point-in-Time
  Recovery, porque contradiría esa promesa
- Sin dinero, sin alojamiento de personas, sin transporte de menores
- Sin rescate ni atención de urgencias: eso es del 123

Estas reglas son la protección jurídica del proyecto, no preferencias de
diseño. **Ver `CLAUDE.md` antes de tocar nada.**

## Estado

En reescritura desde agosto de 2026: identidad, flujo y arquitectura nuevos
sobre las bases anteriores. El módulo de emergencia se retiró en agosto (ADR
0014) sin haberse usado nunca en producción. Lo que manda es `CLAUDE.md`, y detrás de él los
ADR de `docs/decisiones/`.

El backend se está migrando de PL/pgSQL a una capa de dominio en TypeScript
con contrato de oRPC (ADR 0001). Quedan unos veinte archivos llamando a RPC
desde el navegador, casi todos en `/admin` y `/aliado`.

Lo que falta para lanzar de verdad —y que no se resuelve programando— está en
`docs/PENDIENTES-LEGALES.md`. Lo primero de esa lista: el registro en el RNBD
a nombre de la Fundación Nodo Social, antes de operar con datos reales.

## Stack

Next.js 16 (App Router, Server Components), TypeScript, Tailwind v4,
shadcn/ui sobre **Base UI**, oRPC + Drizzle sobre Postgres (Supabase),
`sharp` para las imágenes, `web-push` con VAPID, Cloudflare Turnstile,
desplegado en Vercel.

Sin librería de mapas más allá de Leaflet, sin geocoding, sin analítica.

## Cómo levantarlo

```bash
npm install
cp .env.local.example .env.local   # y llena los valores
npm run dev
```

La base se levanta con los archivos de `supabase/migraciones/`, **en orden de
nombre**, y después las semillas:

1. `supabase/seed-municipios.sql` — los 1.122 municipios con código DANE
2. `supabase/seed-servicios.sql` — los servicios profesionales
3. `supabase/seed-catalogo.sql` — el vocabulario del acopio y los servicios pedibles

El 2 va antes del 3 y no es negociable: `seed-catalogo.sql` deriva los ítems
`serv_*` con un `select` sobre `catalogo_servicios`. Al revés no deriva nada
y te quedas sin la categoría de servicios, sin ningún error visible.

> **No hay un `schema.sql`.** Lo hubo, y se retiró: era un volcado que había
> que acordarse de regenerar en cada commit, y cuando dejó de regenerarse
> pasó a describir una aplicación que ya no existía. La verdad de la base es
> la base; su reflejo en tipos es `src/db/generado/schema.ts`, que produce
> `npm run db:pull` y que `npm run db:verificar` contrasta contra el catálogo
> real.

Después: activa Google como proveedor de Auth, pon el dominio en
**Authentication → URL Configuration**, y **confirma que Point-in-Time
Recovery está desactivado** (si está activo, el aviso de privacidad miente).

Para que `/admin` sea accesible hay que insertar a mano la primera fila en
`administradores` con el id del usuario que va a moderar.

## Mapa del repositorio

| Ruta | Para qué |
|---|---|
| `CLAUDE.md` | Contexto y **reglas duras**. El archivo más importante. |
| `docs/decisiones/` | Por qué el proyecto es como es. Empezar por el LEEME. |
| `docs/PENDIENTES-LEGALES.md` | Bloqueantes que no se resuelven programando. |
| `docs/legal/PLANTILLAS.md` | Aviso de privacidad, términos y autorización. |
| `src/contrato/` | El contrato de oRPC. La frontera: no importa `next/*`. |
| `src/server/<dominio>/` | La lógica de negocio, en TypeScript puro. |
| `src/db/generado/` | Los tipos de Drizzle. **Generados, no se editan a mano.** |
| `supabase/migraciones/` | Los cambios de la base, en orden de nombre. |
| `supabase/seed-*.sql` | Municipios, catálogo de acopio, oficios y servicios. Re-ejecutables. |
| `supabase/limpiar-pruebas.sql` | Borra lo marcado como prueba. Cuenta primero, borra después. |
| `scripts/sembrar-fotos.mjs` | Fotos para los datos de prueba. `--limpiar` las deshace. |
| `migracion/` | Levantar la base en un proyecto nuevo: runbook y verificación. |
| `src/lib/config.ts` | Responsable, correo y fecha de los legales. Tiene efecto legal. |
| `src/proxy.ts` | Refresca la sesión de Supabase (en Next 16 ya no se llama `middleware`). |

## Decisiones que parecen raras y no lo son

- **Las vistas públicas son la frontera de seguridad.** El cliente tiene
  revocado el acceso a las tablas; el filtro —`acepto_publicacion`,
  `acepto_mapa`, `acepto_foto`, el riesgo del oficio— vive en la vista y en
  ningún otro sitio. Duplicarlo es cómo un día una copia se olvida.
- **`es_admin()` no se puede usar dentro de una política RLS.** Tiene
  `EXECUTE` revocado, y la expresión de una política corre con los permisos
  de quien consulta: cualquier lectura fallaría. Las políticas hacen el
  `EXISTS` contra `administradores` a mano.
- **Los filtros de municipio solo listan los que tienen contenido.** Mandar
  los 1.122 en cada carga pesaba más que el resto de la página.
- **Un solo tema claro, sin modo oscuro.** El modo oscuro automático rompía
  el contraste de los controles nativos en gama baja.
- **Las animaciones son solo CSS.** No por presupuesto de JS, sino porque una
  animación que se traba se lee como una aplicación rota.
- **Sin esqueleto de carga.** ADR 0005: impedía hidratar.

## Lo que decide si esto sirve

Conseguir que la gente del rebusque lo use. Eso importa más que cualquier
línea de código de este repositorio.
