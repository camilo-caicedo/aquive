# CLAUDE.md

Contexto permanente del proyecto. Léelo completo antes de cualquier tarea.

## Qué es esto

**AquíVe — plataforma digital para la economía del rebusque.** Opera la
**Fundación Nodo Social**, que es la responsable del tratamiento de datos.

Conecta a quien necesita algo con quien lo ofrece, en Colombia, sin cobrar
comisión y sin mover dinero por la plataforma. Cuatro cosas:

1. **Servicios.** Un prestador publica sus oficios, precios, zonas y horarios.
   Quien necesita busca, pide, acuerda por chat y califica con un código.
2. **Comunidad.** El muro —lo que alguien tiene y ya no usa— y «Hecho en el
   barrio», donde quien tiene ficha pone lo que vende. Un producto cuelga
   de la ficha de quien lo vende: así aparece con el nombre y la
   autorización que esa persona ya firmó, se contacta por su mismo teléfono
   y se borra con ella.
3. **Centros de acopio.** Lugares físicos con dirección y horario donde se
   dejan donaciones y productos, y que registran lo que entra y lo que sale.
   Los lleva el rol de aliado (ADR 0008).
4. **Moderación.** Colas de trabajo, verificación de matrículas y revisión de
   imágenes.

⚠ Hubo un quinto módulo, **Insumos**: quien necesitaba algo publicaba una
solicitud y quien podía, respondía. El ADR 0014 lo retiró entero, junto con
el tablero público de solicitudes de servicio y la cara «necesita» del
muro — las tres eran la misma forma de conectar, «publica y espera», y el
cliente la rechazó tras probar la aplicación. Lo que queda para todo lo que
antes cubría ese módulo es: buscar y contactar.

## Estado: reescritura completa

**Agosto de 2026. Se está rehaciendo la aplicación entera** sobre las bases
anteriores, con identidad, flujo y arquitectura nuevos.

Las reglas del proyecto anterior **ya no aplican tal como estaban escritas**.
Decisión del responsable, 26 de agosto de 2026. Lo que manda ahora es este
archivo, y detrás de él:

| Documento | Qué fija |
| --- | --- |
| `docs/decisiones/0001-*.md` | Backend en TypeScript, contrato tipado |
| `docs/decisiones/0002-*.md` | Identidad visual, tokens, tipografía |
| `docs/decisiones/0003-*.md` | Flujo, alcance, chat e imágenes |
| `docs/decisiones/0009-*.md` | Un solo chat, para los cuatro módulos |
| `docs/decisiones/0006-*.md` | **Cuenta para todo** |
| `docs/decisiones/0007-*.md` | Se retira el flujo acompañado |
| `docs/decisiones/0008-*.md` | El aliado es un centro de acopio |
| `docs/decisiones/0010-*.md` | La portada es siempre la bienvenida |
| `docs/decisiones/0011-*.md` | Quien pide escribe qué necesita |
| `docs/decisiones/0012-*.md` | Doce categorías de oficio, no ocho |
| `docs/decisiones/0013-*.md` | Categoría y subcategoría, en los dos lados |
| `docs/decisiones/0014-*.md` | **Se retira el módulo de insumos** |
| `docs/decisiones/0015-*.md` | La cuenta es de cualquiera, y no dice a qué vino |
| `docs/decisiones/0016-*.md` | Fuera el muro de necesidades y las solicitudes abiertas |
| `docs/decisiones/0017-*.md` | La solicitud es una orden dirigida a un prestador |
| `docs/decisiones/0018-*.md` | La sombrilla abre el menú |
| `docs/decisiones/0019-*.md` | Municipio, barrio y dirección, cada uno con lo suyo |
| `docs/marca/AquiVe-Flujo.dc.html` | Prototipo de las 40 pantallas |
| `docs/marca/Manual-de-Marca-AquiVe.pdf` | Manual de marca |
| `docs/PENDIENTES-LEGALES.md` | Bloqueantes que no son código |

Si el código y este archivo discrepan, gana el código, y actualizar este
archivo es parte de la tarea que causó la discrepancia.

Cuando una decisión cambie algo de aquí, va como ADR a `docs/decisiones/`
**antes** del código. Formato y criterio en `docs/decisiones/LEEME.md`.

---

## Mínimo legal

Corto, y es lo único que no se decide por conveniencia de producto. Todo lo
demás en este archivo es política del proyecto y se cambia cuando el
responsable lo decide.

**1 · Datos de menores.** Ley 1581 de 2012, artículo 7: el tratamiento de datos
de niños, niñas y adolescentes está proscrito salvo datos de naturaleza
pública. No se piden, no se guardan, no se publican.

