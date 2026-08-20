# Plan v3 — AquíVe con módulo de Servicios

> **Para pegar en Claude Code.** Amplía `CLAUDE.md`, `PLAN-V2.md` y
> `docs/ESPECIFICACION.md`; no los reemplaza. Lee §1 y §2 antes de
> codificar: el proyecto pasa de dos flujos de emergencia a tener además
> un módulo con otras premisas, otro responsable de los datos y otro
> horizonte de tiempo. Casi todas las reglas duras siguen vigentes; una
> se amplía, y la ampliación está acotada por escrito.
>
> §2 (qué regla cambia y cuál no), §5.3 (referencias, que son datos de un
> tercero) y §7 (lo que no es código) son donde está el detalle que evita
> hacer daño. No los saltes.

Fuente: `AquiVe_Servicios_Documento_de_trabajo.docx`, Fundación Nodo
Social, Cali, agosto de 2026.

---

## 1. La idea en una página

AquíVe nació para la emergencia: solicitud anónima, borrado a 72 horas,
cero datos de quien pide. Esa promesa funciona porque el problema duraba
días.

La reactivación económica no dura días. La economía del rebusque de Cali
—la que más perdió con el sismo— necesita que a una modista, a un
domiciliario o a un técnico de electrodomésticos **se les pueda
encontrar mañana**. Un directorio que se borra solo cada 72 horas no
sirve para eso, y el anonimato tampoco: nadie contrata a un anónimo.

Entonces no se adapta el módulo de emergencia. Se pone otro al lado.

| | **Emergencia** (v1 y v2) | **Servicios** (v3) |
|---|---|---|
| Qué se publica | Cosas que hacen falta | Alguien que trabaja |
| Identidad de quien ofrece | Nombre visible y contacto | Nombre, teléfono verificado, referencias |
| Identidad de quien pide | **Ninguna** | **Ninguna** |
| Contacto | Por fuera, siempre | Por fuera, siempre |
| Vida útil | 72 horas, techo de 5 días | Perfil permanente; solicitud 15 días |
| Confianza | Ninguna, y se dice | Referencia, verificación y reseñas |
| Responsable de los datos | Persona natural | **Fundación Nodo Social** |
| Dinero | No | **No** |
| Horizonte | Semanas | Mediano plazo |

Dos cosas no cambian de una columna a la otra, y son las que sostienen
todo lo demás: **quien pide sigue sin dejar datos** y **la plataforma
sigue sin tocar dinero**.

### Por qué un módulo aparte y no una versión del tablero

- La promesa «esto se borra solo» del módulo de emergencia sigue siendo
  literalmente cierta. No hay que matizarla, hay que decir que al lado
  existe otra cosa que no se borra sola.
- El responsable del tratamiento es distinto. Mezclarlos obligaría a
  escribir un aviso de privacidad que no se puede cumplir.
- El riesgo es distinto. Una entrega de agua embotellada entre dos
  desconocidos no se parece a una persona entrando a una casa a
  trabajar.

---

## 2. Reglas duras: qué cambia y qué no

Las seis reglas de `CLAUDE.md` y las reglas K a R de `PLAN-V2.md`
**siguen vigentes completas** para los módulos de emergencia. Aquí se
dice qué pasa con cada una dentro de Servicios.

### Regla 1 · Cero datos personales de quien pide — **INTACTA**

`solicitudes_servicio` guarda: oficio, municipio, zona, urgencia,
capacidad de pago, nota de 140 filtrada. Nada más. Sigue prohibido
nombre, documento, teléfono, dirección exacta, composición familiar,
estado de salud y cualquier dato de menores.

Lo del proveedor **no es una excepción a esta regla**, porque la regla
habla de quien pide. Un proveedor publica su nombre y su teléfono con la
misma lógica con la que hoy los publica un ofertador en `perfiles`: es
publicación consentida y con finalidad, no recolección. Va con casilla
explícita, versión de autorización guardada y borrado a un toque.

### Regla 2 · Sin texto libre sin restricción — **INTACTA**

