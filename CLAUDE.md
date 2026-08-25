# CLAUDE.md

Contexto permanente del proyecto. Léelo completo antes de cualquier tarea.

## Cómo leer este archivo

El proyecto entra en una etapa de cambios grandes: una fundación queda a cargo,
el backend se reescribe (ver `docs/decisiones/0001-backend-tipado-en-typescript.md`)
y los flujos y el diseño se replantean. Por eso este archivo está partido en dos
clases de contenido, y **tratarlas igual es un error**:

**Núcleo invariante.** Las reglas duras, el alcance cerrado y la accesibilidad.
Existen por razones legales y de seguridad física de personas vulnerables. No
cambian porque cambie el diseño, ni porque un flujo nuevo sea más cómodo sin
ellas. Se modifican solo por decisión escrita del responsable, y esa decisión
queda como ADR en `docs/decisiones/`.

**Estado actual.** Arquitectura, módulos, autenticación, identidad visual,
sistema de diseño. Describe cómo está construido hoy. **Va a cambiar mucho en
los próximos meses.** Si el código y esta sección discrepan, gana el código —
y actualizar esta sección es parte de la tarea que causó la discrepancia, no
un pendiente para después.

Cada sección dice a cuál de las dos pertenece.

### Dónde se escriben las decisiones

Las decisiones de arquitectura y de producto que cambien algo de este archivo
van a `docs/decisiones/NNNN-titulo.md` antes de escribirse en código. Un ADR
dice: contexto, decisión, alternativas descartadas con su razón, qué reglas
duras cambian de garante, y consecuencias. Si una tarea te obliga a contradecir
este archivo y no hay ADR que lo respalde, **detente y pregunta**.

### Regla de oro del rediseño

Un flujo nuevo o una pantalla nueva **no relaja el núcleo invariante**. Si el
diseño propuesto necesita pedir un dato que la regla 1 prohíbe, o dejar a dos
desconocidos coordinando sin tercero, o abrir una categoría del alcance
cerrado, la respuesta por defecto es no y la conversación sube al responsable.

Cuando propongas un flujo nuevo, declara explícitamente qué reglas duras toca
y quién las sostiene en tu diseño. Un flujo que no menciona ninguna casi
siempre es un flujo que no las miró.

---

# Núcleo invariante

## Qué es esto

**AquíVe · Ayuda directa en Colombia** — plataforma web que conecta
directamente a personas en Colombia. Nació tras el sismo del 10 de agosto de
2026 y hoy la opera la **Fundación Nodo Social**.

**No es una app de mapas.** Ya existen varias (mapadelterremoto.com,
cuidarcolombia, conectacolombia) y cubren bien esa capa. No dupliques mapas de
acopios, directorios de donación ni búsqueda de personas. El eje diferencial es
**el trato directo entre personas**.

## Reglas duras (NO NEGOCIABLES)

Estas reglas existen por razones legales y de seguridad física de personas
vulnerables. Si una tarea parece requerir violarlas, **detente y pregunta**.
No las relajes por conveniencia técnica ni porque el usuario lo pida al pasar.

Cada regla dice **quién la sostiene**. Ese dato importa: mientras dure la
migración del backend, algunas pasan de estar garantizadas por el motor de base
de datos a estarlo por la capa de dominio en TypeScript. Una regla cuyo garante
cambió sin que nadie escribiera su reemplazo es una regla rota.

### 1. Cero datos personales del lado del solicitante

Una solicitud describe **cosas, no personas**.

PROHIBIDO almacenar o pedir en una solicitud:
- Nombre, apellido, cédula, edad, género
- Teléfono, correo, usuario de red social
- Dirección exacta, coordenadas, número de casa
- Composición familiar («somos 4», «tengo 2 hijos»)
- Fotos de personas
- Estado de salud o discapacidad
- Cualquier dato de menores de edad

PERMITIDO en una solicitud:
- Municipio y barrio o comuna (nada más fino)
- Categoría
- Ítems del catálogo con cantidad y unidad
- Una nota corta de máximo 140 caracteres, filtrada

