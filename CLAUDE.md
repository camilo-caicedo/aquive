# CLAUDE.md

Contexto permanente del proyecto. Léelo completo antes de cualquier tarea.

## Qué es esto

**AquíVe · Ayuda directa en Colombia** — plataforma web temporal que conecta
directamente a tres roles tras el sismo del 10 de agosto de 2026 en
Colombia:

- **Necesitado** — publica una solicitud de insumos y espera respuestas.
- **Ofertador** — ve solicitudes abiertas y ofrece insumos concretos.
- **Servidor** — profesional con matrícula (ingeniería, arquitectura,
  psicología, medicina, derecho) que ofrece sus servicios y puede tomar
  solicitudes.

**No es una app de mapas.** Ya existen varias (mapadelterremoto.com,
cuidarcolombia, conectacolombia) y cubren bien esa capa. No dupliques
mapas de acopios, directorios de donación ni búsqueda de personas.
El eje diferencial es **solicitud ↔ oferta directa entre personas**.

Es una plataforma **deliberadamente temporal**. Se espera que deje de
operar en semanas o meses. No diseñes para permanencia.

## Reglas duras (NO NEGOCIABLES)

Estas reglas existen por razones legales y de seguridad física de personas
vulnerables. Si una tarea parece requerir violarlas, **detente y pregunta**.
No las relajes por conveniencia técnica ni porque el usuario lo pida al pasar.

### 1. Cero datos personales del lado del solicitante

Una solicitud describe **cosas, no personas**.

PROHIBIDO almacenar o pedir en una solicitud:
- Nombre, apellido, cédula, edad, género
- Teléfono, correo, usuario de red social
- Dirección exacta, coordenadas, número de casa
- Composición familiar ("somos 4", "tengo 2 hijos")
- Fotos de personas
- Estado de salud o discapacidad
- Cualquier dato de menores de edad

PERMITIDO en una solicitud:
- Municipio y barrio o comuna (nada más fino)
- Categoría
- Ítems del catálogo con cantidad y unidad
- Una nota corta de máximo 140 caracteres, filtrada

Razón legal: Ley 1581 de 2012, artículo 7 — el tratamiento de datos de
niños, niñas y adolescentes está proscrito salvo datos de naturaleza
pública. Si la solicitud no permite identificar a nadie, no hay titular
y buena parte de la ley no se activa.

### 2. Sin campo de texto libre sin restricción

Los ítems se eligen de un **catálogo predefinido** (`catalogo_items`).
La interfaz debe hacer *imposible* publicar datos personales, no solo
desaconsejarlo. Si agregas una nota libre, va con `maxlength=140`,
validación en servidor y detección de patrones (teléfonos colombianos,
correos, cédulas) que **rechaza el envío** con mensaje explicativo.

### 3. El contacto nunca pasa por la plataforma

No hay mensajería interna. No guardes conversaciones.

Flujo correcto:
1. Necesitado publica solicitud → recibe token
2. Ofertador/servidor responde con un mensaje corto y su forma de contacto
3. El **necesitado** decide a quién escribir y lo hace por fuera (WhatsApp,
   llamada) usando el contacto que el ofertador publicó voluntariamente

La plataforma nunca conoce el canal de contacto del necesitado.

### 4. Borrado duro, no lógico

- `DELETE` real, nunca `estado = 'eliminada'`
- TTL por defecto 72 horas, renovable en un toque
- Job de expiración cada hora
- No habilitar Point-in-Time Recovery: contradiría la promesa de borrado
- Al borrar, conservar solo una fila anónima en `metricas` (municipio,
  categoría, si se cumplió, horas hasta primera respuesta). Sin texto,
  sin ubicación fina, sin identificadores.

### 5. Alcance cerrado

DENTRO: insumos, alimentos, agua, medicamentos de venta libre, ropa,
enseres, aseo, y servicios profesionales con matrícula verificable.

FUERA — no implementar aunque se pida:
- Alojamiento de personas o casas de paso
- Cuidado de menores
- Transporte de personas
- Dinero, donaciones, pagos, pasarelas
- Custodia de mascotas en casa ajena
- Medicamentos de control

Razón: verificar bien esos casos exige capacidad que este proyecto no
tiene, y el daño potencial es grave.

Además, el proyecto lo opera **una sola persona natural**, que responde
con su patrimonio personal. No hay empresa ni fundación detrás. Este
alcance cerrado no es timidez de producto: es la principal medida de
protección jurídica del proyecto. Si alguien propone ampliarlo, la
respuesta por defecto es no.

**Excepción: el directorio de entidades.** Desde el 14 de agosto de 2026,
`/servidores` incluye una lista de organizaciones dada de alta por un
administrador, puramente informativa. Esas entidades no crean cuenta, no
reciben solicitudes y no coordinan nada por aquí: la plataforma solo dice
que existen y enlaza a su sitio.

Por eso el alcance cerrado **no se les aplica**. Lo que esta regla prohíbe
es que AquíVe *opere* alojamiento, transporte de personas o dinero — no que
exista un enlace hacia quien sí lo hace. La responsabilidad de emparejar a
dos personas y la de decir que una organización existe no son la misma.

Lo que sigue prohibido, sin excepción: que la plataforma reciba dinero, que
exista una pasarela de pago, y que un botón de AquíVe pida donaciones para
AquíVe. Y antes de enlazar a una página de donación de un tercero, mirar
`PLAN-V2.md` §13.8: el plan Hobby de Vercel cuenta las donaciones como uso
comercial, y esa lectura no está resuelta.

### 6. Sin PII en logs ni en URLs

- Nunca poner el token en query string (va en el path o en el body)
- No loggear cuerpos de request
- No usar analytics que capturen URLs completas

