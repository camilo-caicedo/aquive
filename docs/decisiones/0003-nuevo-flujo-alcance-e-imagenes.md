# ADR 0003 · Flujo nuevo, alcance nuevo y subida de imágenes

- **Estado:** propuesta — **tres decisiones pendientes del responsable**
- **Fecha:** 2026-08-26
- **Decide:** responsable del proyecto
- **Fuente:** prototipo `docs/marca/AquiVe-Flujo.dc.html`, 40 pantallas
- **Depende de:** ADR 0001 (backend), ADR 0002 (identidad)

## Contexto

El prototipo no es solo un repintado: cambia qué ofrece la plataforma. Sobre las
17 pantallas del artefacto anterior construye 40, reordena la navegación, agrega
tres destinos que no existen en el repo y cambia cómo se contactan las personas.

El propio prototipo trae un mapa de pantalla a archivos del repo. Se verificó:
los 18 componentes que cita existen. El mapa es fiable.

Este ADR separa lo que se puede ejecutar de lo que necesita firma. **Lo primero
avanza; lo segundo no se construye hasta que haya respuesta.**

## Lo que el prototipo cambia y no toca reglas duras

Ejecutable sin decisión adicional.

### Navegación

La barra pasa de `Servicios · Solicitudes · Ayudas · Lo mío` a
**`Inicio · Buscar · Mensajes · Perfil`**, y la emergencia sale de la barra: se
entra a ella desde el inicio y sus pantallas encienden «Inicio».

Cumple la regla 8 —nombres por lo que hay, ningún rol nombrado— y la regla 3 de
diseño —dos capas de navegación como máximo—. La celda «Mensajes» depende de la
decisión 1 de abajo.

### Mapa de pantallas

| Grupo | Pantallas | Destino en el repo |
| --- | --- | --- |
| Entrada | 01, 03, 04 | `app/page.tsx`, `app/login`, `app/registro` |
| Buscar | 05–09 | `app/page.tsx`, `app/servicios/[id]`, `tarjeta-proveedor.tsx`, `hoja-filtros.tsx` |
| Contratar | 10–13 | `app/servicios/publicar`, `app/servicios/confirmar`, `chat.tsx` |
| Ofrecer | 14, 15 | `app/servicios/soy-proveedor` |
| Perfil | 16–25 | `app/registro`, `app/mis-datos/[token]`, `panel-*.tsx` |
| Insumos | 26–29 | `app/publicar`, `app/solicitudes`, `app/responder/[codigo]`, `app/solicitud/[token]` |
| Comunidad | 30, 31 | **nuevo** |
| Fundación | 32–34 | `app/aliado`, `hoja-dato-sensible.tsx` |
| Moderación | 35, 36 | `app/admin`, `app/admin/matriculas` |
| Información | 37–40 | `app/como-funciona`, `app/seguridad`; 38 PQR es **nuevo** |

Las pantallas 05b a 05e son variantes de tratamiento visual del inicio para
comparar, no destinos. El ADR 0002 ya eligió: sin contornos.

### Lo que el prototipo hace bien y conviene no perder

Se anota porque en una reescritura de 40 pantallas es justo lo que se cae:

- El muro de necesidades dice «sin cuenta y sin dar tus datos», con ítems de
  lista cerrada. Regla 1 y regla 2, respetadas.
- «Una necesidad se borra sola a las 72 horas, con todo lo que lleva dentro».
  Regla 4.
- La sección «Fotos de trabajos» del formulario de proveedor está marcada
  **CERRADO**, con el texto «cerrado hasta que se decida por escrito qué se
  puede subir». El prototipo respetó la pregunta abierta en vez de saltársela.
- Las verificaciones dicen que el teléfono lo llama una persona y que no hay SMS
  automático. Regla V.
- El oficio de riesgo alto aparece como `ESCONDIDO` con el motivo escrito:
  «falta una referencia confirmada para que aparezca en el directorio». Regla S.

## Decisión 1 · Chat interno en Servicios

**Necesita respuesta del responsable. Cambia una regla dura.**

El prototipo introduce chat dentro de la plataforma para Servicios (pantalla
12), abierto por el pedido, con este pie: «Este chat existe para acordar el
trabajo y se cierra con él. No se guardan conversaciones ni se comparten datos
de contacto por aquí.»

`CLAUDE.md` regla 3 dice hoy exactamente lo contrario para Servicios: «No hay
mensajería interna. El teléfono del proveedor está en su ficha porque él lo puso
ahí, con casilla explícita: quien necesita el servicio llama o escribe por
WhatsApp.»