Razón legal: Ley 1581 de 2012, artículo 7 — el tratamiento de datos de niños,
niñas y adolescentes está proscrito salvo datos de naturaleza pública. Si la
solicitud no permite identificar a nadie, no hay titular y buena parte de la
ley no se activa.

**Esta regla no tiene excepciones en la solicitud.** Ni una. Lo de arriba sigue
prohibido en `solicitudes`, en `solicitud_items` y en la nota, sin importar qué
flujo se elija, y sin importar qué flujo nuevo se invente.

> **Garante:** hoy RLS y RPC `security definer`. Después de la migración, la
> capa de dominio más los `CHECK` del esquema. La compensación es un módulo
> único de acceso a datos por dominio, sin cliente en el navegador, con
> pruebas.

Lo que sí existe es una tabla aparte: `identidades`. Guarda nombre, documento y
teléfono **cifrados**, para el acompañamiento de una organización aliada, y es
otra cosa que un campo en la solicitud:

- **Se pide, no se recoge.** Publicar directo no la toca. Elegir acompañamiento
  es un acto explícito, con su texto de autorización, y nunca puede ser el
  camino de menor resistencia (regla R).
- **Vive aislada.** Ninguna vista pública la toca.
- **Muere con lo que acompaña.** La de quien pide cuelga de su solicitud y se va
  con ella; la de quien ofrece cuelga de su perfil y se va con su cuenta.
- **Sin datos de menores, por `CHECK`.** Solo CC, CE, PEP y PPT. TI y RC no
  aparecen ni en la base ni en un desplegable.
- **Cada lectura deja rastro** en `accesos_identidad`, y ese rastro sobrevive a
  la identidad. Sin PII.

**Nada de eso puede desplegarse** hasta que estén los papeles: contrato de
transmisión de datos con la fundación, registro en el RNBD, canal de habeas
data y texto de autorización revisado.

Y la forma de la interfaz también es regla, no gusto (regla R): el botón grande
es publicar directo, el acompañamiento se anuncia una vez y se acepta después,
nunca viene preseleccionado, y la opción anónima no se pinta como la mala.

**En Servicios esta regla no se relaja: cambia de sujeto.** Habla de quien pide,
y quien pide un servicio sigue sin dejar rastro —oficio, municipio, zona,
urgencia, capacidad de pago y una nota de 140 filtrada, nada más—. Lo que
publica el proveedor es otra cosa: publicación consentida y con finalidad
declarada, con casilla explícita, versión de autorización guardada y borrado a
un toque.

Y la persona que sirve de **referencia** de un proveedor no está aquí, no aceptó
nada y puede que ni sepa que existimos: su nombre y su teléfono van cifrados,
nunca aparecen en una vista pública y cada lectura deja rastro (regla U).

### 2. Sin campo de texto libre sin restricción

Los ítems se eligen de un **catálogo predefinido** (`catalogo_items`). La
interfaz debe hacer *imposible* publicar datos personales, no solo
desaconsejarlo. Toda nota libre va con `maxlength=140`, validación en servidor y
detección de patrones (teléfonos colombianos, correos, cédulas) que **rechaza el
envío** con mensaje explicativo.

En Servicios los oficios salen de `catalogo_oficios` y los campos libres son
exactamente cuatro, todos con tope y filtro de PII: la descripción del proveedor
(300), el comentario de reseña (140), la réplica del proveedor (140) y la nota
de solicitud (140). **El precio no es campo libre**: es modo (`gratis`,
`aporte`, `solidario`, `normal`) más un valor «desde» numérico y una unidad de
lista. Un campo libre en un perfil público es por donde se cuela el segundo
teléfono.

**Cualquier campo de texto libre que agregue un flujo nuevo hereda esta regla
completa**: tope de caracteres, validación en servidor, filtro de PII. No hay
campo libre sin las tres.

> **Garante:** validación en la capa de dominio. Nunca solo en el cliente — el
> cliente móvil no es de confianza y el navegador tampoco.

### 3. El contacto nunca pasa por la plataforma

**En el flujo directo**, que es el de siempre y el que se ofrece primero: no hay
mensajería interna y no se guardan conversaciones.

1. Quien necesita publica y recibe un token.
2. Quien ofrece responde con un mensaje corto y su forma de contacto.
3. **Quien necesita** decide a quién escribir, y lo hace por fuera (WhatsApp,
   llamada), usando el contacto que la otra parte publicó voluntariamente.