⚠ Esto decía «los tipos de documento aceptados son CC, CE, PEP y PPT, por
`CHECK` en la base». Ese `CHECK` **ya no existe**, y la garantía de hoy es más
fuerte: **no hay ninguna columna de documento en la base**. Se fue con
`identidades` (ADR 0007), y con ella `validarDocumento` y `TIPOS_DOCUMENTO`.
No es que se acepten cuatro tipos: es que no se pide ninguno. Si algún día
vuelve a hacer falta un documento, vuelve también el `CHECK`.

En moderación de imágenes, una foto donde se identifique a un menor se
rechaza.

**2 · Autorización previa e informada.** Artículo 9. Publicar el nombre, el
teléfono o la foto de una persona necesita casilla explícita, finalidad
declarada y versión de autorización guardada con su fecha. Vale para el
prestador, para quien publica en el muro y para quien vende en «Hecho en el
barrio».

**3 · Habeas data.** Artículos 14 y 15: consulta en 10 días hábiles, reclamo y
supresión en 15. El canal existe, lo atiende la fundación, y toda persona con
datos publicados puede ver, corregir y borrar lo suyo sin pedir permiso — con
cuenta, o con su token si la dieron de alta.

**4 · Datos de terceros que no consintieron.** La persona que sirve de
referencia de un prestador no está en la plataforma y puede que no sepa que
existe. Su nombre y teléfono van cifrados, nunca en una vista pública, y cada
lectura deja rastro en `accesos_referencia`. Lo mismo para las identidades del
flujo acompañado y `accesos_identidad`. Ese rastro sobrevive al dato.

**5 · Registro en el RNBD** a nombre de la fundación, antes de operar con datos
personales reales. Ver `docs/PENDIENTES-LEGALES.md`.

---

## Reglas de producto

Las fija el responsable. Son las que gobiernan cómo se construye.

### 1 · La plataforma no mueve dinero

No hay pasarela, no hay pagos, no hay comisión, no hay carrito. Los precios son
información: quien contrata y quien presta acuerdan el monto y la entrega por
fuera.

Un precio se declara como **modo** (`gratis`, `aporte`, `solidario`, `normal`)
más un valor «desde» numérico y una unidad de lista. **Nunca es campo de texto
libre** — por ahí se cuela un segundo teléfono.

El alojamiento se paga (Vercel Pro, decisión del 26 de agosto de 2026), así que
la restricción de uso no comercial del plan gratuito ya no aplica y el listado
de productos no la infringe.

### 2 · El chat vive dentro y muere con lo que lo abrió

Hay mensajería interna, **una sola para toda la aplicación** (ADR 0009). Un
hilo cuelga de una de tres cosas —un producto, una publicación del muro o
una ficha de prestador— y se borra cuando se borra ella.

⚠ Eran cinco. El ADR 0014 retiró las otras dos —una respuesta a un pedido de
servicio y una respuesta a una solicitud de insumos— con el tablero de
solicitudes de servicio y el módulo de insumos enteros. El chat de la ficha
pasa a ser el único canal de todo lo de servicios.

- Son tres columnas con `on delete cascade`, no un par «tipo + id»: una
  llave polimórfica no puede cascadear, y entonces el borrado dependería de
  que algo se acuerde de cumplirlo.
- Los dos papeles se llaman igual en los tres orígenes: **`ofrece`** tiene la
  cosa o el trabajo, **`pide`** la necesita.
- Un producto y una publicación identifican solo a uno de los dos lados: el
  otro lo ocupa quien abra el hilo, y hay uno por persona.
- No se archivan conversaciones. No hay bandeja histórica. `/mensajes` es una
  sola lista, de los tres orígenes y de los dos lados. Lo sin leer sale como
  punto en la celda «Mensajes» y como palabra en la fila.
- El chat **filtra datos de contacto**: `wa.me`, `t.me`, correos, arrobas
  sueltas, números colombianos y dígitos escritos con letras. Sin ese filtro el
  chat es solo una forma más lenta de pedir el número.
- **Los botones de WhatsApp y de llamar se quedan** donde ya estaban. Quien
  publicó su teléfono lo hizo queriendo; lo que el chat protege es al otro
  lado, que tendría que entregar el suyo para empezar.
- La ficha del prestador **también** abre chat, y el hilo muere con la ficha
  por cascada. Lo que la regla 3 pide no es que el origen caduque, sino que
  el hilo muera con él — y un producto tampoco caduca.

### 3 · Todo lo que se publica se puede borrar, y borrar es `DELETE`

Nunca `estado = 'eliminada'`.

| Qué | Vive |
| --- | --- |
| Solicitud de servicio | 15 días, renovable |
| Publicación del muro | mientras su dueño la deje |
| Producto de «Hecho en el barrio» | mientras su dueño lo deje |
| Ficha de prestador | permanente, hasta que la borre o la suspenda un admin |
| Cuenta creada por un admin | hasta que su dueño la borre |
| Chat | con lo que lo abrió: producto, publicación o ficha |
| Código de servicio sin usar | 30 días |

