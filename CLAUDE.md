# CLAUDE.md

Contexto permanente del proyecto. Léelo completo antes de cualquier tarea.

## Qué es esto

**AquíVe — plataforma digital para la economía del rebusque.** Opera la
**Fundación Nodo Social**, que es la responsable del tratamiento de datos.

Conecta a quien necesita algo con quien lo ofrece, en Colombia, sin cobrar
comisión y sin mover dinero por la plataforma. Cinco cosas:

1. **Servicios.** Un prestador publica sus oficios, precios, zonas y horarios.
   Quien necesita busca, pide, acuerda por chat y califica con un código.
2. **Insumos.** Quien necesita publica una solicitud; quien puede, responde.
   Viene del módulo de emergencia y se queda.
3. **Comunidad.** Un muro con dos caras —lo que sobra y lo que falta— y
   «Hecho en el barrio», un listado de productos del vecindario.
4. **Fundación.** Entregas coordinadas, hilos acompañados y lectura de datos
   sensibles con bitácora.
5. **Moderación.** Colas de trabajo, verificación de matrículas y revisión de
   imágenes.

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
pública. No se piden, no se guardan, no se publican. Los tipos de documento
aceptados son CC, CE, PEP y PPT, por `CHECK` en la base; TI y RC no existen ni
en la base ni en un desplegable. En moderación de imágenes, una foto donde se
identifique a un menor se rechaza.

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

Hay mensajería interna. Un chat se abre por un pedido de servicio, sirve para
acordar el trabajo y se borra cuando se borra el pedido.

- No se archivan conversaciones. No hay bandeja histórica.
- El chat **filtra datos de contacto**: `wa.me`, `t.me`, correos, arrobas
  sueltas, números colombianos y dígitos escritos con letras. Sin ese filtro el
  chat es solo una forma más lenta de pedir el número.
- La ficha del prestador sigue mostrando su teléfono, porque él lo publicó. Lo
  que el chat protege es a quien contrata, que hoy tendría que llamar y
  entregar su número para empezar.
- En el flujo acompañado el hilo es de tres y **no acepta mensajes sin aliado a
  cargo**. Lo sostiene un trigger, no la interfaz.

### 3 · Todo lo que se publica se puede borrar, y borrar es `DELETE`

Nunca `estado = 'eliminada'`.

| Qué | Vive |
| --- | --- |
| Solicitud de insumos | 72 h, renovable |
| Solicitud de servicio | 15 días, renovable |
| Publicación del muro | mientras su dueño la deje |
| Producto de «Hecho en el barrio» | mientras su dueño lo deje |
| Ficha de prestador | permanente, hasta que la borre o la suspenda un admin |
| Chat | con el pedido que lo abrió |
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

Los oficios salen de `catalogo_oficios` y los ítems de `catalogo_items`. Los
campos libres llevan los tres: tope de caracteres, validación en servidor y
filtro de patrones que **rechaza el envío** con mensaje explicativo.

| Campo | Tope |
| --- | --- |
| Presentación del prestador | 300 |
| Nota de solicitud | 140 |
| Comentario de reseña | 140 |
| Réplica del prestador | 140 |
| Descripción del muro y de producto | 300 |
| Mensaje de chat | 500 |

Quien **pide** —un servicio o un insumo— sigue publicando sin cuenta y sin dar
datos: oficio o categoría, municipio, zona, urgencia, capacidad de pago y la
nota filtrada. Esa asimetría con quien ofrece **se sostiene en el modelo de
datos**, no en que la interfaz se acuerde.

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
dependientes y transporte de pasajeros. La consulta pública **esconde** esos
oficios si el prestador no tiene teléfono verificado **y** una referencia
confirmada. Lo sostiene la consulta del servidor, no la interfaz.

Los oficios que exigen matrícula —reconstrucción estructural, salud, gas,
instalaciones eléctricas, asesoría jurídica— no entran en `catalogo_oficios`:
van en `catalogo_servicios`, que sí la verifica. Fuera de todo: rescate,
búsqueda de personas, urgencias y atención prehospitalaria, que son competencia
de bomberos, Defensa Civil y la línea 123.

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
| Archivos | almacenamiento S3 (hoy Supabase), subida directa del cliente |
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
5. **El almacenamiento se habla por S3**, no por el cliente de Supabase: el
   mismo código sirve contra R2, MinIO o AWS cambiando variables de entorno.