La plataforma nunca conoce el canal de contacto de quien pide.

**En Servicios el contacto también queda fuera, por la misma puerta al revés.**
No hay mensajería interna. El teléfono del proveedor está en su ficha porque él
lo puso ahí, con casilla explícita. La plataforma nunca conoce el canal de quien
pide.

**En el flujo acompañado ocurre al revés, y a propósito.** Cuando una fundación
aliada coordina la entrega, la conversación pasa por aquí —los tres a la vez— y
el intercambio de teléfonos se **bloquea** (regla M). No es una excepción: es la
misma idea por el otro camino. Si dos desconocidos se van a encontrar, o no
sabemos nada del encuentro, o hay un tercero responsable delante. Lo que no
puede existir es el punto medio: recolectar datos y además dejarlos solos.

Y ese hilo **no es un archivo**: muere con la solicitud, y se le dice a los tres
en pantalla.

> **Garante:** el trigger de la regla L se conserva en Postgres precisamente
> porque esta regla protege a personas en un encuentro físico. El filtro de
> contacto (regla M) pasa a la capa de dominio, con pruebas sobre los patrones.

### 4. Borrado duro, no lógico

- `DELETE` real, nunca `estado = 'eliminada'`
- TTL con renovación en un toque
- Job de expiración periódico

**En Servicios hay dos relojes y los dos terminan en `DELETE` real.** La
solicitud de servicio vive 15 días renovables —conseguir una modista no es
conseguir agua— y el perfil del proveedor es permanente: se borra cuando su
dueño lo pide o cuando un admin lo suspende y lo elimina. Un código de servicio
sin usar muere a los 30 días. `resenas.oculta` no es borrado lógico: es
moderación reversible sobre algo que no es dato personal de quien lo escribió, y
un reporte por extorsión termina en borrado de verdad.

- No habilitar Point-in-Time Recovery: contradiría la promesa de borrado.
- Al borrar, conservar solo una fila anónima en `metricas`. Sin texto, sin
  ubicación fina, sin identificadores.

**El acompañamiento no alarga el TTL, solo lo aplaza mientras haya algo vivo.**
Una solicitud con conversación abierta se auto-renueva, con **techo duro de 5
días** desde que se publicó. Al llegar al techo se cierran los hilos y se borra
igual. La promesa es que esto se borra, no que se borra pronto — pero se borra.

**Tres cosas sobreviven al borrado, y ninguna tiene datos personales:**
`metricas`, `entregas` y `accesos_identidad`, que dice quién leyó una identidad,
cuándo y con qué motivo, nunca qué leyó. Por eso `entregas` no tiene llave
foránea hacia la solicitud y `accesos_identidad` va en `SET NULL` con copia en
texto: si colgaran de lo que registran, se irían con ello.

**Todo archivo subido está sujeto a esta regla.** `ON DELETE CASCADE` no borra
blobs: borrar el archivo del almacenamiento es código, y se escribe junto con la
subida, no después.

> **Garante:** las llaves foráneas con `ON DELETE CASCADE` se conservan en el
> esquema — no cambian con la migración. Lo que cambia es el disparador del
> vencimiento: de `pg_cron` a un cron externo. El borrado de blobs es código
> desde el primer día.

### 5. Alcance cerrado

DENTRO: insumos, alimentos, agua, medicamentos de venta libre, ropa, enseres,
aseo, y servicios profesionales con matrícula verificable.

FUERA — no implementar aunque se pida:
- Alojamiento de personas o casas de paso
- Cuidado de menores
- Dinero, donaciones, pagos, pasarelas
- Medicamentos de control

Razón: verificar bien esos casos exige capacidad que este proyecto no tiene, y
el daño potencial es grave. Si alguien propone ampliarlo, la respuesta por
defecto es no.

**Ampliación acotada, solo dentro de `/servicios`.** Decisión escrita del
responsable, agosto de 2026. Ahí entran además: transporte de personas, trasteos
y acarreos, cuidado de personas, y cuidado de mascotas. **Fuera de `/servicios`
esos cuatro siguen prohibidos.**