El módulo tiene exactamente tres campos libres, todos con tope y filtro
`contiene_pii`:

| Campo | Tope | Dónde |
|---|---|---|
| Descripción del proveedor | 300 | `proveedores.descripcion` |
| Comentario de reseña | 140 | `resenas.comentario` |
| Nota de solicitud | 140 | `solicitudes_servicio.nota` |

Más la réplica del proveedor a una reseña, también 140 y también
filtrada. Todo lo demás —oficio, precio, unidad, modalidad, días,
franjas, medios de pago, urgencia, capacidad de pago— es lista cerrada.

**El precio no es campo libre.** El documento lo pedía así; se
implementa como modo (`gratis`, `aporte`, `solidario`, `normal`) más un
valor «desde» numérico y una unidad de lista. Un campo libre en un
perfil público es por donde se cuela un segundo teléfono, y además un
precio comparable es más útil que uno escrito en prosa.

### Regla 3 · El contacto nunca pasa por la plataforma — **INTACTA**

No hay mensajería interna en Servicios y no se guardan conversaciones.
El teléfono del proveedor está en su ficha porque él lo puso ahí; quien
necesita el servicio llama o escribe por WhatsApp, fuera de aquí. La
plataforma nunca conoce el canal de quien pide.

Es la misma forma del flujo directo, con la dirección invertida: allá el
ofertador publica su contacto al responder, aquí lo publica en su ficha.

### Regla 4 · Borrado duro — **SE AMPLÍA A DOS CICLOS DE VIDA**

Sigue prohibido el borrado lógico. Sigue prohibido habilitar
Point-in-Time Recovery.

| Objeto | Vida | Cómo muere |
|---|---|---|
| Solicitud de servicio | 15 días, renovable a un toque | `DELETE` real, deja fila en `metricas_servicio` |
| Código de servicio sin usar | 30 días | `DELETE` real |
| Perfil de proveedor | **Permanente** | `DELETE` real cuando su dueño lo pide o un admin lo suspende y elimina |
| Referencia | Vive con el proveedor | Cascada; el rastro de acceso sobrevive |
| Reseña | Vive con el servicio confirmado | Cascada |

Quince días y no 72 horas porque conseguir una modista no es conseguir
agua. Y perfil permanente porque un directorio que se vacía solo no es
un directorio.

`resenas.oculta` **no es borrado lógico**. Es moderación reversible
sobre contenido que no es un dato personal de quien lo escribió. Cuando
un reporte por extorsión se resuelve, la reseña se borra de verdad.

### Regla 5 · Alcance cerrado — **SE AMPLÍA, SOLO AQUÍ Y POR ESCRITO**

Decisión del responsable, agosto de 2026. Dentro del módulo de Servicios
entran además:

- Transporte de personas
- Trasteos y acarreos
- Cuidado de personas
- Cuidado de mascotas

Fuera del módulo de Servicios estos cuatro **siguen prohibidos**. Y en
todo el proyecto, sin ninguna excepción y sin fecha de revisión:

- Dinero, donaciones, pagos, pasarelas
- Que AquíVe opere alojamiento de personas
- Medicamentos de control

Los oficios que el documento excluye en su §4 —reconstrucción y revisión
estructural, salud, gas, instalaciones eléctricas, asesoría jurídica— no
entran en `catalogo_oficios`. No porque falte capacidad de moderación,
sino porque **ya existen en `catalogo_servicios` con matrícula
verificable**, que es la vía correcta. Cuando alguien busque uno de esos
en `/servicios`, el buscador lo manda a `/servidores`.

### Regla 6 · Sin PII en logs ni en URLs — **INTACTA Y CON UN CASO NUEVO**

El token de la solicitud de servicio va en el path o en el body, nunca
en query string. El token del perfil de alta asistida, igual.

**El código de confirmación de servicio no va en ninguna URL.** Se
escribe a mano en un campo de `/servicios/confirmar`. No hay enlace, no
hay QR y no hay path que lo lleve: quien tiene el código lo tiene en
papel o en un mensaje de WhatsApp del proveedor, y esa es toda la
cadena.