Borrar una fila borra **también sus imágenes en el almacenamiento**.
`ON DELETE CASCADE` no borra objetos de un bucket: eso es código, y se escribe
junto con la subida.

Sin Point-in-Time Recovery, porque contradiría la promesa de borrado.

Sobreviven al borrado, sin datos personales: `metricas`, `entregas` y las
bitácoras `accesos_*`. Por eso `entregas` no tiene llave foránea hacia la
solicitud y `accesos_*` va en `SET NULL` con copia en texto.

`resenas.oculta` no es borrado lógico: es moderación reversible sobre algo que
no es dato personal de quien lo escribió.

### 4 · Los campos libres tienen tope y filtro

Los oficios de una **ficha** salen de `catalogo_oficios`, y `catalogo_items`
es el vocabulario con el que un centro de acopio registra lo que entra y lo
que sale. Los campos libres llevan los tres: tope de caracteres,
validación en servidor y filtro de patrones que **rechaza el envío** con
mensaje explicativo.

| Campo | Tope |
| --- | --- |
| Presentación del prestador | 300 |
| Detalle de solicitud de servicio | 80 |
| Comentario de reseña | 140 |
| Réplica del prestador | 140 |
| Descripción del muro y de producto | 300 |
| Mensaje de chat | 500 |

Quien **pide** un servicio publica con cuenta, desde el ADR 0006. **Tener
cuenta no es dar datos**: su nombre no se publica y su solicitud no lo lleva.

Pedir un servicio es **categoría, subcategoría y detalle opcional** (ADR
0013). La categoría es una de las doce —eran ocho hasta el ADR 0012—; la
subcategoría es una fila de `catalogo_oficios`, obligatoria, y quien no
encuentre la suya la escribe: «¿No encuentras lo tuyo? Agrégalo y lo
revisamos», **siempre a la vista**, no al final de la lista ni detrás de un
desplegable. El detalle queda para dar contexto.

⚠ Esto corrige el ADR 0011, que había quitado el catálogo entero de ahí. La
razón era buena —cuarenta y tantas píldoras juntas, y quien no encontraba la
suya se iba— pero lo que faltaba no era quitar la lista: era que la salida
estuviera delante. Ahora lo está, y ya no son cuarenta juntas: primero doce
categorías, después las siete u ocho de la que se elija.

Lo escrito **se publica de inmediato** —quien pide necesita respuesta hoy— y
entra en la cola de `/admin`, donde el administrador puede corregir el texto,
aprobarlo o reemplazarlo por algo que ya exista. Con la **ficha** es distinto,
y no por gusto: un oficio propuesto no se publica hasta que alguien lo mire,
porque `proveedor_oficios.oficio_id` es llave foránea contra el catálogo y la
vista pública hace `join` contra ella. Lo que no está en el catálogo es
invisible por construcción, no por un filtro que alguien pueda olvidar.

**Solo se sugieren subcategorías, nunca categorías.** Una categoría nueva son
dos `CHECK`, dos enums de TypeScript y un gajo de la sombrilla que repartir:
sale de un ADR, no de una pantalla.

⚠ Y esto reemplaza la asimetría anterior, en la que quien pedía publicaba sin
cuenta y volvía con un token. El ADR 0006 dice qué se pierde con el cambio y
por qué se aceptó.

### 5 · La reputación se gana con un servicio, no con una opinión

Solo reseña quien tiene el código que el prestador generó y entregó al
terminar. Un código sirve una vez, garantizado por un `unique`.

La ficha muestra en grande cuántos servicios confirmados hay y en pequeño el
promedio: una sola reseña mala no puede hundir a alguien que vive de esto.

### 6 · Nada nace verificado, y lo verifica una persona

No hay OTP ni proveedor de SMS. Un miembro de la fundación llama y marca.

Cuatro señales, todas blandas, y la interfaz tiene que decir que lo son:
teléfono verificado por llamada, referencia de un cliente anterior comprobada
por muestreo, servicios confirmados con código, y matrícula profesional cuando
la entidad tiene registro consultable (COPNIA, CPNAA, Colegio Colombiano de
Psicólogos, ReTHUS, SIRNA / Consejo Superior de la Judicatura). Ninguna
equivale a una verificación de identidad, y una referencia la puede dar un
conocido.

No inventes scraping de esos registros: la verificación es manual.

### 7 · El oficio de riesgo alto no se publica sin respaldo