La ampliación viene con su contrapeso en los datos, no en la buena intención:
`catalogo_oficios.riesgo` marca como `alto` el cuidado de niños, el cuidado de
personas dependientes y el transporte de pasajeros, y la vista pública
**esconde** esos oficios de todo proveedor que no tenga teléfono verificado y al
menos una referencia confirmada (regla S). Si alguien propone quitarla para
tener más perfiles visibles, la respuesta es no.

Los oficios de riesgo excluidos —reconstrucción estructural, salud, gas,
instalaciones eléctricas, asesoría jurídica— no entran en `catalogo_oficios`,
porque ya existen en `catalogo_servicios` con matrícula verificable. Esa es su
vía.

**Excepción: el directorio de entidades.** `/servidores` incluye una lista de
organizaciones dada de alta por un administrador, puramente informativa. No
crean cuenta, no reciben solicitudes y no coordinan nada por aquí: la plataforma
solo dice que existen y enlaza a su sitio. El alcance cerrado no se les aplica —
lo que la regla prohíbe es que AquíVe *opere* alojamiento, transporte o dinero,
no que exista un enlace hacia quien sí lo hace.

**Lo que sigue prohibido sin excepción ni fecha de revisión:** que la plataforma
reciba dinero, que exista una pasarela de pago, y que un botón de AquíVe pida
donaciones para AquíVe. Antes de enlazar a una página de donación de un tercero,
revisar la restricción de uso comercial del plan de hosting.

**Sobre el reparto de responsabilidad:** en el flujo acompañado los datos
personales de quien pide los trata la fundación aliada — ella es la
**responsable** del tratamiento y AquíVe es **encargada**. Ese reparto no reduce
el alcance cerrado ni una línea. Lo que cambia es quién responde por los datos,
y eso exige papel firmado antes de dar de alta a la primera organización real.

### 6. Sin PII en logs ni en URLs

- Nunca poner un token en query string: va en el path, en el body o en una
  cabecera `Authorization`
- No loggear cuerpos de request
- No usar analytics que capturen URLs completas
- Los cuatro últimos del documento no van en una pantalla pública, ni en un QR,
  ni en una URL. El código de entrega que se escanea en el acopio es el
  identificador de la conversación, opaco por construcción
- **El código de confirmación de servicio no va en ninguna URL.** Se escribe a
  mano en la pantalla de confirmar. No hay enlace, no hay QR y no hay path que
  lo lleve: quien lo tiene lo recibió del proveedor en papel o por WhatsApp, y
  esa es toda la cadena

> **Garante:** revisión en código. Al agregar una API pública consumida por una
> app móvil, esta regla cubre también las cabeceras y las trazas del cliente.

### Reglas del módulo de Servicios

- **S · El riesgo del oficio manda sobre la visibilidad.** Cuidado de niños,
  cuidado de personas dependientes y transporte de pasajeros nacen en
  `riesgo = 'alto'` y no aparecen en el directorio si el proveedor no tiene
  teléfono verificado **y** una referencia confirmada. Lo sostiene la consulta
  del servidor, no la interfaz.
- **T · La reputación se gana con un servicio, no con una opinión.** Solo reseña
  quien tiene el código que el proveedor generó y entregó. Un código sirve una
  vez y lo garantiza un `unique`. La ficha muestra en grande cuántos servicios
  confirmados hay y en pequeño el promedio: una sola reseña mala no puede hundir
  a alguien que vive de esto.
- **U · Una referencia es PII de un tercero que no está aquí.** Cifrada, nunca
  pública, con autorización guardada y con rastro de cada lectura en
  `accesos_referencia`, que sobrevive a la referencia. Si eso no se puede
  cumplir, no hay referencias.
- **V · El teléfono lo verifica una persona, y nada nace verificado.** No hay OTP
  ni proveedor de SMS. Un miembro de la fundación llama y marca, igual que se
  verifica una matrícula.

### Reglas del flujo acompañado

- **K · La identidad vive cifrada, aislada y con fecha de muerte.**
- **L · Ninguna conversación puede ser bilateral.** Un hilo sin aliado a cargo no
  acepta mensajes. Lo sostiene un trigger, no la interfaz.
