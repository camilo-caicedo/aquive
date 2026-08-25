# ADR 0001 · Backend tipado en TypeScript sobre Next.js

- **Estado:** aceptada
- **Fecha:** 2026-08-25
- **Decide:** responsable del proyecto
- **Reemplaza:** la regla de `CLAUDE.md` «Toda escritura pasa por funciones RPC
  `security definer` en Postgres»

## Contexto

AquíVe nació como respuesta al sismo del 10 de agosto de 2026 y se construyó
para durar semanas. Esa premisa cambió: una fundación queda a cargo de la
plataforma, el enfoque y el diseño se replantean, y el módulo de Servicios
—pensado de mediano plazo desde el principio— pasa a ser el eje.

El estado actual del código refleja la premisa vieja:

- ~24.000 líneas de SQL entre `schema.sql` y las migraciones.
- ~97 funciones RPC distintas invocadas desde `src/`.
- 28 políticas de RLS.
- `pg_cron` para el vencimiento, `vault` y `pgcrypto` para el cifrado.
- Un `createBrowserClient` que consulta Postgres directamente desde el
  navegador.

No existe backend propio: la lógica de negocio está escrita en PL/pgSQL y se
ejecuta dentro del motor de base de datos. Eso resolvió bien la urgencia
—cero infraestructura que operar, garantías fuertes por construcción— pero
tiene tres costos que ahora sí pesan:

1. **Sin tipos.** El único chequeo entre TypeScript y la lógica de negocio son
   los tipos generados de las firmas RPC. El cuerpo de cada función no lo
   verifica nadie.
2. **Atado al proveedor.** `vault`, `pg_cron` y RLS con `security definer` son
   decisiones que amarran el proyecto a esta base de datos concreta.
3. **Un solo cliente posible.** La lógica es alcanzable únicamente vía el
   cliente de Supabase o Server Actions. Ninguno de los dos sirve desde una
   aplicación React Native.

Hay además un requisito nuevo declarado: se prevé una aplicación móvil en
React Native, y la plataforma va a crecer —subida de imágenes, entre otras
cosas—.

## Decisión

Mover la lógica de negocio de PL/pgSQL a una capa de dominio en TypeScript,
servida desde el mismo proyecto Next.js, expuesta como contrato RPC tipado, y
apoyada en Postgres a través de un ORM con tipos derivados del esquema.

### Piezas

| Responsabilidad | Elección | Reemplaza a |
| --- | --- | --- |
| Servidor | Next.js (el que ya existe), runtime Node | — |
| Contrato de API | oRPC, contract-first | Server Actions y `.rpc()` |
| Acceso a datos | Drizzle ORM sobre `node-postgres` | cliente de Supabase |
| Validación de borde | Zod | validación dispersa |
| Lógica de negocio | `src/server/<dominio>/`, TypeScript puro | ~97 funciones RPC |
| Autenticación | better-auth, con plugin de Expo | Supabase Auth |
| Tareas programadas | Vercel Cron | `pg_cron` |
| Cifrado | `node:crypto`, AES-256-GCM | `vault` + `pgcrypto` |
| Archivos | Vercel Blob, subida directa del cliente | — (no existía) |

### Reglas que nacen con esta decisión

1. **La capa de dominio no importa `next/*`.** Un caso de uso recibe argumentos
   planos y devuelve datos. Quien lee cookies o cabeceras es el borde, y pasa
   el valor hacia adentro. Sin esto, nada es reutilizable desde React Native.
2. **Toda operación nace como procedimiento del contrato.** El front web la
   consume por el cliente tipado, igual que la consumirá la aplicación móvil.
   No se agregan Server Actions como puerta exclusiva de una operación.
3. **Ningún acceso a datos desde el navegador.** `createBrowserClient`
   desaparece y no se reintroduce bajo otro nombre.
4. **Las subidas de archivo van directo del cliente al almacenamiento**, con
   URL firmada. El archivo nunca atraviesa una función del servidor.

## Qué se queda en Postgres, y por qué

La decisión saca **lógica de negocio**, no **garantías de integridad**. La
distinción es deliberada y no es negociable:

Se van: los cuerpos de las funciones RPC, `vault`, `pgcrypto`, `pg_cron`, y
RLS como guardián principal.

Se quedan:

- Los `CHECK` —entre ellos el de tipos de documento, que sostiene la regla O
  (sin datos de menores)—.
- Las llaves foráneas y sus `ON DELETE CASCADE`, que sostienen la regla 4
  (borrado duro).
- Los `UNIQUE`, entre ellos el del código de servicio de un solo uso
  (regla T).
- Los índices.
- El trigger de la regla L: ninguna conversación puede ser bilateral.