`catalogo_oficios.riesgo = 'alto'` para cuidado de niños, cuidado de personas
dependientes, transporte de pasajeros y **refuerzo escolar** (ADR 0012). La
consulta pública **esconde** esos oficios si el prestador no tiene teléfono
verificado **y** una referencia confirmada. Lo sostiene la consulta del
servidor, no la interfaz.

El criterio de `alto` es uno solo, y por eso entró el cuarto: **quedar a solas
con alguien que no puede defenderse**. Que la excusa sea una tarea de
matemáticas y no un biberón no cambia la exposición. Por el mismo criterio
`animacion_infantil` es bajo —una fiesta ocurre con la familia delante— y
ningún oficio de construcción es alto: ahí el daño de un mal actor es
económico, que es justo lo que `alto` no significa.

Los oficios que exigen matrícula —reconstrucción, refuerzo o revisión
estructural, dictamen de habitabilidad, salud, gas, instalaciones eléctricas,
asesoría jurídica— no entran en `catalogo_oficios`: van en
`catalogo_servicios`, que sí la verifica. Fuera de todo: rescate, búsqueda de
personas, urgencias y atención prehospitalaria, que son competencia de
bomberos, Defensa Civil y la línea 123.

⚠ Desde el ADR 0013 hay una puerta más por la que puede nacer un oficio: la
cola de sugerencias de `/admin`. Por eso su `riesgo` **se elige a mano y sin
valor por defecto**, en la pantalla y en la función: un «cuidar a mi sobrino
después del colegio» aprobado como bajo porque el formulario traía bajo puesto
se salta este filtro entero.

⚠ El ADR 0012 abrió el grupo `construccion` —pintura, estuco, enchape,
goteras, plomería de fugas, carpintería, rejas, ayudante de obra— y **no movió
esa frontera**. El límite va escrito en el nombre de cada oficio: es «Plomería:
fugas y destapes», no «Plomería», porque el gas queda fuera; y es «Ayudante de
obra», no «albañil», porque un ayudante trabaja bajo la dirección de alguien.
Tampoco entran cerrajería, fumigación ni lavado de tanques.

### 8 · Imágenes: cualquiera, hasta 2 MB, moderada antes de publicarse

Decisión del responsable, 26 de agosto de 2026.

- **Máximo 2 MB** por imagen. Formatos de imagen corrientes.
- **Se puede subir cualquier imagen.** No hay lista blanca de temas.
- **Ninguna se publica sin pasar por moderación** desde el panel de admin.

El recorrido, y los pasos no son opcionales:

1. El servidor firma un `PUT` contra `cuarentena/<id>`, que **no es público**.
2. El cliente sube directo al almacenamiento. El archivo nunca atraviesa una
   función del servidor.
3. Un Route Handler reencodifica con `sharp`: **descarta todos los metadatos**
   —el EXIF de un teléfono lleva las coordenadas GPS de donde se tomó la foto—,
   redimensiona y normaliza el formato.
4. Queda en la cola de moderación del admin.
5. Aprobada, se escribe en `publico/<id>` y se borra el objeto de cuarentena.
   Rechazada, se borra y quien la subió recibe el motivo.
6. Borrar la fila borra el objeto.

Criterios de rechazo para quien modera: menores identificables (mínimo legal 1),
documentos de identidad, placas, datos de contacto escritos en la imagen,
contenido sexual o violento, y suplantación.

### 9 · Sin datos personales en logs ni en URLs

- Un token va en el path, en el body o en `Authorization`. Nunca en query
  string.
- No loggear cuerpos de request.
- El código de confirmación de servicio no va en ninguna URL: se escribe a mano
  en `/servicios/confirmar`. Sin enlace, sin QR, sin path.
- Los cuatro últimos de un documento no van en pantalla pública, ni en QR, ni
  en URL.

### 10 · La ubicación se publica solo si su dueño lo autoriza

Cambiada por el ADR 0004, decisión del responsable del 26 de agosto de 2026.

**Quien OFRECE puede aparecer en el mapa con un punto.** No es automático y no
va incluido en la autorización de publicar nombre y teléfono: es una casilla
aparte —`acepto_mapa`— con su propia versión y su fecha, porque publicar dónde
está alguien es otra finalidad (mínimo legal 2, artículo 9).

- **El punto lo pone la persona**, arrastrando el pin. Sin geocoding: así cada
  quien elige su precisión y puede marcar la esquina en vez del portón.
- **Quien no lo marca sigue en el directorio.** No hay penalización, y la
  pantalla del mapa dice cuántas personas más hay en la lista.
- **El filtro vive en `proveedores_publicos`**, no en cada consulta: la vista
  devuelve las coordenadas en `NULL` para quien no aceptó. Si el filtro se
  duplica, un día una copia se olvida.
- **Se puede quitar del mapa sin borrar la ficha.**