- **M · El chat filtra datos de contacto.** Más estricto que el filtro de la
  nota: cubre `wa.me`, `t.me`, arrobas sueltas y dígitos escritos con letras. Sin
  esto la regla L es decorativa.
- **N · Cada lectura de identidad deja rastro**, y ese rastro sobrevive a la
  identidad.
- **O · Sin datos de menores.** Solo CC, CE, PEP y PPT, por `CHECK`.
- **P · El documento se hashea con pepper de un gestor de secretos**, nunca del
  repositorio.
- **Q · La plataforma no es el archivo de la fundación.** La planilla con nombres
  se exporta en el momento de la entrega y la custodia ella.
- **R · Elegir el flujo acompañado nunca puede ser el camino de menor
  resistencia.**

## Accesibilidad

Invariante. Público objetivo: personas en albergues, muchas mayores, con estrés
agudo, con teléfonos viejos. Diseña para eso, y esto no se negocia en un
rediseño:

- Texto base mínimo 16 px, contraste AA
- Áreas táctiles de 48 px, con 8 px de separación mínima
- El estado nunca depende solo del color: sello, texto o icono además
- Foco visible
- Sin jerga técnica en ningún texto visible
- Mobile first de verdad: se usa desde el celular, casi siempre de pie y con
  prisa

No se exige que funcione sin JavaScript. Eso se quitó el 14 de agosto de 2026:
la fase de «gama baja y sin señal» pasó, y coordinar entregas pide más interfaz
de la que cabe en enlaces y formularios GET. Que se pueda usar JavaScript no es
permiso para una página de tres megas.

## Qué hacer si algo no está claro

Pregunta antes de asumir. En este proyecto una suposición equivocada sobre qué
dato guardar tiene consecuencias sobre personas reales.

---

# Estado actual

Todo lo que sigue describe cómo está construido hoy y **está sujeto a cambio**.
Manténlo al día: si tu tarea lo contradice, actualízalo en el mismo cambio.

## Arquitectura

Decidida en `docs/decisiones/0001-backend-tipado-en-typescript.md`. **La
migración está en curso**, así que vas a encontrar código de los dos lados.

### Objetivo

| Responsabilidad | Elección |
| --- | --- |
| Servidor | Next.js App Router, runtime Node |
| Contrato de API | oRPC, contract-first |
| Acceso a datos | Drizzle ORM sobre `node-postgres` |
| Validación de borde | Zod |
| Lógica de negocio | `src/server/<dominio>/`, TypeScript puro |
| Autenticación | better-auth, con plugin de Expo |
| Tareas programadas | cron externo hacia un Route Handler |
| Cifrado | `node:crypto`, AES-256-GCM |
| Archivos | almacenamiento de blobs, subida directa del cliente |
| Móvil (previsto) | Expo / React Native consumiendo el mismo contrato |

### Reglas de arquitectura

1. **La capa de dominio no importa `next/*`.** Un caso de uso recibe argumentos
   planos y devuelve datos. Quien lee cookies o cabeceras es el borde, y pasa el
   valor hacia adentro. Sin esto, nada es reutilizable desde React Native.
2. **Toda operación nace como procedimiento del contrato.** El front web la
   consume por el cliente tipado, igual que la consumirá la app móvil. No
   agregues una Server Action como puerta exclusiva de una operación.
3. **Ningún acceso a datos desde el navegador.** `createBrowserClient`
   desaparece y no se reintroduce bajo otro nombre.
4. **Las subidas de archivo van directo del cliente al almacenamiento**, con URL
   firmada. El archivo nunca atraviesa una función del servidor.

### Qué se queda en Postgres

La migración saca **lógica de negocio**, no **garantías de integridad**:

Se van: los cuerpos de las funciones RPC, el cifrado en el motor, el cron en el
motor, y RLS como guardián principal.

Se quedan: los `CHECK` (entre ellos el de tipos de documento, regla O), las
llaves foráneas con `ON DELETE CASCADE` (regla 4), los `UNIQUE` (entre ellos el
del código de servicio de un solo uso, regla T), los índices, y el trigger de la
regla L.

Ninguno de esos amarra el proyecto a un proveedor concreto: son SQL estándar. Y
son la diferencia entre «el código no debería» y «la base no lo acepta».

