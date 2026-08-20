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

Desde el 19 de agosto de 2026 hay **un módulo más, al lado y no encima**:
`/servicios`, el directorio del rebusque, para la reactivación económica.
Ahí un proveedor publica su nombre, su teléfono y sus oficios de forma
permanente, y quien necesita un servicio lo busca o publica lo que le
hace falta. La responsable del tratamiento de esos datos es la **Fundación
Nodo Social**; AquíVe es encargada. Todo su detalle está en `PLAN-V3.md`,
y las reglas que cambian están abajo, marcadas.

**No es una app de mapas.** Ya existen varias (mapadelterremoto.com,
cuidarcolombia, conectacolombia) y cubren bien esa capa. No dupliques
mapas de acopios, directorios de donación ni búsqueda de personas.
El eje diferencial es **solicitud ↔ oferta directa entre personas**.

El módulo de emergencia es **deliberadamente temporal**. Se espera que
deje de operar en semanas o meses. No diseñes para permanencia.

El módulo de Servicios no: nació de mediano plazo, porque un directorio
que se vacía solo no es un directorio. Esa diferencia es la razón de que
sean dos módulos y no uno con opciones.

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

**Esta regla no tiene excepciones en la solicitud.** Ni una. Lo de arriba
sigue prohibido en `solicitudes`, en `solicitud_items` y en la nota, sin
importar qué flujo se elija.

Lo que sí existe, desde el 14 de agosto de 2026, es una tabla aparte:
`identidades` (PLAN-V2 §5.2, reglas K a P). Guarda nombre, documento y
teléfono **cifrados con llave del Vault**, para el acompañamiento de una
organización aliada, y es otra cosa que un campo en la solicitud:

- **Se pide, no se recoge.** Publicar directo no la toca. Elegir
  acompañamiento es un acto explícito, con su texto de autorización, y
  nunca puede ser el camino de menor resistencia (regla R del plan).
- **Vive aislada.** Tabla revocada entera, cero políticas, ninguna vista
  pública la toca. La única puerta son tres RPC.
- **Muere con lo que acompaña.** La de quien pide cuelga de su solicitud
  y se va con ella a las 72 horas; la de quien ofrece cuelga de su perfil
  y se va con su cuenta.
- **Sin datos de menores, por CHECK.** Solo CC, CE, PEP y PPT. TI y RC no
  aparecen ni en la base ni en un desplegable.
- **Cada lectura deja rastro** en `accesos_identidad`, y ese rastro
  sobrevive a la identidad. Sin PII.

Desde la Fase F hay una pantalla que lo pide: en `/solicitud/[token]`,
detrás de un enlace que empieza cerrado, y solo si el municipio tiene una
organización activa. **Nada de eso puede desplegarse** hasta que estén los
papeles de PLAN-V2 §12 — contrato de transmisión de datos con la
fundación, registro en el RNBD, canal de habeas data y texto de
autorización revisado.

Y la forma de la interfaz también es regla, no gusto (regla R del plan):
el botón grande es publicar directo, el acompañamiento se anuncia una vez
en el paso de municipio y se acepta después, nunca viene preseleccionado,
y la opción anónima no se pinta como la mala.

**En Servicios esta regla no se relaja: cambia de sujeto.** Habla de quien
pide, y quien pide un servicio sigue sin dejar rastro —oficio, municipio,
zona, urgencia, capacidad de pago y una nota de 140 filtrada, nada más—.
Lo que publica el proveedor es otra cosa: publicación consentida y con
finalidad declarada, con casilla explícita, versión de autorización
guardada y borrado a un toque, exactamente como hoy hace `perfiles`.

Y la persona que sirve de **referencia** de un proveedor no está aquí, no
aceptó nada y puede que ni sepa que existimos: su nombre y su teléfono van
cifrados con la llave del Vault, nunca aparecen en una vista pública y
cada lectura deja rastro. Es la regla U de `PLAN-V3.md`.

### 2. Sin campo de texto libre sin restricción

Los ítems se eligen de un **catálogo predefinido** (`catalogo_items`).
La interfaz debe hacer *imposible* publicar datos personales, no solo
desaconsejarlo. Si agregas una nota libre, va con `maxlength=140`,
validación en servidor y detección de patrones (teléfonos colombianos,
correos, cédulas) que **rechaza el envío** con mensaje explicativo.

En Servicios los oficios salen de `catalogo_oficios` y los campos libres
son exactamente cuatro, todos con tope y filtro `contiene_pii`: la
descripción del proveedor (300), el comentario de reseña (140), la réplica
del proveedor (140) y la nota de solicitud (140). **El precio no es campo
libre**, aunque el documento fuente lo pedía así: es modo (`gratis`,
`aporte`, `solidario`, `normal`) más un valor «desde» numérico y una
unidad de lista. Un campo libre en un perfil público es por donde se cuela
el segundo teléfono.

### 3. El contacto nunca pasa por la plataforma

**En el flujo directo**, que es el de siempre y el que se ofrece primero:
no hay mensajería interna y no se guardan conversaciones.