### Regla S · El riesgo del oficio manda sobre la visibilidad — **NUEVA**

`catalogo_oficios.riesgo` distingue `bajo` de `alto`. Nacen en `alto`:
cuidado de niños, cuidado de personas mayores o dependientes, y
transporte de pasajeros.

Un proveedor **no aparece** en el directorio para un oficio de riesgo
alto si no tiene las dos cosas: teléfono verificado por la fundación y
al menos una referencia confirmada. Lo sostiene la vista pública, no la
interfaz, para que no dependa de que alguien se acuerde de filtrar.

Es una línea de SQL y es lo único que separa «conectar gente» de
«conectar a un desconocido con un niño». Si alguien propone quitarla
para tener más perfiles visibles, la respuesta es no.

### Regla T · La reputación se gana con un servicio, no con una opinión — **NUEVA**

Solo puede reseñar quien tiene un código de servicio que el proveedor
generó y entregó. Un código sirve una sola vez y lo garantiza un
`unique` en la base, no la interfaz. Sin código no hay reseña, aunque
haya cuenta, aunque haya sesión y aunque el botón exista.

La ficha muestra en grande **cuántos servicios confirmados** tiene el
proveedor y en pequeño el promedio. Es al revés de lo habitual y es a
propósito: una sola reseña mala no puede hundir a alguien que vive de
esto.

### Regla U · Una referencia es PII de un tercero que no está aquí — **NUEVA**

La persona que sirve de referencia no abrió la plataforma, no aceptó
nada y probablemente no sabe que existe. Por eso:

- Su nombre y su teléfono van **cifrados**, con la misma llave del Vault
  que `identidades`.
- Nunca salen en una vista pública. Lo público es un número: cuántas
  referencias confirmadas hay.
- Su autorización es obligatoria, se guarda la versión del texto y la
  fecha, y el proveedor declara haberla obtenido.
- **Cada lectura deja rastro** en `accesos_referencia`, y ese rastro
  sobrevive a la referencia.

Si esto no se puede cumplir, no hay referencias. Es preferible un
mecanismo de confianza más débil que una libreta de teléfonos de gente
que no dio permiso.

---

## 3. Decisiones tomadas y por qué

| Tema | Decisión | Por qué |
|---|---|---|
| Verificación de teléfono | Una persona de la fundación llama y marca | Cero dependencias nuevas, cero costo, y un OTP roza el límite de «uso no comercial» del plan Hobby. Espeja `verificar_servidor`, que ya existe |
| Zonas | Tabla `zonas`, Cali precargado, el resto a mano | «Comuna» es una división real en Cali y texto libre en casi todo lo demás |
| Alta del proveedor | Google, más alta asistida por la fundación | El §8 del documento existe porque el rebusque muchas veces no tiene cuenta. Si solo hay Google, el módulo excluye a quien quiere incluir |
| Ciclo de vida | Perfil permanente, solicitud a 15 días | Un directorio que caduca no es un directorio; una necesidad de servicio sí caduca |
| Reseñas | Criterios de 3 niveles más comentario de 140 | Escala corta porque se toca de pie y con prisa. Comentario porque sin él la reseña no dice nada |
| Confirmación | Código que genera el proveedor | Es el patrón de token portador que ya sostiene las solicitudes, y no obliga al cliente a registrarse |
| Precio | Modo, valor «desde» y unidad | Filtrable, comparable, y sin hueco de PII |
| Despliegue | Encendido desde el principio | Decisión del responsable. Ver §7: los papeles van antes que el código de producto |

---

## 4. Riesgos abiertos

**Se arranca sin interruptor.** Publicar datos personales permanentes de
terceros antes de tener contrato de encargo firmado y registro en el
RNBD es exposición real. La compensación es de orden de trabajo: la Fase
S0 —papeles y textos— va **antes** de la S2, que es la primera que
publica algo. Si la S0 no está cerrada, la S2 no se despliega.