### Estado de la migración

Actualiza esta tabla al avanzar. Es la referencia rápida de qué lado toca cada
tarea.

| Paso | Estado |
| --- | --- |
| 1 · Tipos de Drizzle desde el esquema existente | pendiente |
| 2 · Eliminar el acceso a datos desde el navegador | pendiente |
| 3 · Contrato oRPC con las primeras lecturas | pendiente |
| 4 · Migrar lecturas, luego escrituras (Servicios primero) | pendiente |
| 5 · Cron y cifrado fuera del motor | pendiente |
| 6 · Autenticación a better-auth; espacios de trabajo de npm | pendiente |
| 7 · App Expo sobre el contrato | pendiente |

El módulo de emergencia se va a apagar solo. No inviertas semanas en portarlo:
prioriza Servicios, que es el que va a crecer.

## Módulos

**Emergencia** (`/publicar`, `/ofertadores`, `/servidores`). Deliberadamente
temporal, nacido del sismo del 10 de agosto de 2026. Tres roles: quien necesita
publica una solicitud de insumos; quien ofrece responde con insumos concretos; y
un servidor con matrícula verificable ofrece servicios profesionales y puede
tomar solicitudes. **No diseñes para permanencia.**

**Servicios** (`/servicios`). El directorio del rebusque, para la reactivación
económica. Un proveedor publica su nombre, su teléfono y sus oficios de forma
permanente; quien necesita un servicio lo busca o publica lo que le hace falta.
Nació de mediano plazo, porque un directorio que se vacía solo no es un
directorio. Esa diferencia es la razón de que sean dos módulos y no uno con
opciones.

Responsable del tratamiento de los datos: **Fundación Nodo Social**. AquíVe es
encargada.

Los planes que dirigieron la construcción de estos dos módulos (`PLAN.md`,
`PLAN-V2.md`, `PLAN-V3.md`) se retiraron del repositorio el 25 de agosto de
2026: estaban ejecutados y describían un diseño anterior al cambio de
arquitectura. Su contenido sigue en la historia de git. Lo que de ellos seguía
vigente se repartió así:

- Las reglas duras, a este archivo, completas y sin depender de un plan.
- Los bloqueantes legales y de configuración, a `docs/PENDIENTES-LEGALES.md`.
- Las decisiones de arquitectura, a `docs/decisiones/`.

**No hay plan vigente.** El siguiente lo escribe el responsable. Mientras tanto,
la fuente de verdad de qué construir son este archivo y los ADR.

## Autenticación

**Quien pide → token portador, sin cuenta.** Al publicar se genera un token
aleatorio (32 bytes, base64url). Se guarda solo `sha256(token)`. El token se
muestra una vez y se guarda en el dispositivo. Quien tenga el token puede ver
respuestas, renovar y borrar esa solicitud. Nada más. Este mecanismo ya es
compatible con una app móvil: es un Bearer token.

**Ofertadores, servidores y aliados → proveedor de identidad.** Se persiste
**únicamente el identificador opaco del proveedor**. El correo se descarta y no
se almacena en ninguna tabla.

> En migración: hoy es Supabase Auth con Google y sesión por cookie. La sesión
> por cookie no sirve desde React Native, así que pasa a better-auth con cookie
> en web y Bearer en móvil, mismo servidor.

**Aliados.** Alguien que trabaja en una organización dada de alta por un
administrador. No se declara aliado nadie: el tipo aparece al entrar por el
enlace de la organización, y la organización **nunca se auto-registra**.

- **El slug identifica, el código autoriza.** Quien llega con código de
  invitación queda activo; quien llega sin él, en una cola donde no ve nada. El
  código va en el path, nunca en query string.
- **Un aliado no tiene ficha pública** ni contacto publicado.
- **`puede_ver_identidad` no se otorga solo.** Ni al entrar por enlace, ni al ser
  aprobado, ni al ser coordinador: siempre es un acto explícito de un
  coordinador sobre una persona concreta, y queda registrado.
- **Una organización con equipo no se queda sin coordinador activo.**

