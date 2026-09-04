# ADR 0015 · La cuenta es de cualquiera, y no dice a qué vino

- **Estado:** aceptada
- **Fecha:** 2026-08-28
- **Decide:** responsable del proyecto
- **Reemplaza:** la sección «Autenticación» de `CLAUDE.md`
- **Depende de:** ADR 0014 (se retira el módulo de insumos), ADR 0006 (cuenta
  para todo)

## Contexto

El ADR 0006 decidió que todo exige cuenta. Lo que no decidió —y quedó decidido
por accidente, en el formulario— es **qué se le pregunta a alguien al crearla**.

Hoy, quien entra con Google cae en un asistente de tres pasos cuyo primer paso
se titula **«¿Qué vas a ofrecer?»**, con dos casillas: «Insumos», marcada por
defecto, y «Servicios profesionales». El tipo de perfil se deriva de ellas —
`ofreceServicios ? 'servidor' : 'ofertador'`— y no hay tercera opción. Quien
entró a buscar una modista tiene que declararse proveedor de algo, publicar su
teléfono y firmar una autorización de publicación para poder seguir.

Esa asimetría no la puso nadie: es lo que quedó cuando la aplicación era solo el
módulo de emergencia y todo el que entraba venía a dar o a pedir cosas.

Mientras tanto, el modelo ya sabía la respuesta. `perfiles.tipo` admite
`'vecino'` desde la migración `v5-a2-perfil-de-vecino.sql`, cuyo comentario dice
literalmente **«vecino = solo pide, no publica nada»**. Para ese tipo el
teléfono es opcional por `CHECK` y la autorización puede quedar en nulo. Hay
**cero filas**: el tipo existe, está bien pensado, y la única pantalla pública
que crea perfiles lo rechaza.

## Decisión

**Al entrar con Google se piden dos cosas: el nombre visible y el municipio.**
Nada más. El perfil nace `tipo = 'vecino'`, con `acepto_publicacion = false`,
`autorizacion_version = NULL` y sin teléfono.

**Sin casilla de autorización de publicación.** No es un descuido: la Ley 1581
de 2012, artículo 9, exige autorización previa e informada **para una finalidad
declarada**. Quien no publica nada no tiene ninguna finalidad que autorizar, y
pedirle la firma igualmente enseña que la casilla es un trámite. La autorización
aparece cuando aparece la publicación: al armar la ficha del carné, al declarar
una matrícula, al publicar en el muro.

**Publicar es un acto aparte, siempre.** Pasar de `vecino` a prestador es armar
el carné; pasar a `servidor` es declarar una matrícula, en su propia pantalla y
con su propia autorización y su fecha. Ninguna pantalla de edición de datos
cambia el tipo de perfil por su cuenta.

**El alta pasa al contrato.** `crear_perfil` —una función de Postgres llamada
desde el navegador, que además rechaza `'vecino'`— se retira. En su lugar,
`cuentas.abrir`, `cuentas.mia` y `cuentas.guardarMia`, en `src/server/cuentas/`,
donde ya vive el alta que hace un admin.

**`perfiles.tipo` queda en `vecino | servidor | aliado`.** El `ofertador` se va
con el ADR 0014.

**Y `/perfil` deja de ser el panel de un prestador.** Con la cuenta creada y sin
carné, la pantalla enseña lo que esa persona sí tiene —sus datos, sus
solicitudes, sus publicaciones del muro, sus avisos, su privacidad— y ninguna de
las ocho filas que solo sirven con ficha. Se queda la invitación a armar el
carné, que es la vía por la que alguien pasa de buscar a ofrecer.

## Alternativas consideradas

**Arreglar `crear_perfil` para que acepte `vecino`.** Se descarta: es una RPC de
Postgres llamada desde el navegador, exactamente lo que el paso 2 de la
migración del ADR 0001 está quitando. Además exige al menos un municipio y la
versión de una autorización que este alta no tiene que dar, así que aceptarla
sería reescribirla entera — y reescribirla en PL/pgSQL es escribir deuda nueva.

**Quitar `perfiles.tipo` del todo y derivarlo de `servidores` y
`miembros_organizacion`.** Es tentador: `soy_aliado()` ya no lo lee, así que
`'aliado'` es decorativo. Se descarta porque `servidores_publicos` publica
`nombre_visible` y `contacto_publico` **de `perfiles`**, no de `servidores`.
Quitar el tipo obliga a darle a `servidores` sus propias columnas de
consentimiento y de versión, y eso es un cambio de protección de datos: merece
su propio ADR, no un renglón de este.

**Pedir también el teléfono en el alta.** Se descarta porque cambia el precio de
tener cuenta para quien solo viene a pedir, que es justo lo que el ADR 0006 dijo
que no había decidido. Un teléfono que no se publica y que nadie usa es un dato
personal guardado sin finalidad.

**No pedir nada: crear el perfil solo, con un nombre provisional.** Se descarta
porque `nombre_visible` es lo que ve la primera persona a la que se le escribe
por el chat. Un «Usuario 4f2a» en el primer mensaje es peor que un campo.