**El plan Hobby de Vercel se pone más gris.** `PLAN-V2.md` §13.8 ya
concluyó que las donaciones cuentan como uso comercial y que con una
fundación de por medio la lectura se complica. Si la fundación tiene
personal asalariado cuyo trabajo incluye operar la plataforma, el
argumento de uso no comercial se debilita. Preguntar a soporte de
Vercel, no adivinar, y hacerlo antes de escalar.

**La moderación no está resuelta y el documento lo admite** (§9). El
módulo suma tres colas nuevas: teléfonos por verificar, referencias por
muestrear y reseñas reportadas. Sin alguien sosteniéndolas, las
insignias mienten. Mitigación dentro del código: nada nace verificado, y
los oficios de riesgo alto son invisibles hasta que alguien mire.

**Un directorio de personas es un directorio de personas.** Nombre,
teléfono, oficio y comuna, público y raspable. Es el precio de que el
módulo funcione, está consentido y es la finalidad declarada, pero
conviene decirlo en voz alta en el aviso de privacidad en vez de
enterrarlo.

---

## 5. Modelo de datos

Migraciones en `supabase/migraciones/`, convención `v3-s<n>-<slug>.sql`,
idempotentes, aplicadas con `node migracion/aplicar.mjs test <archivo>`.
Toda escritura pasa por RPC `security definer` con `set search_path =
''`, argumentos `p_`, actor derivado de `auth.uid()` o del token —nunca
de un argumento—, `revoke` de `public, anon` y `grant execute`
explícito. El molde es `crear_perfil` (`supabase/schema.sql:2227`).

### 5.1 Geografía y taxonomía

`zonas` — comuna, corregimiento o barrio, con llave a `municipios`.
Semilla: las 22 comunas y los 15 corregimientos de Cali (76001). Los
demás municipios no traen filas y la zona se escribe a mano en
`zona_texto`, con el mismo filtro que `solicitudes.barrio`. Un admin
puede sembrar zonas de otro municipio desde el panel.

`catalogo_oficios` — `id`, `grupo`, `nombre`, `riesgo`, `activo`,
`orden`. Grupos: comida, belleza, confección, transporte, aseo, cuidado,
reparación, otros. El comentario de tabla prohíbe agregar oficios de
matrícula —esos van en `catalogo_servicios`— y repite la prohibición de
rescate, búsqueda de personas y urgencias que ya lleva
`catalogo_servicios` (`schema.sql:43`).

Para «escribir el oficio si no aparece», se reusa `sugerencias_item`
extendiendo `origen` con `'proveedor'` y agregando `tipo in
('item','oficio')`. Una sola cola de sugerencias y un solo panel.

### 5.2 Proveedor

`proveedores` — dos dueños posibles y **solo uno a la vez**: cuenta de
Google (`perfil_id`) o token portador (`token_hash`, alta asistida),
sostenido por `check (num_nonnulls(perfil_id, token_hash) = 1)`.

El token se genera con `generarToken()`/`hashToken()` de
`src/lib/tokens.ts`, se muestra una vez y le da a quien no tiene cuenta
exactamente la misma puerta de habeas data que tiene hoy quien publica
una solicitud: ver, corregir y borrar sin pedirle permiso a nadie. Sin
eso, el alta asistida sería la fundación siendo dueña de los datos de
alguien, que es justo lo que la ley no quiere.

`organizacion_id` va en `on delete set null`, igual que
`solicitudes.organizacion_id`: si la fundación deja de operar, el
proveedor no pierde su perfil.

`proveedor_oficios` — la lista de oficios con su modo, precio «desde» y
unidad. Dos CHECK: solo `solidario` y `normal` pueden llevar precio, y
un precio exige unidad.

### 5.3 Referencias

`referencias` con `nombre_cifrado`, `telefono_cifrado` y
`telefono_hash`, usando `cifrar_texto`, `descifrar_texto` y
`hash_telefono` de `v2-e1-identidades.sql:69-190` y la llave del Vault
`aquive_identidad_key`. Estado: `pendiente`, `confirmada`,
`no_contesta`, `rechazada`.