**Proveedores de Servicios → proveedor de identidad, o token portador si los dan
de alta.** Quien no tiene cuenta —que es buena parte del rebusque, y es a quien
el módulo quiere incluir— lo registra un miembro de la fundación, y recibe **su
propio token**, con el mismo mecanismo de las solicitudes.

Ese token no es comodidad, es la puerta de habeas data de alguien que no tiene
cuenta: con él ve, corrige y borra su perfil sin pedirle permiso a la fundación.
Sin él, el alta asistida sería la fundación siendo dueña de los datos de otra
persona. Un `check (num_nonnulls(perfil_id, token_hash) = 1)` impide que un
proveedor tenga los dos dueños o ninguno.

## Notificaciones

Web Push (VAPID). Se guarda `endpoint`, `p256dh`, `auth` asociados a la
solicitud, con `ON DELETE CASCADE`. Se borran cuando la solicitud muere.

En iOS solo funciona si el sitio se agrega a la pantalla de inicio; hay que
explicarlo en la UI. Fallback siempre disponible: volver al enlace de la
solicitud y ver respuestas.

Cuando exista la app móvil, las notificaciones nativas son otro transporte sobre
la misma decisión de a quién avisar. Esa decisión vive en la capa de dominio, no
en el código de push.

## Anti-abuso

Hoy: Cloudflare Turnstile en las rutas de escritura pública.

**Turnstile no funciona en React Native** — es un widget de navegador. No
diseñes el anti-abuso asumiendo que siempre estará. Cuando llegue la app móvil,
el reemplazo es limitación de tasa en la capa de API, por IP y por token, más
atestación de dispositivo si el abuso se vuelve real. No lo construyas ahora.

## Verificación de servidores

Se pide entidad y número de matrícula: COPNIA (ingenieros), CPNAA (arquitectos),
Colegio Colombiano de Psicólogos, ReTHUS (salud), SIRNA / Consejo Superior de la
Judicatura (abogados).

La verificación inicial es **manual por un administrador**. No inventes scraping
de esos registros. Mientras no esté verificado, el perfil se muestra con
advertencia visible.

**En Servicios no hay matrícula que mirar**, y por eso la confianza se apoya en
otras tres cosas, todas blandas y todas manuales: teléfono verificado por una
persona de la fundación, referencia de un cliente anterior comprobada por
muestreo, y servicios confirmados con código. Ninguna equivale a una
verificación de identidad y la interfaz tiene que decirlo —una referencia la
puede dar un conocido—. No inventes OTP, no metas un proveedor de SMS y no
llames «verificado» a nada que no haya mirado alguien.

## Estilo de código

- Español en UI, copy, nombres de tablas y columnas
- Inglés en nombres de funciones y variables de TypeScript
- Server Components por defecto; `'use client'` solo donde haga falta
- **Ninguna escritura desde el cliente directo a la base de datos.** Toda
  escritura pasa por un procedimiento del contrato, que valida con Zod y delega
  en la capa de dominio
- Sin animaciones pesadas y sin traer librerías nuevas por comodidad — pero la
  interfaz puede ser interactiva donde eso ayude a coordinar

> Esta sección reemplaza la regla anterior, «toda escritura pasa por funciones
> RPC `security definer` en Postgres». La mitad sigue valiendo —nunca escritura
> directa del cliente—; la otra mitad se invierte con el ADR 0001.

## Identidad visual

**En revisión con el rediseño.** Lo que sigue describe lo que hay hoy y es lo
vigente; espera que cambie. Lo que no cambia es la accesibilidad del núcleo
invariante: 48 px táctiles, 16 px de texto, contraste AA.

> Hay un manual de marca nuevo en construcción, con otro símbolo y otra paleta:
> `docs/marca/LEEME.md`. **Todavía no es vigente.** No cambies tokens, fuentes ni
> componentes por lo que hay ahí hasta que exista el ADR que lo adopte.

- **La marca es un gato**, `src/components/marca.tsx`. Viene del Gato del Río; la
  nariz es un corazón. No lo encierres en una caja con borde si ya hay fondo de
  color, no lo pongas sobre fotos y no lo uses como mascota que habla.
- **Tipografía:** Caprasimo solo en `h1` y `h2` (clase `font-heading`, sin
  `font-bold`), Figtree en todo lo que se lee, Geist Mono en los códigos.