**El cambio se sostiene, y hay que decirlo.** Hoy, para contratar, quien pide
tiene que llamar — y al llamar entrega su número a un desconocido. El chat lo
protege: la plataforma media, filtra datos de contacto como ya hace la regla M
en el flujo acompañado, y quien pide no revela nada hasta que quiera. Es la
misma idea de la regla 3 —o no sabemos nada del encuentro, o hay algo delante—
aplicada al lado que hoy queda expuesto.

Lo que trae consigo, y no es gratis:

- El filtro de la regla M deja de ser exclusivo del flujo acompañado y pasa a
  todo chat de Servicios. Sin filtro, el chat es un canal para pedir el número
  por fuera y la protección es decorativa.
- La plataforma pasa a guardar conversaciones donde antes no guardaba ninguna.
  Mueren con la solicitud de servicio, que vive 15 días renovables. Eso es
  mucho más que las 72 horas de una solicitud de insumos.
- El aviso de privacidad cambia: hoy promete que no hay mensajería.
- Aparece moderación de chat, que no existía.

**Si se aprueba**, la regla 3 se reescribe: el contacto sigue sin pasar por la
plataforma en el flujo directo de insumos, y en Servicios pasa por un chat que
filtra y que muere con lo que lo abrió.

**Si no se aprueba**, la pantalla 12 y la celda «Mensajes» de la barra salen del
plan, y la barra vuelve a tener tres celdas más una.

## Decisión 2 · Muro y «Hecho en el barrio»

**Necesita respuesta del responsable. Toca el alcance cerrado y la zona gris de
alojamiento.**

Dos destinos nuevos sin equivalente en el repo:

- **30 · Muro**, con dos caras: «se ofrece» (alguien dona un objeto: una nevera,
  cuadernos) y «se necesita». Con foto opcional de lo donado.
- **31 · Hecho en el barrio**, listado de productos con precio: «Pan de la
  esquina, $4.500», «Café tostado, $28.000 / libra».

Sobre la regla 5:

- **Donar objetos está dentro.** Enseres, ropa y aseo ya están en el alcance. La
  palabra «donación» en la regla 5 prohíbe **dinero**, no cosas. El prototipo lo
  cuida: «se acuerda por chat y no pasa dinero por aquí».
- **Productos con precio es nuevo.** El prototipo dice «AquíVe no vende nada y
  no cobra comisión. El precio y la entrega los acuerdan ustedes dos, por
  fuera», que es exactamente el modelo de precio que ya tiene Servicios. Como
  listado no rompe la prohibición de pasarela.

Lo que sí crece es otra cosa: **la zona gris de uso comercial del alojamiento**.
`docs/PENDIENTES-LEGALES.md` la tiene abierta desde antes, con la fundación de
por medio. Un catálogo de productos con precios la empeora — es la lectura más
comercial que ha tenido el proyecto. Esa consulta a soporte pasa de «conviene
antes de crecer» a **bloqueante de estas dos pantallas**.

Segundo asunto: el muro muestra el nombre de quien dona («Luz Marina Tobón ·
Belén»). Para quien ofrece es publicación consentida, igual que un proveedor, y
encaja. Para el lado «se necesita» el prototipo ya resolvió bien: sin cuenta y
sin datos. **Esa asimetría hay que sostenerla en el código**, no confiar en que
la interfaz la recuerde.

## Decisión 3 · Qué imagen se puede subir

**Necesita respuesta del responsable. Es la pregunta abierta de `CLAUDE.md`.**

El prototipo abre imágenes en dos sitios y deja un tercero cerrado:

| Dónde | Qué | Estado en el prototipo |
| --- | --- | --- |
| Muro, donación | Foto de lo donado | abierto, opcional |
| Hecho en el barrio | Foto del producto | abierto |
| Ficha de proveedor | Fotos de trabajos | **cerrado a propósito** |

El corte es el correcto: **objetos, no personas.** Una foto de una nevera o de
un pan no es dato personal; una foto de un trabajo hecho suele llevar gente o
una fachada.

Aun con ese corte quedan tres problemas que no se resuelven con buena voluntad:

**1 · Los metadatos EXIF llevan coordenadas.** Una foto tomada con el celular en
casa trae la ubicación exacta de esa casa. La regla 1 prohíbe coordenadas y
dirección exacta. Subir la foto de una nevera tal como sale del teléfono publica
dónde vive quien la dona. **Esto no es hipotético y es el riesgo más grande de
toda la funcionalidad.**

**2 · Una imagen no se filtra con una expresión regular.** El texto sí. Una foto
con un recibo, una placa, un menor o una fachada reconocible solo la detecta
alguien mirándola.

**3 · El borrado tiene que alcanzar el archivo.** `ON DELETE CASCADE` no borra
objetos del almacenamiento. Es código, y se escribe junto con la subida.

## Almacenamiento · decidido