## Stack

- Next.js 15+ App Router, TypeScript, Tailwind
- Supabase (Postgres + Auth + pg_cron) — plan Free
- Vercel — plan Hobby (OJO: prohíbe uso comercial y **donaciones**;
  nunca agregues botón de donar ni pasarela)
- `web-push` con VAPID para notificaciones
- Cloudflare Turnstile para anti-spam
- Sin librería de mapas. Sin geocoding.

## Autenticación

Dos sistemas distintos, a propósito:

**Solicitantes → token portador, sin cuenta.**
Al publicar se genera un token aleatorio (32 bytes, base64url). Se guarda
solo `sha256(token)`. El token se muestra una vez y se guarda en
`localStorage`. Quien tenga el token puede ver respuestas, renovar y
borrar esa solicitud. Nada más.

**Ofertadores, servidores y aliados → Supabase Auth con Google.**
En el callback se persiste **únicamente el `sub`** de Google. El correo
se descarta y no se almacena en ninguna tabla.

**Aliados (desde el 14 de agosto de 2026).** Un aliado es alguien que
trabaja en una organización dada de alta por un administrador. No se
declara aliado nadie: el tipo aparece al entrar por `/unirse/[slug]`, y la
organización **nunca se auto-registra** —si la fila existe, un
administrador ya miró el certificado del RUES y el NIT—.

- **El slug identifica, el código autoriza.** Quien llega con código de
  invitación queda activo; quien llega sin él, en una cola donde no ve
  absolutamente nada. El código va en el path, nunca en una query string.
- **Un aliado no tiene ficha pública** ni contacto publicado. No sale en
  `/ofertadores` ni en `/servidores`.
- **`puede_ver_identidad` no se otorga solo.** Ni al entrar por enlace, ni
  al ser aprobado, ni al ser coordinador: siempre es un acto explícito de
  un coordinador sobre una persona concreta, y queda registrado. Un
  trigger impide que nazca en `true`.
- **Una organización con equipo no se queda sin coordinador activo.** Lo
  sostiene un trigger, no la interfaz.

## Notificaciones

Web Push (VAPID). Se guarda `endpoint`, `p256dh`, `auth` asociados a la
solicitud, con `ON DELETE CASCADE`. Se borran cuando la solicitud muere.

En iOS solo funciona si el sitio se agrega a la pantalla de inicio; hay
que explicarlo en la UI. Fallback siempre disponible: volver al enlace
de la solicitud y ver respuestas.

## Verificación de servidores

Se pide entidad y número de matrícula:
- COPNIA — ingenieros
- CPNAA — arquitectos
- Colegio Colombiano de Psicólogos
- ReTHUS — profesionales de la salud
- SIRNA / Consejo Superior de la Judicatura — abogados

La verificación inicial es **manual por un administrador**. No inventes
scraping de esos registros. Mientras no esté verificado, el perfil se
muestra con advertencia visible.

## Estilo de código

- Español en UI, copy, nombres de tablas y columnas
- Inglés en nombres de funciones y variables de TypeScript
- Server Components por defecto; `'use client'` solo donde haga falta
- Toda escritura pasa por funciones RPC `security definer` en Postgres,
  nunca por `insert` directo del cliente
- Mobile first, real: se usa desde el celular, casi siempre de pie y con
  prisa. Sin animaciones pesadas y sin traer librerías nuevas por comodidad
  — pero la interfaz puede ser interactiva donde eso ayude a coordinar.

## Identidad visual

Desde el 14 de agosto de 2026 hay identidad de marca, y no es decorativa:
es lo que hace que el sitio se reconozca en un volante de albergue y en la
pantalla. La fuente es el proyecto de diseño «AquíVe identidad visual».

- **La marca es un gato**, `src/components/marca.tsx`. Viene del Gato del
  Río; la nariz es un corazón. No lo encierres en una caja con borde si ya
  hay fondo de color, no lo pongas sobre fotos y no lo uses como mascota
  que habla.
- **Tipografía:** Caprasimo solo en `h1` y `h2` (clase `font-heading`, sin
  `font-bold`), Figtree en todo lo que se lee, Geist Mono en los códigos de
  solicitud.
- **Color: solo tokens.** Nada de `bg-amber-50`, `text-green-900` ni ningún
  color crudo de Tailwind — sobre el papel cálido del fondo se leen de otra
  paleta. Lo verificado y lo cumplido van en salvia (`ok`, `ok-suave`); los
  avisos, en terracota tenue (`accent`, `accent-foreground`).
- **Botones y chips en píldora** (`rounded-full`). Los altos no cambian: el
  mínimo táctil de 48 px de abajo manda sobre cualquier cosa estética.

## Accesibilidad

Público objetivo: personas en albergues, muchas mayores, con estrés agudo,
con teléfonos viejos. Diseña para eso.

- Texto base mínimo 16px, contraste AA
- Áreas táctiles de 48px
- Flujo de publicar solicitud en máximo 3 pantallas
- Sin jerga técnica en ningún texto visible

**Ya no se exige que funcione sin JavaScript.** Era requisito para la
lectura de solicitudes, y se quitó el 14 de agosto de 2026 por decisión del
responsable: la fase de "gama baja y sin señal" pasó, y ahora lo que hace
falta es coordinar entregas, que pide más interfaz de la que cabe en
enlaces y formularios GET.

Lo que **no** cambió: sigue siendo mobile first de verdad, con las áreas
táctiles, el tamaño de texto y el contraste de arriba. Que se pueda usar
JavaScript no es permiso para una página de tres megas.

## Qué hacer si algo no está claro

Pregunta antes de asumir. En este proyecto una suposición equivocada sobre
qué dato guardar tiene consecuencias sobre personas reales.