**Quien PIDE sigue sin dejar rastro.** Una solicitud no lleva coordenadas ni
nada más fino que barrio o comuna. Eso no lo cambió el ADR 0004 y no está en
discusión.

---

## Arquitectura

Decidida en el ADR 0001. **La migración está en curso**: vas a encontrar código
de los dos lados.

| Responsabilidad | Elección |
| --- | --- |
| Servidor | Next.js 16 App Router, runtime Node |
| Contrato de API | oRPC, contract-first |
| Acceso a datos | Drizzle ORM sobre `node-postgres` |
| Validación de borde | Zod |
| Lógica de negocio | `src/server/<dominio>/`, TypeScript puro |
| Autenticación | better-auth, con plugin de Expo |
| Base de datos | Postgres (hoy Supabase) |
| Archivos | API REST de Storage de Supabase, subida directa del cliente. Aislada en `almacen.ts` para poder pasar a S3 |
| Procesado de imagen | `sharp` |
| Tareas programadas | Vercel Cron |
| Cifrado | `node:crypto`, AES-256-GCM |
| Notificaciones | Web Push (VAPID); nativas cuando exista la app móvil |
| Anti-abuso | Turnstile en web; límite de tasa en la API |
| Alojamiento | Vercel Pro |
| Móvil (previsto) | Expo / React Native sobre el mismo contrato |

### Reglas de arquitectura

1. **La capa de dominio no importa `next/*`.** Recibe argumentos planos y
   devuelve datos. Quien lee cookies o cabeceras es el borde y pasa el valor
   hacia adentro. Sin esto nada sirve desde React Native.
2. **Toda operación nace como procedimiento del contrato**, no como Server
   Action exclusiva.
3. **Ningún acceso a datos desde el navegador.**
4. **Las subidas van directo del cliente al almacenamiento**, con URL firmada.
5. **El almacenamiento vive en UN archivo**, `src/server/imagenes/almacen.ts`,
   y nadie más habla con él. Hoy usa la API REST de Storage de Supabase, no
   S3: `@aws-sdk/client-s3` no está instalado. Pasar a R2, MinIO o AWS es
   reescribir ese archivo y nada más, que era el punto.

### Qué se queda en Postgres

Lógica de negocio sale; garantías de integridad se quedan. Los `CHECK`, las
llaves foráneas con `ON DELETE CASCADE`, los `UNIQUE`, los índices y el trigger
del hilo acompañado. Son SQL estándar, no atan a un proveedor, y son la
diferencia entre «el código no debería» y «la base no lo acepta».

### Estado de la migración

| Paso | Estado |
| --- | --- |
| 1 · Tipos de Drizzle desde el esquema | **hecho** — regenerado con `npm run db:pull` el 3 de septiembre de 2026 contra la base de pruebas ya migrada; `verificar-esquema` da 45 objetos y 460 columnas |
| 2 · Eliminar el acceso a datos desde el navegador | en curso — quedan ~15 archivos: 10 en admin y aliado, el resto repartidos. `crear_perfil` y `guardar_ofrecimientos` se fueron con los ADR 0014 y 0015 |
| 3 · Contrato oRPC con las primeras lecturas | **hecho** — Servicios, chat, comunidad, moderación |
| 4 · Migrar lecturas, luego escrituras | en curso — las escrituras de solicitudes de servicio y las de la cuenta ya están en el contrato |
| 5 · Cron y cifrado fuera del motor | **no** — el cron de imágenes huérfanas sí está fuera, pero `pg_cron` sigue programando el vencimiento de servicios —ya solo uno, el de 72 h se fue con insumos, y desde el ADR 0017 solo vence lo que sigue en `pendiente`— y el cifrado de referencias sigue en Postgres con `pgp_sym_encrypt` y el Vault |
| 6 · better-auth; espacios de trabajo de npm | pendiente |
| 7 · App Expo sobre el contrato | pendiente |

Actualiza esta tabla al avanzar.

## Autenticación

**Todo exige cuenta** (ADR 0006). Publicar una solicitud, un producto o una
donación, y recibir cualquier cosa. Una sola manera de ser dueño de algo:
`perfil_id`.

**Y la cuenta no dice a qué vino** (ADR 0015). Se piden **dos cosas**: el
nombre visible y el municipio, en `/empezar`. El perfil nace
`tipo = 'vecino'`, con `acepto_publicacion = false`, sin teléfono y **sin
casilla de autorización**: quien no publica nada no tiene ninguna finalidad
que autorizar (mínimo legal 2, artículo 9). La autorización aparece donde
aparece la publicación — al armar el carné, al declarar una matrícula, al
publicar en el muro.