El responsable eligió el almacenamiento de Supabase. Esto **modifica la fila
«Archivos» del ADR 0001**, que decía Vercel Blob.

**Se usa por el endpoint compatible con S3, no por el cliente de Supabase.** Es
la diferencia entre volver a atarse al proveedor justo cuando el ADR 0001 estaba
soltándose, y no: hablando S3 con `@aws-sdk/client-s3`, el mismo código sirve
contra R2, MinIO o AWS cambiando tres variables de entorno. Las URL prefirmadas
funcionan igual desde el navegador y desde React Native.

### Flujo de subida, con la cuarentena como puerta

La subida directa del cliente al almacenamiento —regla 4 de arquitectura del ADR
0001— choca con la necesidad de limpiar EXIF en servidor: si el archivo no pasa
por el servidor, el servidor no puede limpiarlo. Se resuelve con dos prefijos en
vez de renunciar a uno de los dos:

1. El servidor firma un `PUT` contra `cuarentena/<id>`. **Ese prefijo no es
   público.**
2. El cliente sube directo. El archivo nunca atraviesa una función.
3. Un Route Handler procesa: reencodifica con `sharp` —que descarta todos los
   metadatos, EXIF y GPS incluidos—, redimensiona y normaliza el formato.
4. Queda en cola de moderación. Aprobado, se escribe en `publico/<id>` y se
   borra el objeto de cuarentena.
5. Borrar la fila borra el objeto. Se escribe en el mismo cambio, no después.

`sharp` **ya está en `node_modules`**: no hay dependencia nueva que justificar.
Y el paso 4 es la revisión previa que el problema 2 exige de todos modos, así
que la cuarentena no es infraestructura de más — es el sitio donde ya tenía que
haber una persona mirando.

## Qué reglas duras cambian de garante

| Regla | Hoy | Con este ADR | Compensación |
| --- | --- | --- | --- |
| 1 · Cero PII de quien pide | catálogo cerrado y filtro de texto | **más EXIF** | reencodificar con `sharp` antes de publicar; sin excepción |
| 2 · Sin texto libre sin filtro | tope, servidor, patrones | igual, **más moderación de imagen** | cola de moderación entre cuarentena y público |
| 3 · Contacto fuera | sin mensajería en Servicios | **chat que filtra** (decisión 1) | regla M extendida a todo chat de Servicios |
| 4 · Borrado duro | `ON DELETE CASCADE` | igual, **más el objeto del bucket** | borrado del blob en la misma transacción lógica |
| 5 · Alcance cerrado | sin dinero | igual, **más productos con precio** (decisión 2) | sin pasarela; consulta de alojamiento resuelta antes |

## Consecuencias

### Positivas

- El prototipo ya resolvió el trabajo de diseño de 40 pantallas contra las
  reglas duras, y en los sitios difíciles las respetó por su cuenta.
- El mapa a archivos existe y es correcto, así que la implementación no empieza
  por adivinar dónde va cada cosa.
- Con S3 y `sharp` no entra ninguna dependencia nueva de peso.

### Negativas

- Es la reescritura más grande del proyecto, y cae encima de la migración del
  ADR 0001, que está en el paso 1 de 7.
- Aparecen moderación de imagen y —si se aprueba la decisión 1— moderación de
  chat. Las dos son trabajo humano recurrente para la fundación, no código que
  se escribe una vez.
- Tres textos legales quedan desactualizados: privacidad promete que no hay
  mensajería, y los términos y el aviso no contemplan imágenes.

## Orden de trabajo

**No empezar por las pantallas.** El ADR 0001 va en el paso 1 de 7, y repintar
39 pantallas sobre las RPC viejas es hacer el trabajo dos veces.

1. Tokens y fuentes del ADR 0002. Global, barato, revela lo que se rompe.
2. Pasos 1 a 3 del ADR 0001 sobre el módulo de Servicios: tipos de Drizzle,
   matar el acceso desde el navegador, contrato con las primeras lecturas.
3. Rehacer las pantallas de Buscar (05–09) sobre el contrato nuevo, ya con la
   identidad nueva. Una sola pasada por archivo.
4. Contratar (10–13) y Ofrecer (14–15). La pantalla 12 solo si se aprobó la
   decisión 1.
5. Perfil (16–25).
6. Insumos (26–29), sin invertir de más: el módulo de emergencia se apaga solo.
7. Fundación (32–34) y Moderación (35–36).
8. Comunidad (30–31) e Información (37–40). Al final: 30 y 31 dependen de la
   decisión 2, y son lo único que no tiene código previo que reusar.

Las imágenes entran con el paso 8, y solo con la decisión 3 respondida.

## Revisión

Se revisa cuando estén las tres decisiones. Cada una que se rechace saca su
parte del plan sin tocar el resto.