Ninguno de esos amarra el proyecto a un proveedor: son SQL estándar y corren
igual en cualquier Postgres. Y son la diferencia entre «el código no debería»
y «la base no lo acepta». El trigger de la regla L se conserva porque protege
a personas en un encuentro físico: en TypeScript dependería de que ningún
camino de código olvide invocarlo; como trigger, no hay camino que lo evite.

## Alternativas consideradas

### Mantener la lógica en PL/pgSQL

Descartada. Es el estado actual, y no cumple el requisito nuevo: una
aplicación React Native no puede alcanzar esas funciones sin construir de
todos modos una capa HTTP intermedia. Si esa capa hay que escribirla igual,
tenerla en TypeScript da tipos verificados y desata el proyecto del
proveedor.

### Un servidor separado (NestJS, Express, Hono)

Descartada por ahora. Con un solo consumidor web y uno móvil que hablan
TypeScript, un despliegue aparte suma dos configuraciones de autenticación,
CORS, un salto de red por render y un segundo pipeline, sin ganancia
correspondiente. Next.js con runtime Node cubre el caso.

Se reconsidera si aparece un consumidor que no hable TypeScript, o trabajos
de larga duración que no encajen en una función. La capa de dominio, al no
importar `next/*`, se puede montar sobre Hono sin reescribirse — que es
precisamente el punto de la regla 1.

### Microservicios

Descartada. El argumento decisivo es la regla 4: el borrado duro hoy es un
`DELETE` en cascada dentro de **una transacción**. Repartido entre servicios
deja de ser una transacción y se vuelve una saga distribuida con
compensaciones; una saga que falla a medias deja vivos datos personales que
la plataforma prometió borrar. Se cambiaría una garantía del motor por código
que hay que mantener correcto para siempre.

La separación que sí se adopta es la de un monolito modular:
`src/server/<dominio>/` con fronteras claras y un solo despliegue. Si algún
módulo necesita escalar aparte en el futuro, ya está aislado.

### GraphQL

Descartada. Resuelve un problema que este proyecto no tiene —muchos clientes
heterogéneos con necesidades de datos divergentes sobre un grafo grande,
mantenidos por equipos distintos— y cobra costos que sí tiene: N+1 por
construcción, necesidad de límites de profundidad y complejidad para no
exponer un vector de denegación de servicio en endpoints públicos sin
autenticar, peor caché al concentrar todo en un POST a un solo endpoint, y
tipos duplicados entre SDL, Drizzle y Zod.

El motivo específico de este proyecto es más fuerte que los genéricos: la
premisa de GraphQL es que el cliente compone los campos que quiera. La regla
11 dice lo contrario —el dato sensible se destapa de uno en uno, con motivo
escrito en ese momento, y cada lectura queda en bitácora—. `leer_referencia`
no es un campo componible: es un acto con autorización y rastro. Se podría
forzar con autorización por campo, pero sería pelear contra el paradigma
justo en la parte del sistema donde menos conviene hacerlo.

Además, GraphQL es una decisión de transporte, no un sustituto de la capa de
dominio: eligiéndolo habría que escribir igual `src/server/<dominio>/`. No
ahorra el trabajo, se lo suma.

### tRPC en lugar de oRPC

Alternativa razonable y más madura; la combinación tRPC con Expo está muy
probada. Se elige oRPC por dos razones propias del caso: el modo
contract-first permite que el paquete del contrato viva solo, sin arrastrar
tipos del servidor al build de React Native; y la especificación OpenAPI sale
sin trabajo extra, lo que importa si algún día se le entrega integración a
una organización aliada. Si oRPC resultara un problema en la práctica, tRPC
es la vuelta atrás, y la capa de dominio no cambia.

### Prisma en lugar de Drizzle

Descartada. Drizzle introspecta el esquema existente con `drizzle-kit pull` y
entrega tipos el primer día; Prisma obligaría a remodelar a mano un esquema
de 24.000 líneas. Drizzle además es SQL-first, lo que hace auditable la
consulta que se ejecuta —relevante en las rutas que tocan datos personales—.

## Qué reglas duras cambian de garante

Esta es la parte de riesgo y hay que mirarla de frente. Hoy varias reglas las
sostiene el motor; después, algunas las sostiene el código.