### Qué se queda en Postgres

Lógica de negocio sale; garantías de integridad se quedan. Los `CHECK`, las
llaves foráneas con `ON DELETE CASCADE`, los `UNIQUE`, los índices y el trigger
del hilo acompañado. Son SQL estándar, no atan a un proveedor, y son la
diferencia entre «el código no debería» y «la base no lo acepta».

### Estado de la migración

| Paso | Estado |
| --- | --- |
| 1 · Tipos de Drizzle desde el esquema | pendiente |
| 2 · Eliminar el acceso a datos desde el navegador | pendiente |
| 3 · Contrato oRPC con las primeras lecturas | pendiente |
| 4 · Migrar lecturas, luego escrituras | pendiente |
| 5 · Cron y cifrado fuera del motor | pendiente |
| 6 · better-auth; espacios de trabajo de npm | pendiente |
| 7 · App Expo sobre el contrato | pendiente |

Actualiza esta tabla al avanzar.

## Autenticación

**Quien pide → token portador, sin cuenta.** 32 bytes base64url; se guarda solo
`sha256(token)`; se muestra una vez. Con él ve respuestas, renueva y borra lo
suyo. Ya es un Bearer token, así que sirve igual desde móvil.

**Quien ofrece, aliados y admins → cuenta.** Se persiste únicamente el
identificador opaco del proveedor de identidad. El correo se descarta.

**Prestador dado de alta por la fundación → su propio token.** Buena parte del
rebusque no tiene cuenta, y es a quien el módulo quiere incluir. Ese token es su
puerta de habeas data: sin él, la fundación sería dueña de los datos de otra
persona. Un `check (num_nonnulls(perfil_id, token_hash) = 1)` impide que un
prestador tenga dos dueños o ninguno.

**Aliados.** Trabajan en una organización dada de alta por un admin; nunca se
auto-registran. El slug identifica, el código autoriza —y va en el path—. Sin
ficha pública. `puede_ver_identidad` no se otorga solo: siempre es un acto
explícito de un coordinador sobre una persona concreta, y queda registrado.

## Pantallas

Prototipo completo en `docs/marca/AquiVe-Flujo.dc.html`. Es referencia visual y
de flujo; corre sobre el runtime de Claude Design y **no es código para
portar**.

| Grupo | Pantallas | Dónde vive |
| --- | --- | --- |
| Entrada | 01 Bienvenida, 03 Entrar, 04 Carné | `app/page.tsx`, `app/login`, `app/registro` |
| Buscar | 05 Inicio, 06 Categorías, 07 Listado, 08 Zonas, 09 Ficha | `app/page.tsx`, `app/servicios/[id]`, `tarjeta-proveedor.tsx`, `hoja-filtros.tsx` |
| Contratar | 10 Pedir, 11 Enviada, 12 Chat, 13 Calificar | `app/servicios/publicar`, `chat.tsx`, `app/servicios/confirmar` |
| Ofrecer | 14 Formulario, 15 Mi ficha | `app/servicios/soy-proveedor` |
| Perfil | 16–25 | `app/registro`, `app/mis-datos/[token]`, `panel-*.tsx` |
| Insumos | 26 Publicar, 27 Tablero, 28 Responder, 29 Mi solicitud | `app/publicar`, `app/solicitudes`, `app/responder/[codigo]`, `app/solicitud/[token]` |
| Comunidad | 30 Muro, 31 Hecho en el barrio | **nuevo** |
| Fundación | 32 Entregas, 33 Hilo, 34 Dato sensible | `app/aliado`, `hoja-dato-sensible.tsx` |
| Moderación | 35 Colas, 36 Matrículas, + imágenes | `app/admin`, `app/admin/matriculas` |
| Información | 37 Ayuda, 38 PQR, 39 Contactos, 40 Quiénes somos | `app/como-funciona`, `app/seguridad`; PQR es **nuevo** |

**Barra inferior: `Inicio · Buscar · Mensajes · Perfil`.** Cuatro celdas fijas.
La emergencia no tiene celda propia: se entra desde el inicio y sus pantallas
encienden «Inicio».

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

> **Falta el logo en SVG**, y con él la versión simplificada para menos de 32 px
> que el manual exige. Mientras llega, `marca.tsx` usa el nombre tipográfico y
> los iconos de la PWA se quedan como están. No bloquea nada más.

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