- **Color: solo tokens.** Nada de `bg-amber-50`, `text-green-900` ni ningún color
  crudo de Tailwind. Lo verificado y lo cumplido van en salvia (`ok`,
  `ok-suave`); los avisos, en terracota tenue (`accent`, `accent-foreground`).
  **Esta regla sobrevive al rediseño**: cambiarán los valores de los tokens, no
  la prohibición de escribir color crudo.
- **Botones y chips en píldora** (`rounded-full`). Los altos no cambian: el
  mínimo táctil de 48 px manda sobre cualquier cosa estética.

## Sistema de diseño · las once reglas

**En revisión con el rediseño.** Están escritas para poder decir «esto no cumple
la regla 3» en una revisión. Mientras no haya un ADR que las reemplace, siguen
vigentes y **una pantalla nueva nace cumpliéndolas**.

**1 · Primer pantallazo.** En los primeros 640 px de alto tiene que caber el
título, la navegación de la pantalla y *un dato real*. Máximo dos bloques de
explicación antes del contenido.

**2 · Una sola terracota por pantalla.** El relleno `--primary` se reserva para
la acción principal. Si hay dos rellenos terracota compitiendo, uno de los dos
no es la acción principal.

**3 · Dos capas de navegación como máximo.** La barra inferior y un segmentado.
Un tercer grupo de píldoras significa que la pantalla está haciendo dos trabajos
y hay que partirla.

**4 · Los filtros no ocupan el cuerpo.** Un chip «Filtros» con el número
aplicado, los activos como chips con equis, y el conteo de resultados al lado.
Los controles viven en una hoja inferior. El estado sigue en la URL.

**5 · Un aviso corto arriba, el completo en la decisión.** Sobre una lista, una
línea con enlace. El texto íntegro va pegado al botón que abre WhatsApp o envía
una respuesta. Nunca dos avisos consecutivos.

**6 · Formularios por secciones, guardado por sección.** Más de tres campos,
secciones plegables con resumen. El consentimiento es su propia sección con su
fecha, y bloquea la publicación, no la edición.

**7 · Tarjeta de lista: cinco datos.** Qué es, dónde, cuándo, estado y una
acción. Máximo tres chips visibles y un «+N».

**8 · Nombres por lo que hay, no por quién lo hace.** Los destinos se nombran con
el contenido; los roles no se nombran nunca en la barra. Una etiqueta no pasa de
dos palabras y el `h1` repite esa palabra exacta.

**9 · Accesibilidad.** Ver el núcleo invariante. Solo se animan opacidad y
transform.

**10 · Destino o flujo, nunca las dos cosas.** Una pantalla de destino lleva la
marca arriba y la barra inferior. Una de flujo lleva volver y título arriba, no
lleva barra inferior, y su acción es una barra fija abajo. Lo sostiene
`MarcoFlujo` con una regla `:has()` en `globals.css`.

**11 · El dato sensible se destapa de uno en uno, y se ve que quedó
registrado.** Ninguna lista trae nombres, teléfonos ni documentos de terceros.
Se abren uno por uno, con motivo escrito por la persona en ese momento, y la
pantalla dice después —no en letra pequeña— que la lectura quedó en la bitácora
y que al recargar desaparece de la pantalla. **Esta regla no está en revisión:**
es la forma de interfaz de las reglas N y U, y sobrevive al rediseño.

## Pregunta abierta · imágenes y datos personales

Antes de habilitar la primera subida de archivos hay que decidir por escrito:

- Una foto de una persona es dato personal, y la regla 1 la prohíbe en una
  solicitud, sin excepción.
- Una foto de perfil de proveedor en `/servicios` sí encaja —publicación
  consentida— pero necesita casilla explícita y versión de autorización
  guardada.
- Una foto de un trabajo hecho puede llevar personas de fondo, o una fachada,
  que es dirección exacta por otra vía.
- Un texto se filtra con expresiones regulares; una imagen no. O la mira alguien,
  o hay revisión previa antes de publicar.
- El borrado del blob es código y se escribe junto con la subida.

Hasta que exista ese ADR, no implementes subida de imágenes.