Flujo correcto:
1. Necesitado publica solicitud → recibe token
2. Ofertador/servidor responde con un mensaje corto y su forma de contacto
3. El **necesitado** decide a quién escribir y lo hace por fuera (WhatsApp,
   llamada) usando el contacto que el ofertador publicó voluntariamente

La plataforma nunca conoce el canal de contacto del necesitado.

**En el módulo de Servicios el contacto también queda fuera, y por la
misma puerta al revés.** No hay mensajería interna. El teléfono del
proveedor está en su ficha porque él lo puso ahí, con casilla explícita:
quien necesita el servicio llama o escribe por WhatsApp. La plataforma
nunca conoce el canal de quien pide, igual que siempre.

**En el flujo acompañado ocurre al revés, y a propósito.** Cuando una
fundación aliada coordina la entrega, la conversación pasa por aquí —los
tres a la vez— y el intercambio de teléfonos se **bloquea** (regla M). No
es una excepción a esta regla: es la misma idea por el otro camino. Si dos
desconocidos se van a encontrar, o no sabemos nada del encuentro, o hay un
tercero responsable delante. Lo que no puede existir es el punto medio:
recolectar datos y además dejarlos solos.

Y ese hilo **no es un archivo**: muere con la solicitud, y se le dice a los
tres en pantalla.

### 4. Borrado duro, no lógico

- `DELETE` real, nunca `estado = 'eliminada'`
- TTL por defecto 72 horas, renovable en un toque
- Job de expiración cada hora

**En Servicios hay dos relojes y los dos terminan en `DELETE` real.** La
solicitud de servicio vive 15 días renovables —conseguir una modista no es
conseguir agua— y el perfil del proveedor es permanente: se borra cuando
su dueño lo pide o cuando un admin lo suspende y lo elimina. Un código de
servicio sin usar muere a los 30 días. `resenas.oculta` no es borrado
lógico: es moderación reversible sobre algo que no es dato personal de
quien lo escribió, y un reporte por extorsión termina en borrado de
verdad. Detalle en `PLAN-V3.md` §2.

- No habilitar Point-in-Time Recovery: contradiría la promesa de borrado
- Al borrar, conservar solo una fila anónima en `metricas` (municipio,
  categoría, si se cumplió, horas hasta primera respuesta). Sin texto,
  sin ubicación fina, sin identificadores.

**El acompañamiento no alarga el TTL, solo lo aplaza mientras haya algo
vivo.** Una solicitud con conversación abierta se auto-renueva, con **techo
duro de 5 días** desde que se publicó. Al llegar al techo se cierran los
hilos y se borra igual. La promesa es que esto se borra, no que se borra
pronto — pero se borra.

**Tres cosas sobreviven al borrado, y ninguna tiene datos personales:**
`metricas`, `entregas` —qué ítems, cuántos, qué organización, qué
municipio— y `accesos_identidad`, que dice quién leyó una identidad, cuándo
y con qué motivo, nunca qué leyó. Por eso `entregas` no tiene llave foránea
hacia la solicitud y `accesos_identidad` va en `SET NULL` con copia en
texto: si colgaran de lo que registran, se irían con ello.

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

**Con una salvedad, y solo para el flujo acompañado.** Ahí los datos
personales de quien pide los trata una fundación aliada: ella es la
**responsable** del tratamiento y AquíVe es **encargada** — guarda lo que
la fundación necesita, mientras dura la coordinación, y nada más. Ese
reparto no reduce el alcance cerrado ni una línea: sigue sin haber
alojamiento, transporte de personas ni dinero. Lo que cambia es quién
responde por los datos, y eso exige papel firmado antes de dar de alta a
la primera organización real (PLAN-V2 §12).

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

**Ampliación acotada para el módulo de Servicios.** Decisión del
responsable, agosto de 2026, tomada por escrito y no al pasar. Dentro de
`/servicios` entran además:

- Transporte de personas
- Trasteos y acarreos
- Cuidado de personas
- Cuidado de mascotas

Fuera de `/servicios` estos cuatro **siguen prohibidos**, y en todo el
proyecto siguen prohibidos sin fecha de revisión el dinero en cualquier
forma, que AquíVe opere alojamiento y los medicamentos de control.

La ampliación viene con su contrapeso en la base de datos, no en la buena
intención: `catalogo_oficios.riesgo` marca como `alto` el cuidado de
niños, el cuidado de personas dependientes y el transporte de pasajeros, y
la vista pública **esconde** esos oficios de todo proveedor que no tenga
teléfono verificado y al menos una referencia confirmada. Es la regla S de
`PLAN-V3.md`. Si alguien propone quitarla para tener más perfiles
visibles, la respuesta es no.

Los oficios de riesgo que el documento fuente excluye —reconstrucción
estructural, salud, gas, instalaciones eléctricas, asesoría jurídica— no
entran en `catalogo_oficios`, porque ya existen en `catalogo_servicios`
con matrícula verificable. Esa es su vía.

### 6. Sin PII en logs ni en URLs