⚠ Hasta el ADR 0015, el alta empezaba preguntando «¿Qué vas a ofrecer?» con
dos casillas y ninguna salida, y quien entraba a buscar una modista tenía que
declararse proveedor de algo. Los tres tipos que quedan son `vecino`,
`servidor` —profesional con matrícula, que es lo único que publica
`servidores_publicos`— y `aliado`, que no se elige: aparece al unirse a una
organización.

**Publicar es siempre un acto aparte.** `cuentas.guardarMia` no toca `tipo`,
`acepto_publicacion` ni `autorizacion_version`; eso lo escriben las pantallas
que publican, con su versión y su fecha. Un admin tampoco puede autorizar por
otra persona: `cuentas.crear` abre una cuenta `vecino` y nada más.

**Quien entra con Google.** Se persiste únicamente el identificador opaco del
proveedor de identidad. El correo se descarta.

**Quien no tiene Google → cuenta creada por un admin.** Se le crea un usuario
de verdad con un identificador sintético —no su correo, que se sigue sin
guardar— y se le entrega un enlace de acceso en mano o por WhatsApp. Buena
parte del rebusque no tiene cuenta de Google, y es a quien el módulo quiere
incluir: sin esta puerta, exigir cuenta lo dejaría fuera.

**La PQR es la única excepción, y no se toca.** Es el canal de habeas data
(mínimo legal 3, Ley 1581 arts. 14 y 15) y condicionarlo a tener cuenta lo
haría inejercible. `pqr.token_hash` se queda.

**Aliados.** Llevan un centro de acopio dado de alta por un admin; nunca se
auto-registran. El slug identifica, el código autoriza —y va en el path—. Sin
ficha personal pública: la ficha es la del centro.

## Pantallas

Prototipo completo en `docs/marca/AquiVe-Flujo.dc.html`. Es referencia visual y
de flujo; corre sobre el runtime de Claude Design y **no es código para
portar**.

| Grupo | Pantallas | Dónde vive |
| --- | --- | --- |
| Entrada | 01 Bienvenida, 03 Entrar, 04 Carné | `components/bienvenida.tsx`, `app/login`, `app/empezar`, `app/servicios/soy-proveedor/listo` |
| Buscar | 05 Inicio, 06 Categorías, 07 Listado, 08 Zonas + Mapa, 09 Ficha | `app/inicio`, `app/categorias`, `app/zonas`, `app/directorio` (lista y mapa), `app/prestador/[id]` |
| Contratar | 10 Pedir, 11 Enviada, 12 Chat, 13 Calificar | `app/servicios/publicar`, `app/mensajes`, `app/chat/[tipo]/[id]`, `app/servicios/confirmar` |
| Ofrecer | 14 Formulario, 15 Mi ficha | `app/servicios/soy-proveedor` |
| Perfil | 16–25 | `app/perfil/**` (con `verificaciones`), `app/mis-solicitudes` (20) |
| Comunidad | 30 Donaciones (antes «Muro»), 31 Hecho en el barrio | `app/donaciones` (con `publicar` y `mios`; `app/muro` redirige), `app/barrio` |
| Acopio | Lista pública y mapa, panel del centro con sus entregas | `app/acopios`, `app/aliado` |
| Moderación | 35 Colas, 36 Matrículas, imágenes, PQR | `app/admin`, `app/admin/matriculas`, `app/admin/imagenes`, `app/admin/pqr`, `app/admin/cuentas` |
| Información | 37 Preguntas frecuentes (antes «Ayuda»), 38 PQR, 39 Contactos, 40 Quiénes somos, Aliados, Datos abiertos | `app/ayuda`, `app/pqr` (y `app/pqr/[codigo]`), `app/contacto`, `app/quienes-somos`, `app/aliados`, `app/datos` |
| Fuera del prototipo | Directorios y puertas que el flujo de 40 pantallas no dibujó | `app/profesionales` (y `app/profesional/[id]`), `app/entidades` (y `app/entidad/[id]`), `app/producto/[id]`, `app/registro`, `app/mapa`, `app/entrar/[codigo]`, `app/unirse/[...ruta]` |

**Barra inferior: `Inicio · Buscar · Mensajes · Perfil`.** Cuatro celdas, las del
prototipo, más una quinta condicional —«Acopio»— para quien pertenece al
equipo de un centro.

**La portada es la bienvenida**, con sesión y sin ella (ADR 0010). Con sesión
la misma pantalla conserva encabezado y barra —sin ellos no tendría salida—,
«Ofrezco mi trabajo» lleva a publicar la ficha en vez de a entrar, y
desaparece «Entrar con Google». El inicio de siempre vive en `/inicio`.