`accesos_referencia` — espejo de `accesos_identidad`: llave en `set
null` con copia en texto, motivo obligatorio de 5 a 200 caracteres, sin
`UPDATE` ni `DELETE` para nadie.

Tabla propia y no `identidades` porque una referencia no entrega
documento y `identidades` lo exige por CHECK. Igual que allá: RLS activo
con **cero políticas**, `revoke all from anon, authenticated`, y las
únicas puertas son las RPC.

### 5.4 Demanda

`solicitudes_servicio` — token portador como las solicitudes de
emergencia, expira a 15 días. `capacidad_pago` (`puedo_pagar`,
`pago_poco`, `no_puedo_pagar`) es el enrutador del §3 del documento:
ordena lo que ve quien pide, poniendo primero los modos `gratis` y
`aporte`. **No es un filtro para proveedores**: nadie puede listar el
tablero por capacidad de pago, porque eso sería un directorio de quién
tiene menos.

`respuestas_servicio` — mensaje de 10 a 200 caracteres, filtrado por
`contiene_pii`, único por par solicitud-proveedor. El contacto del
proveedor ya está en su ficha; repetirlo en el mensaje solo abre un
hueco.

### 5.5 Confianza

`servicios_prestados` — `codigo_hash` único, `confirmado_at` nulo hasta
que el cliente lo usa, `expira_at` a 30 días.

`resenas` — `unique` sobre `servicio_id`, tres criterios de 1 a 3
(cumplimiento, trato, puntualidad), comentario y réplica de 140, y
`oculta` para moderación.

### 5.6 Moderación y métricas

Se extiende lo que existe en vez de duplicarlo:

- `reportes.tipo_objeto`: agregar `'proveedor'` y `'resena'`.
- `reportes.motivo`: agregar `'extorsion_resena'` y `'discriminacion'`,
  los dos riesgos que el §7 del documento nombra y que hoy no tienen
  casilla.
- `resolver_reporte`: manejar los dos objetos nuevos.

`metricas_servicio` — sin llave foránea, igual que `metricas`
(`schema.sql:685`), porque la fila padre no va a existir cuando se
consulte. Municipio, oficio, grupo, si hubo respuesta, si hubo
confirmación y horas hasta la primera respuesta. Se publica en `/datos`
filtrando `es_prueba = false`.

### 5.7 Vistas públicas

- `proveedores_publicos` — `where not suspendido and
  acepto_publicacion`, con oficios agregados, `servicios_confirmados`,
  `referencias_confirmadas` y los tres promedios. **Aplica la Regla S**:
  filtra los oficios de riesgo alto de proveedores sin teléfono
  verificado y sin referencia confirmada. Expone `telefono`, que es la
  razón de ser del módulo.
- `solicitudes_servicio_publicas` — sin `token_hash`, sin `es_prueba`.
- `resenas_publicas` — `where not oculta`.
- `municipios_con_proveedores`, `oficios_con_proveedores` — listas
  estrechas para los desplegables, como `municipios_con_servidores`.

### 5.8 Expiración

`expirar_servicios()`, nuevo job de `pg_cron` cada hora junto al de
`expirar-solicitudes` (`schema.sql:4691`):

1. Inserta en `metricas_servicio` por cada solicitud con `expira_at <=
   now()`, luego `delete` real (cascada a `respuestas_servicio`).
2. `delete` de `servicios_prestados` con `confirmado_at is null and
   expira_at <= now()`.

El perfil del proveedor no expira. Se borra por RPC.

---

## 6. Interfaz

Mobile first de verdad, solo tokens de color, píldoras, 48 px de alto
mínimo, Caprasimo solo en `h1` y `h2`. Ninguna librería nueva.