| Regla | Garante hoy | Garante después | Compensación |
| --- | --- | --- | --- |
| 1 · Cero PII en solicitud | RLS + RPC `security definer` | capa de dominio + `CHECK` | módulo único de acceso a datos; pruebas |
| 4 · Borrado duro | `ON DELETE CASCADE` + `pg_cron` | `ON DELETE CASCADE` + Vercel Cron | la cascada no cambia; solo el disparador |
| K · Identidad cifrada | `vault` | `node:crypto`, llave en variable de entorno | llave fuera del repositorio; rotación documentada |
| L · Nada bilateral | trigger | trigger (se conserva) | ninguna |
| M · Filtro de contacto en chat | función en Postgres | capa de dominio | pruebas sobre los patrones |
| N · Rastro de cada lectura | RPC | capa de dominio | una sola función de lectura por tipo de dato sensible |
| O · Sin datos de menores | `CHECK` | `CHECK` (se conserva) | ninguna |
| P · Documento con pepper | `vault` | variable de entorno / gestor de llaves | nunca en el repositorio |

**El riesgo neto:** hoy un error en TypeScript lo atrapa la base de datos.
Después, en las filas donde el garante cambió, no. La mitigación es
estructural, no de disciplina: un único módulo de acceso a datos por dominio,
sin cliente en el navegador, y pruebas sobre las rutas que tocan
`identidades`, `referencias` y `accesos_*`.

## Consecuencias

### Positivas

- Tipos verificados de extremo a extremo entre base de datos, dominio,
  contrato y cliente.
- La aplicación React Native no necesita backend nuevo: consume el contrato.
- El proyecto deja de depender de extensiones específicas del proveedor. La
  base de datos se puede mudar.
- La lógica de negocio se vuelve revisable con las herramientas normales:
  diff legible, pruebas, análisis estático.

### Negativas

- Migración larga: ~97 RPC. No es de una semana.
- Se pierde RLS como red de seguridad de último recurso.
- Aparecen conexiones a Postgres desde funciones: hay que atender el pooling.
- `CLAUDE.md` queda desalineado y debe actualizarse. Hecho el 2026-08-25, junto
  con el retiro de `PLAN.md`, `PLAN-V2.md` y `PLAN-V3.md`, que describían el
  diseño anterior y ya estaban ejecutados. Sus bloqueantes vigentes quedaron en
  `docs/PENDIENTES-LEGALES.md`.

### Neutras

- Se agrega superficie de API pública. Con React Native, Cloudflare Turnstile
  deja de servir como anti-abuso —es un widget de navegador— y hay que
  sustituirlo por limitación de tasa en la capa de API, más atestación de
  dispositivo si el abuso se vuelve real. No se construye ahora, pero el
  anti-abuso no debe diseñarse asumiendo que Turnstile siempre estará.

## Plan de migración

Patrón strangler, sin reescritura de golpe. Sin cambios de estructura de
carpetas hasta el paso 6.

1. `drizzle-kit pull` sobre el esquema actual. Tipos generados, comportamiento
   idéntico, cero riesgo.
2. Eliminar `createBrowserClient`. Todo el acceso a datos pasa al servidor.
   Cierra la superficie expuesta más grande.
3. Montar oRPC con dos o tres procedimientos de lectura para validar el
   patrón. El front web pasa a consumirlos.
4. Migrar el resto de lecturas, luego las escrituras, empezando por Servicios
   —es el módulo que va a crecer—. El módulo de emergencia se apagará solo: no
   conviene invertir semanas en portarlo.
5. `pg_cron` a Vercel Cron; `vault` a `node:crypto`. Aquí el proyecto queda
   realmente desatado del proveedor.
6. Autenticación a better-auth. Recién aquí, espacios de trabajo de npm:
   `apps/web`, `packages/contrato`, `packages/dominio`, `packages/datos`.
7. La aplicación Expo consume `packages/contrato`. Sin backend nuevo.

Las imágenes entran en paralelo, cuando esté resuelta la pregunta abierta de
abajo. No dependen del resto.

## Pregunta abierta · imágenes y datos personales

La subida de imágenes choca con la regla 1 y necesita decisión escrita antes
de habilitar el primer archivo:

- Una foto de una persona es dato personal, y la regla 1 prohíbe fotos de
  personas en una solicitud sin excepción.
- Una foto de perfil de proveedor en `/servicios` sí encaja —publicación
  consentida— pero necesita casilla explícita y versión de autorización
  guardada, igual que hoy hace `perfiles`.
- Una foto de un trabajo hecho puede llevar personas de fondo, o una fachada,
  que es dirección exacta por otra vía.
- Un texto se filtra con expresiones regulares; una imagen no. O la mira
  alguien, o hay revisión previa antes de publicar.
- El borrado duro tiene que alcanzar el archivo. `ON DELETE CASCADE` no borra
  blobs: eso es código, y se escribe desde el principio, no después.

## Revisión

Se revisa esta decisión si aparece un consumidor de la API que no hable
TypeScript, si surge una necesidad de trabajos de larga duración que no quepa
en una función, o si el volumen deja de ser el de una plataforma operada por
una fundación en Colombia.