- Nunca poner el token en query string (va en el path o en el body)
- No loggear cuerpos de request
- No usar analytics que capturen URLs completas
- El código de una invitación de organización va en el path, igual
- Lo mismo con los cuatro últimos del documento: no van en una pantalla
  pública, ni en un QR, ni en una URL. El código de entrega que se escanea
  en el acopio es el identificador de la conversación, opaco por
  construcción
- El token de una solicitud de servicio y el del perfil de alta asistida
  van en el path, nunca en query string
- **El código de confirmación de servicio no va en ninguna URL.** Se
  escribe a mano en `/servicios/confirmar`. No hay enlace, no hay QR y no
  hay path que lo lleve: quien lo tiene lo recibió del proveedor en papel
  o por WhatsApp, y esa es toda la cadena

### Reglas del módulo de Servicios

Las seis de arriba siguen valiendo, con lo que cada una dice arriba sobre
Servicios. Estas se **suman**, y están desarrolladas en `PLAN-V3.md` §2:

- **S · El riesgo del oficio manda sobre la visibilidad.** Cuidado de
  niños, cuidado de personas dependientes y transporte de pasajeros nacen
  en `riesgo = 'alto'` y no aparecen en el directorio si el proveedor no
  tiene teléfono verificado **y** una referencia confirmada. Lo sostiene
  la vista pública, no la interfaz.
- **T · La reputación se gana con un servicio, no con una opinión.** Solo
  reseña quien tiene el código que el proveedor generó y entregó. Un
  código sirve una vez y lo garantiza un `unique`. La ficha muestra en
  grande cuántos servicios confirmados hay y en pequeño el promedio: una
  sola reseña mala no puede hundir a alguien que vive de esto.
- **U · Una referencia es PII de un tercero que no está aquí.** Cifrada,
  nunca pública, con autorización guardada y con rastro de cada lectura en
  `accesos_referencia`, que sobrevive a la referencia. Si eso no se puede
  cumplir, no hay referencias.
- **V · El teléfono lo verifica una persona, y nada nace verificado.** No
  hay OTP ni proveedor de SMS. Un miembro de la fundación llama y marca,
  igual que hoy se verifica una matrícula.

### Reglas del flujo acompañado

Las seis de arriba siguen valiendo enteras. Estas se **suman** cuando hay
una fundación coordinando, y están desarrolladas en `PLAN-V2.md` §2:

- **K · La identidad vive cifrada, aislada y con fecha de muerte.** Nombre,
  documento y teléfono van en `identidades`, cifrados con llave del Vault,
  y mueren con la solicitud o con la cuenta de la que cuelgan.
- **L · Ninguna conversación puede ser bilateral.** Un hilo sin aliado a
  cargo no acepta mensajes. Lo sostiene un trigger, no la interfaz.
- **M · El chat filtra datos de contacto.** Más estricto que el filtro de
  la nota: cubre `wa.me`, `t.me`, arrobas sueltas y dígitos escritos con
  letras. Sin esto la regla L es decorativa.
- **N · Cada lectura de identidad deja rastro**, y ese rastro sobrevive a
  la identidad.
- **O · Sin datos de menores.** Solo CC, CE, PEP y PPT, por CHECK.
- **P · El documento se hashea con pepper del Vault**, nunca del
  repositorio.
- **Q · La plataforma no es el archivo de la fundación.** La planilla con
  nombres se exporta en el momento de la entrega y la custodia ella.
- **R · Elegir el flujo acompañado nunca puede ser el camino de menor
  resistencia.** El botón grande es publicar directo. Se ofrece, se
  explica y se acepta: no se preselecciona, no se pide dos veces y no se
  pinta en rojo la opción anónima.

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

**Proveedores de Servicios → Google, o token portador si los dan de alta.**
Quien tiene cuenta de Google entra como siempre. Quien no —que es buena
parte del rebusque, y es a quien el módulo quiere incluir— lo registra un
miembro de la fundación desde el panel de aliado, y recibe **su propio
token**, con el mismo mecanismo de las solicitudes: 32 bytes, se guarda
solo el hash, se muestra una vez.

Ese token no es comodidad, es la puerta de habeas data de alguien que no
tiene cuenta: con él ve, corrige y borra su perfil sin pedirle permiso a
la fundación. Sin él, el alta asistida sería la fundación siendo dueña de
los datos de otra persona. Un `check (num_nonnulls(perfil_id, token_hash)
= 1)` impide que un proveedor tenga los dos dueños o ninguno.

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

**En Servicios no hay matrícula que mirar, y por eso la confianza se apoya
en otras tres cosas, todas blandas y todas manuales:** teléfono verificado
por una persona de la fundación, referencia de un cliente anterior
comprobada por muestreo, y servicios confirmados con código. Ninguna
equivale a una verificación de identidad y la interfaz tiene que decirlo
—una referencia la puede dar un conocido—. No inventes OTP, no metas un
proveedor de SMS y no llames «verificado» a nada que no haya mirado
alguien.

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