| Ruta | Qué es |
|---|---|
| `/servicios` | Buscador por oficio, municipio, zona, modalidad y modo de precio |
| `/servicios/[id]` | Ficha del proveedor con insignias, reseñas y contacto |
| `/servicios/soy-proveedor` | Alta y edición con cuenta de Google |
| `/servicios/mi-perfil/[token]` | Lo mismo sin cuenta, para el alta asistida |
| `/servicios/publicar` | Solicitud de servicio en tres pantallas |
| `/servicios/solicitud/[token]` | Respuestas, renovar, resolver, borrar |
| `/servicios/confirmar` | Escribir el código y dejar la reseña |

Pestañas añadidas: `/aliado` gana **Proveedores** (alta asistida,
verificación de teléfono, referencias por revisar) y `/admin` gana
**Servicios** (colas de verificación, moderación de reseñas,
`catalogo_oficios`, sembrar zonas).

Componentes nuevos: `tarjeta-proveedor.tsx`, `insignias-proveedor.tsx`,
`criterios-resena.tsx`, `selector-oficios.tsx` sobre `ui/combobox`,
`campos-referencia.tsx`, `aviso-seguridad-servicio.tsx`. Se reusan
`BotonReportar`, `SelectFiltro`, `FormularioFiltros`, `Pestanas`,
`Combobox` y `enlaceWhatsapp`.

**La portada tiene que distinguir las dos cosas en una línea.** Pedir
ayuda de emergencia, que se borra sola, y buscar o prestar un servicio,
que permanece. Si eso no se entiende en la primera pantalla, la promesa
de borrado del sitio queda desmentida por la existencia del directorio.

---

## 7. Lo que no es código

Bloqueantes, en el sentido de PLAN-V2 §12. Ninguno se resuelve
programando.

1. **Contrato de encargo firmado** con la Fundación Nodo Social, donde
   ella es responsable y AquíVe encargada. Es al revés de
   `docs/legal/CONTRATO-TRANSMISION.md`; hay que leerlo entero antes de
   escribir el nuevo.
2. **Registro del módulo en el RNBD** a nombre de la fundación.
3. **Canal de habeas data** con los plazos de 10 y 15 días hábiles de
   los artículos 14 y 15, atendido por la fundación.
4. **Texto de autorización del proveedor** y **texto de consentimiento
   de la persona que sirve de referencia**, los dos en
   `docs/legal/PLANTILLAS.md` y los dos revisados por abogado.
5. **Revisión jurídica de la ampliación de alcance** a transporte y
   cuidado de personas. Es donde más crece la exposición del proyecto.
6. **Reescribir los términos §3.** Hoy dicen literalmente «No hay
   estrellas, ni reputación, ni sellos de "confiable", y no los va a
   haber». Van a existir, y el texto tiene que explicar qué los sostiene
   —código de servicio, teléfono verificado, referencia— en vez de
   fingir que la frase anterior nunca estuvo.
7. **Reescribir el aviso de privacidad en dos regímenes**, sin diluir la
   promesa actual: «si publicas una solicitud de ayuda no guardamos
   ningún dato tuyo» sigue siendo cierta y tiene que seguir leyéndose
   así de fuerte.
8. **Consulta a Vercel** sobre el plan Hobby con una fundación de por
   medio (§4).

---

## 8. Orden de trabajo

| Fase | Contenido | Se puede desplegar |
|---|---|---|
| **S0** | Este documento, ediciones a `CLAUDE.md`, `config.ts`, textos legales, contrato y plantillas | Sí, no hay producto todavía |
| **S1** | `v3-s1-esquema.sql`, `seed-oficios.sql`, `seed-zonas.sql` | Sí, tablas vacías |
| **S2** | RPC de proveedor, `/servicios`, ficha, alta con Google | **Solo con S0 cerrada** |
| **S3** | Alta asistida, token de perfil, verificación de teléfono, pestaña de aliado | Sí |
| **S4** | Referencias cifradas, `accesos_referencia`, muestreo en admin | Sí |
| **S5** | Solicitud de servicio, respuestas, gestión por token, `expirar_servicios()` | Sí |
| **S6** | Códigos de servicio, reseñas, réplica, `/servicios/confirmar` | Sí |
| **S7** | Reportes ampliados, moderación, `metricas_servicio`, `/datos` | Sí |