⚠ El isotipo del encabezado **ya no lleva directo a la bienvenida** (ADR
0016, que reemplaza esa parte del ADR 0010): abre un menú con cinco
entradas —Quiénes somos, Preguntas frecuentes, Aliados, Datos abiertos y
Contacto—, con la bienvenida primera. Es un `<button>` de verdad, con
`aria-expanded`, `aria-haspopup` y `aria-label`, en `HojaAccion`
(`components/hoja-accion.tsx`). Lo que se pierde es el toque único a la
marca para volver al principio; se compensa con la bienvenida como primera
fila del menú y con que «Inicio», en la barra, nunca dependió del logo.

Y si la URL trae filtros —`/?oficio=…`— se sirve el directorio, con sesión o
sin ella: ese enlace viene de alguien que compartió una búsqueda, y enseñarle
una bienvenida tira a la basura lo que lo hacía útil. El directorio tiene
además URL propia, `/directorio`, que es la que indexa el buscador.

⚠ La bienvenida lleva el nombre y la frase de descripción **palabra por
palabra**: para Google `/` ES la bienvenida, y la verificación de marca ya se
cayó dos veces por menos.

`Buscar` lleva a `/categorias`, no a un buscador: es la puerta ancha para quien
no sabe qué buscar. Comunidad —el muro y los productos— no tiene celda propia:
cuelga de Inicio, como en el prototipo.

**Hay una sola bandeja de mensajes**: todos los orígenes del chat viven
juntos en `/mensajes`, porque tener dos celdas llamadas «Mensajes» era
ofrecer dos puertas al mismo cuarto.

## Identidad visual

Fijada en el ADR 0002. Manual en `docs/marca/`.

**La regla que gobierna la paleta: solo el negro y el azul son color de texto.**
Los otros cuatro son relleno, con texto negro encima. Así pasan AA entre 5.67 y
12.46; como texto sobre claro se quedan entre 1.35 y 2.98.

| Token | Valor |
| --- | --- |
| `--background` | `#F5EEE2` crema |
| `--foreground` | `#1D1D1B` |
| `--card` | `#ffffff` |
| `--primary` | `#B8F000` lima |
| `--primary-foreground` | `#1D1D1B` |
| `--ok` / `--ok-suave` | `#38B58C` / `#DFF3EC` |
| `--accent` / `--accent-foreground` | `#FEF6DE` / `#1D1D1B` |
| `--muted-foreground` | `#6f5a4a` |
| `--ring` | `#2860A8` |

Familias de oficio, de los gajos de la sombrilla: azul `#2860A8`, amarillo
`#F4C542`, verde `#38B58C`, rojo pastel `#E86F87`. **El color nunca va solo**:
siempre con la palabra.

**Solo tokens.** Nada de `bg-amber-50` ni ningún color crudo de Tailwind.

Tipografía: **Montserrat** en titulares y etiquetas, **Poppins** en cuerpo,
**Geist Mono** solo en códigos, ID de carné y valores enmascarados.

Estilo: sin contornos negros —sombra de 1 px en lo blanco sobre crema—, campos
de texto rellenos, botones y chips en píldora.

**El logo en SVG ya llegó**, con las versiones mini de 16, 24 y 32 px que el
manual exige. Vive en `docs/marca/Logo/SVG/` y esa es la fuente: los iconos de
la aplicación —favicon, `.ico`, PWA, Apple, enmascarable— se generan de ahí con
`node scripts/iconos.mjs`, que deja escrito de cuál de las veinte variantes sale
cada archivo. Con arte nueva se corre otra vez; no se editan a mano.

Lo que se sirve es PNG con paleta, no el SVG: el trazo de boceto son miles de
paths y cada archivo pesa entre 300 y 700 KB. Los PNG de 4267 px que mandó el
diseñador están en `.gitignore` —59 MB que el SVG regenera—.

Y el crema del arte es `#F3E8DF`, dos puntos más cálido que `--background`
`#F5EEE2`. Invisible salvo al rellenar el fondo del enmascarable, donde el
token deja una costura; por eso el guion usa el del arte y el manifiesto sigue
con el token.

⚠ Se fue `marca.tsx`, que dibujaba a mano un gato sobre terracota `#8B4513`
—ni la marca ni un color de la paleta— y ya no lo importaba nadie. La marca en
pantalla es `docs/marca/isotipo-carrito.png`, en el encabezado y la bienvenida.

## Accesibilidad

El público son personas en el rebusque y en albergues, muchas mayores, con
estrés agudo y teléfonos viejos, leyendo de pie y con prisa. Esto no se negocia
en un rediseño:

- Texto base mínimo 16 px, contraste AA
- Áreas táctiles de 48 px con 8 px de separación
- El estado nunca depende solo del color: sello, texto o icono además
- Foco visible, `aria-current` en la celda activa
- Solo se animan opacidad y transform
- Sin jerga técnica en ningún texto visible
- Mobile first de verdad