**Un solo ADR con el 0014.** Se descarta porque la sección «Revisión» no admite
dos preguntas: retirar insumos se revisa si vuelve una emergencia; esto se
revisa si el modelo necesita que `perfiles` vuelva a llevar un rol. Y la tabla
de garantes es distinta en cada uno. El ADR 0007 es el precedente: no mezcló el
retiro con lo que vino después — eso fue el 0008.

## Qué reglas duras cambian de garante

| Regla | Hoy la sostiene | Después | Con qué se compensa |
| --- | --- | --- | --- |
| Mínimo legal 2 · autorización previa por finalidad | El formulario de `/registro`, que la pide a todo el mundo | Cada pantalla que publica algo, con su propia versión y su fecha | Es más fuerte, no menos: hoy una sola casilla cubría nombre, teléfono, insumos y matrícula a la vez |
| Regla 4 · quien pide publica con cuenta | `crear_perfil`, en PL/pgSQL, desde el navegador | `cuentas.abrir`, en el contrato, con Zod en el borde | El `CHECK` de `perfiles.tipo` y el de contacto siguen en la base: la garantía dura no se mueve, solo la validación de borde |
| Autenticación · «todo exige cuenta» | Igual | Igual | Sin cambios. Lo que cambia es qué cuesta tener una |

⚠ Y una garantía que **hoy no la sostiene nadie** pasa a tener garante: la fila
de `perfiles` es obligatoria por llave foránea para armar una ficha, pedir un
servicio, publicar en el muro y abrir un chat, pero `guardar_proveedor` inserta
`perfil_id = auth.uid()` sin comprobar que exista. Hoy eso revienta con una
violación de llave foránea que la pantalla no sabe explicar. Pasa a rechazarse
con un mensaje.

## Consecuencias

- **Quien entra a buscar entra en dos campos.** Es el cambio que se buscaba.
- **Aparece una pantalla más en el recorrido de quien viene a ofrecer**:
  `/empezar` antes del carné. Es el precio de que la cuenta no presuponga nada,
  y es una pantalla de dos campos que además hoy se hace igual, con cinco.
- **Los perfiles existentes se reordenan.** Los `ofertador` pasan a `vecino`, y
  con ellos su teléfono y su descripción se borran: los dieron para aparecer en
  `/ofertadores`, que deja de existir, y una finalidad que ya no se cumple no
  sostiene el dato. Los `servidor` **sin fila en `servidores`** —nueve de doce en
  pruebas— también pasan a `vecino`: los creó el alta asistida, que marcaba
  `servidor` a prestadores del directorio. Su ficha no se ve afectada, porque
  `proveedores_publicos` filtra por columnas de `proveedores`.
- **Se descubren dos fallos vivos al tocar esto, y se arreglan aquí:**
  `crearCuenta` escribe `acepto_publicacion = true` sin `autorizacion_version`,
  contra el `CHECK perfiles_autorizacion_completa` — o sea que dar de alta a
  alguien que no sea `vecino` revienta hoy, desde `/admin/cuentas` y desde el
  alta asistida de `/aliado`. Y `VueltaAlDestino` está montado dentro de la rama
  sin perfil de `/registro`, así que salta al destino guardado **antes** de crear
  la fila: el recorrido «Ofrezco mi trabajo → Google → carné» muere en una
  violación de llave foránea.
- **`contacto_publico` pasa a ser un nombre que miente para un `vecino`**: la
  columna se llama así y para ese tipo es privada. No se renombra —es una
  migración con regeneración de tipos y ninguna ganancia funcional— pero la
  interfaz dice «Privado» y el comentario de la columna también.
- Queda una deuda escrita: `/perfil/datos` edita dos `nombre_visible` distintos,
  el de la cuenta y el de la ficha, que pueden divergir. La pantalla lo dice.

## Plan

1. Este ADR, detrás del 0014.
2. Contrato y dominio de la cuenta propia. Arreglo del `autorizacion_version`.
3. `/empezar`, y sus enganches: callback, login, lista blanca de destinos,
   `robots`, y el «Ofrezco mi trabajo» de la portada.
   ⚠ `/empezar` **no monta `VueltaAlDestino`**: el destino se recoge después de
   crear el perfil, no antes.
4. La pantalla de matrícula, que es lo que queda sin puerta al borrar
   `/registro`.
5. El SQL: migrar las filas, estrechar el `CHECK`, retirar `crear_perfil`, y que
   `guardar_proveedor` rechace con mensaje.
6. `/perfil` y «Mis datos y contacto».

Los pasos 2 y 4 pueden ir en paralelo. Los demás, en orden.

## Revisión

Se vuelve a mirar si el modelo necesita que `perfiles` vuelva a llevar un rol
—por ejemplo, si aparece un cuarto tipo que no se pueda derivar de una tabla— o
si se comprueba que pedir el municipio en el alta espanta a más gente de la que
ayuda. Lo segundo se mide: cuántas cuentas se abren y cuántas se abandonan en
`/empezar`.