---

## 9. Verificación

No hay marco de pruebas en el repositorio y no se introduce uno para
esto. Se sigue lo que ya se usa: SQL de comprobación más lista de humo.

`supabase/pruebas/servicios.sql` — un bloque `do $$ … $$` con `assert`
por fase. Se corre contra el entorno de prueba después de cada migración
y falla ruidosamente, deshaciendo la transacción entera:

```
cp supabase/pruebas/servicios.sql supabase/migraciones/_tmp-pruebas.sql
node migracion/aplicar.mjs test _tmp-pruebas.sql
rm supabase/migraciones/_tmp-pruebas.sql
```

El copiado es porque `aplicar.mjs` solo lee de `supabase/migraciones/`.
Y conviene comprobar de vez en cuando que los `assert` de verdad se
evalúan —un `do $$ begin assert false, 'canario'; end; $$` tiene que
fallar—: si `plpgsql.check_asserts` estuviera en off, este archivo
pasaría siempre y no probaría nada.

Lo que sostiene, por fase:

- **S1** · La regla S en sus tres estados: sin nada, con teléfono
  verificado solo, y con referencia apenas pendiente — en los tres el
  oficio de riesgo sigue escondido, y un proveedor sin ningún oficio
  publicable no aparece en absoluto. Más los CHECK de dueño único y de
  precio, el `unique` de reseña, que el rastro de acceso sobreviva a la
  referencia, que `anon` no lea `referencias`, y que
  `expirar_servicios()` borre y deje métrica.
- **S2** · Que `guardar_proveedor` rechace PII en la descripción, zona de
  otro municipio, las dos zonas a la vez, oficio inventado y guardado sin
  autorización; que un precio en modo gratis se descarte; que cambiar el
  teléfono tumbe la verificación; y que `ficha_proveedor` no devuelva
  fichas suspendidas.
- **S3** · Sin sesión —el peor caso— ninguna RPC del equipo deja hacer
  nada: ni verificar, ni suspender, ni dar de alta a nombre de una
  organización ajena.
- **S4** · Que el nombre no quede en claro en `nombre_cifrado`; que el
  mismo teléfono escrito distinto no cuente dos veces; el tope de tres;
  que `mis_referencias` no devuelva los datos del tercero; que nadie
  descifre sin permiso; y que un motivo de un carácter falle **antes** de
  mirar si la referencia existe.
- **S5** · Que la nota rechace teléfono y correo; que responder exija
  ficha publicada; que un proveedor suspendido desaparezca de las
  respuestas; que una solicitud resuelta no admita más respuestas; y que
  borrar a mano deje la métrica.
- **S6** · Que el código no quede en claro en ninguna parte —tampoco en
  `mis_servicios`—, que sirva una sola vez, que vencido no sirva, que se
  acepte escrito con espacios y en minúsculas, y que un intento fallido
  no lo queme.
- **S7** · Que resolver un reporte, ver el panel y tocar los catálogos
  exija ser administrador, y que una fila `es_prueba` no se cuele en los
  datos abiertos.

**Manual.** `migracion/99-verificar.sql` trae los puntos 13 a 17 del
módulo: catálogos sembrados, que los cuatro oficios de riesgo sigan en
`alto`, que `referencias` y `accesos_referencia` estén revocadas para los
dos roles del cliente, que el job `expirar-servicios` exista, y que
ningún hash ni ningún `bytea` cifrado se haya colado en una vista.

Y en el navegador: publicar una solicitud y ver que el token aparece una
sola vez; dar de alta un proveedor con Google y verlo en el directorio;
dar de alta uno asistido y entrar con su token a corregirse y borrarse;
generar un código, confirmarlo desde otro navegador, dejar reseña y
responderla; reportar la reseña y resolverla desde el panel; y comprobar
en las herramientas de red que ni el token ni el código aparecen nunca
en una URL.