## Reglas de interfaz

1. **Primer pantallazo.** En 640 px de alto caben título, navegación y un dato
   real. Máximo dos bloques de explicación antes del contenido.
2. **Una sola acción principal por pantalla**, y es la que lleva el lima.
3. **Dos capas de navegación como máximo**: la barra inferior y un segmentado.
   Un tercer grupo de píldoras significa que la pantalla hace dos trabajos.
4. **Los filtros no ocupan el cuerpo**: chip con el número aplicado, activos
   como chips con equis, controles en hoja inferior, estado en la URL.
5. **Aviso corto arriba, completo en la decisión.** Nunca dos avisos seguidos.
6. **Formularios por secciones**, con guardado por sección y resumen al
   plegarse. El consentimiento es su propia sección con su fecha.
7. **Tarjeta de lista: cinco datos.** Qué, dónde, cuándo, estado y una acción.
   Máximo tres chips y un «+N».
8. **Nombres por lo que hay, no por quién lo hace.** Máximo dos palabras, y el
   `h1` repite esa palabra.
9. **Destino o flujo, nunca las dos cosas.** Un destino lleva marca arriba y
   barra abajo; un flujo lleva volver y título arriba, sin barra, con su acción
   en barra fija. Lo sostiene `MarcoFlujo` con `:has()` en `globals.css`.
10. **El dato sensible se destapa de uno en uno.** Ninguna lista trae nombres,
    teléfonos ni documentos de terceros. Se abren uno por uno, con motivo
    escrito en ese momento, y la pantalla dice después —no en letra pequeña—
    que la lectura quedó en bitácora.

11. **La aplicación dice qué está pasando, siempre.** Tres momentos, tres
    señales distintas:

    - **Mientras va**: el botón cambia de texto —«Guardando…»— y se apaga. Un
      botón apagado sin texto que cambie se lee como que el toque no registró,
      y se vuelve a tocar.
    - **Al terminar bien**: `useAviso()` de `components/avisos.tsx`, con lo que
      pasó y no un «Listo» genérico. Va **solo donde la pantalla no lo dice
      ya**: si la fila desaparece de la lista, eso es la confirmación y el
      aviso encima es ruido.
    - **Al terminar mal**: en línea, junto al campo, y **no se va solo**. Un
      error que desaparece a los cuatro segundos obliga a repetir la acción
      para volver a leerlo.

    Al navegar, `BarraDeCarga` en el layout. ⚠ No es —ni puede ser— un
    `loading.tsx`: el ADR 0005 lo retiró tras comprobar que dejaba la página
    sin hidratar. Es una barra encima del árbol, sin `Suspense` y sin
    `useSearchParams()`.

12. **Lo que pone su fondo dentro de una cinta pone también su tinta.**
    `TINTA_CINTA.azul` es `text-white` y se hereda, así que una píldora con
    `bg-card` dentro salía blanca sobre blanca. La constante es
    `PILDORA_EN_CINTA` en `lib/familias.ts`.

13. **Cuanto más se ve algo, menos se mueve.** Es lo que decide dónde va el
    movimiento, y no el gusto:

    | Cuántas veces al día | Qué lleva |
    | --- | --- |
    | Decenas — la barra inferior, los enlaces de lista | Casi imperceptible. La barra solo crece el icono activo |
    | De vez en cuando — hojas, modales, pestañas, listas | La entrada normal del proyecto |
    | Raro — vacíos, confirmaciones, primera vez | Aquí vive el presupuesto de gracia |

    Una barra de navegación que hace una gracia en cada toque cansa a la
    tercera hora. Un estado vacío que se ve una vez al mes puede permitirse
    una entrada escalonada.

    El vocabulario está en `globals.css`: `--curva-entrada`, `--curva-suave`
    y cuatro duraciones, ninguna por encima de 300 ms. **Van en `:root` y no
    en `@theme`**, que poda lo que no se usa como clase de utilidad y los
    dejaba vacíos.

    Y lo de siempre, que aquí es lo que más fácil se rompe: **solo `opacity`
    y `transform`**. La comprobación es de un minuto — recorrer los
    `@keyframes` de la hoja en el navegador y mirar qué propiedades declaran.

## Estilo de código

- Español en UI, copy, nombres de tablas y columnas
- Inglés en nombres de funciones y variables de TypeScript
- Server Components por defecto; `'use client'` solo donde haga falta
- Ninguna escritura desde el cliente directo a la base: pasa por un
  procedimiento del contrato, que valida con Zod y delega en el dominio
- Sin traer librerías nuevas por comodidad

## Qué hacer si algo no está claro

Pregunta antes de asumir. Aquí una suposición equivocada sobre qué dato guardar
tiene consecuencias sobre personas reales.
