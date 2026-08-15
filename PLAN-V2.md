# Plan v2 — AquíVe con dos flujos

> **Para pegar en Claude Code.** Amplía `CLAUDE.md` y
> `docs/ESPECIFICACION.md`; no los reemplaza. Lee §1 antes de codificar:
> el proyecto pasa de tener un flujo a tener dos, y la mayoría de las
> reglas duras de v1 **siguen vigentes** porque el flujo actual sobrevive
> intacto.
>
> §5.4 (trampas del esquema real), §5.7 (ciclo de vida y borrado) y §12
> (huecos) son donde está el detalle que evita romper producción. No los
> saltes.

---

## 1. La idea en una página

Hoy AquíVe tiene un solo flujo: solicitud anónima, respuesta de un
ofertador, contacto por WhatsApp fuera de la plataforma, borrado a 72h.
Funciona en todo el país y no depende de nadie más.

Apareció una fundación aliada dispuesta a coordinar entregas físicas en un
territorio concreto. Eso permite algo hoy imposible —verificar que quien
recibe lo necesita, y que quien entrega no tenga que verse con nadie— pero
**solo donde haya aliado**.

La respuesta no es migrar. Es tener dos:

| | **Flujo 1 · Directo** | **Flujo 2 · Acompañado** |
|---|---|---|
| Disponible en | Todo el país | Solo municipios con aliado |
| Identidad del solicitante | Ninguna | Nombre, documento, teléfono |
| Contacto | WhatsApp, por fuera | Chat en la app, siempre con el aliado |
| Verificación | **Ninguna, y se dice** | Aliado verifica en persona |
| Entrega | Entre las dos personas | En el acopio, sin encontrarse |
| Al cerrar | Borrado duro a 72h | Borrado duro, igual |
| Es el | **Predeterminado** | Opcional, se elige |

**Flujo 1 es el camino por defecto.** No es la versión degradada: es lo que
ya funciona y lo que va a usar la mayoría. Lo único que cambia es que ahora
el ofertador puede registrar qué tiene, y eso habilita el cruce en los dos
sentidos.

**Flujo 2 es una opción informada.** Se ofrece donde hay aliado, se explica
qué gana y qué entrega a cambio, y se puede activar después de publicar.

### Por qué esto es mejor que migrar todo

- La protección jurídica de v1 —sin PII no hay titular— **sigue intacta
  para la mayoría de las solicitudes**.
- El alcance geográfico no se reduce. Nadie fuera de Cali pierde nada.
- El hueco "no hay aliado en este municipio" desaparece: donde no hay, no
  se ofrece.
- Sin retención larga, el borrado duro vuelve a ser la regla única y el
  aviso de privacidad vuelve a ser simple de escribir y de cumplir.

---

## 2. Reglas duras — qué cambia y qué no

Las seis reglas de `CLAUDE.md` **siguen aplicando completas al Flujo 1**.
Al Flujo 2 se le aplican con excepciones acotadas y explícitas.

| Regla v1 | Flujo 1 | Flujo 2 |
|---|---|---|
| **1** · Cero datos personales del solicitante | Intacta | **Excepción acotada**: nombre, documento y teléfono, cifrados y aislados (regla K) |
| **2** · Sin texto libre sin restricción | Intacta | Intacta, **y se extiende al chat** (regla M) |
| **3** · El contacto nunca pasa por la plataforma | Intacta | **Invertida**: es obligatorio que pase (regla L) |
| **4** · Borrado duro, TTL 72h, sin PITR | Intacta | **Intacta.** Chat e identidad mueren con la solicitud |
| **5** · Alcance cerrado de servicios | Intacta | Intacta |
| **6** · Sin PII en logs ni URLs | Intacta | Intacta y **más crítica** |

**Sobre el párrafo final de la regla 5.** `CLAUDE.md:101-105` dice que el
proyecto lo opera "una sola persona natural, que responde con su patrimonio"
y llama a eso "la principal medida de protección jurídica del proyecto". Eso
**no se borra: se reemplaza** por el reparto de responsabilidades del Flujo 2
(fundación responsable del tratamiento, tú encargado). Para el Flujo 1 sigue
siendo literalmente cierto y sigue siendo la razón del alcance cerrado.
`src/lib/config.ts → RESPONSABLE` tiene efecto legal y hay que revisarlo en
la Fase F: aparece en el texto de autorización que ahora firman también los
solicitantes del Flujo 2.

### Reglas nuevas, solo para el Flujo 2

**K · La identidad vive cifrada, aislada y con fecha de muerte.**
Nombre, documento y teléfono no van en `solicitudes` ni en `perfiles`. Van
en `identidades`, cifrados con llave del Vault. La identidad de un
solicitante **cuelga de su solicitud y muere con ella**; la de un ofertador
o aliado cuelga de su perfil y muere con la cuenta (§5.7). Ninguna vista
pública las toca. Ninguna consulta del cliente las alcanza.

**L · Ninguna conversación puede ser bilateral.** Un hilo sin aliado
asignado no acepta mensajes. Sin excepción, sin decisión de los
participantes. Es la razón de ser del Flujo 2: si se permite el aparte, no
queda nada que lo distinga del Flujo 1 salvo la recolección de datos, que
sería lo peor de los dos mundos.

**M · El chat filtra datos de contacto.** Teléfonos, correos, `wa.me`,
`t.me`, arrobas y dígitos en letras se **rechazan al enviar**. Coherente con
la regla 2, y sin esto la regla L es decorativa.

**N · Cada lectura de identidad deja rastro.** `accesos_identidad` guarda
quién, cuándo, qué identidad y con qué motivo. **Sobrevive al borrado de la
identidad** —queda el uuid, sin ningún dato personal— y es la evidencia de
diligencia frente a la fundación y frente a la SIC.

**O · Sin datos de menores.** Documentos aceptados: CC, CE, PEP, PPT. **TI y
RC prohibidos por CHECK en la base**, no por validación de UI.

**P · El documento se hashea con pepper.** Una cédula tiene ~10 dígitos: un
`sha256` sin pepper se rompe por fuerza bruta con un volcado de la base. El
pepper vive en el Vault, nunca en el repositorio.

**Q · La plataforma no es el archivo de la fundación.** No guardamos
constancia con datos personales. La fundación exporta su planilla **en el
momento de la entrega** y la custodia en sus propios sistemas, como
responsable que es. Aquí sobrevive el registro de entrega **sin PII**: qué
ítems, qué organización, cuándo, en qué municipio.

**R · Elegir el Flujo 2 nunca puede ser el camino de menor resistencia.**
El botón grande es publicar directo. El Flujo 2 se ofrece, se explica y se
acepta — no se preselecciona, no se pide dos veces, no se pinta en rojo la
opción anónima. Pedir más datos de los necesarios porque la UI empujó hacia
allá es exactamente el daño que la regla 1 existe para evitar.

---

## 3. Honestidad sobre el Flujo 1

El Flujo 1 no verifica a nadie, y eso hay que decirlo donde la gente lo lea,
no enterrado en los términos.

**Dónde aparece** (breve, en lenguaje llano, sin bloquear):

- En la tarjeta de cada solicitud del tablero, una línea discreta.
- En la pantalla de confirmación de publicación.
- Antes de que el ofertador abra WhatsApp: el paso donde de verdad decide.
- En `/terminos`, con el detalle.

**Qué dice**, en este tono: *"AquíVe no verifica quién publica ni quién
responde. Confirma lo que puedas antes de acordar una entrega, y prefiere
lugares públicos."*

**Qué NO dice**: nada que sugiera que la plataforma respalda, avala o
recomienda a alguien. Ni sellos de "confiable", ni estrellas, ni reputación.
Un sistema de reputación sin verificación de identidad es una invitación al
fraude por acumulación, y además arrastra responsabilidad hacia ti.

**Consejos de seguridad**, en una página corta enlazada desde el aviso:
lugares públicos y de día, no dar dirección exacta hasta acordar, no pagar
por adelantado nada, avisarle a alguien. Sin dramatismo.

Donde exista aliado, este mismo aviso lleva la frase que abre el Flujo 2:
*"En tu municipio hay una fundación que puede coordinar la entrega por ti."*

---

## 4. Roles

| Rol | Autenticación | Qué guardamos |
|---|---|---|
| **Solicitante F1** | Token portador, sin cuenta | **Nada personal**, igual que hoy |
| **Solicitante F2** | Token portador, sin cuenta | Nombre, documento, teléfono — cifrados, mueren con la solicitud |
| **Ofertador** | Google (`sub`) | Perfil público + **inventario** (nuevo) |
| **Ofertador que entra a un F2** | Google (`sub`) | + documento cifrado, muere con la cuenta |
| **Servidor** | Google (`sub`) | Igual que v1 |
| **Aliado** | Google (`sub`) + membresía | Perfil + documento + cargo |
| **Administrador** | Google (`sub`) + `administradores` | — |

El solicitante **nunca crea cuenta**, en ninguno de los dos flujos. Sigue
siendo token portador con QR.

`aliado` es el nombre técnico. `organizaciones.tipo` acepta
`'fundacion' | 'centro_acopio' | 'jac' | 'parroquia' | 'alcaldia'`.

---

## 5. Modelo de datos

### 5.1 Lo que necesitan los DOS flujos

```
ofrecimientos                     -- inventario del ofertador. Sin PII.
  id, perfil_id, item_id, sugerencia_id,
  cantidad numeric NULL,          -- ⚠ NULLABLE, a diferencia de
                                  -- solicitud_items.cantidad. Ver §6.1
  disponible, actualizado_at
  CHECK (num_nonnulls(item_id, sugerencia_id) = 1)
  CHECK (cantidad is null or cantidad > 0)
  -- Sin columna de categoría a propósito: un ofertador cruza categorías
  -- libremente. Y sin filas no pasa nada: el inventario es OPCIONAL (§6.1).

-- ⚠ UNIQUE de tabla NO admite WHERE. Van como índices parciales:
create unique index ofrecimientos_item_uniq
  on public.ofrecimientos (perfil_id, item_id) where item_id is not null;
create unique index ofrecimientos_sug_uniq
  on public.ofrecimientos (perfil_id, sugerencia_id)
  where sugerencia_id is not null;

sugerencias_item
  id, nombre_propuesto, categoria_sugerida, unidad_sugerida,
  propuesta_por, origen ('solicitante'|'ofertador'|'aliado'),
  estado ('pendiente'|'aprobada'|'rechazada'|'fusionada'),
  item_resultante_id text,        -- FK a catalogo_items.id, que es TEXT
  revisada_por, revisada_at, nota_revision
```

Cambios en tablas existentes:

```
solicitudes
  + flujo text not null default 'directo'
        CHECK (flujo in ('directo','acompanado'))
  + organizacion_id uuid          -- null en flujo directo
  ~ estado: agregar 'en_coordinacion', 'entregada_parcial'
            ⚠ ver §5.4-1 y §5.7
  -- NO lleva identidad_id. La FK va al revés, ver §5.7

solicitud_items
  + sugerencia_id uuid
  + cubierto_at, + cubierto_por
  ~ item_id pasa a nullable, CHECK num_nonnulls(item_id, sugerencia_id)=1
  ~ `cubierto` boolean SE MANTIENE: la vista de cruce y la UI lo leen

catalogo_items
  + creado_por uuid, + origen ('semilla'|'admin'|'aliado'|'sugerencia')

metricas
  + flujo text, + con_aliado boolean
  -- metricas NO tiene ninguna FK (schema.sql:206). Ya sobrevive al
  -- borrado por construcción; no hay nada que ajustar ahí.
```

### 5.2 Lo que solo necesita el Flujo 2

```
organizaciones                    -- LA CREA UN ADMIN. Ver §5.7
  id, nombre, tipo, nit UNIQUE,
  slug text UNIQUE,               -- 3-40, [a-z0-9-]. Identifica, no autoriza
  municipios text[], direccion_acopio, horario_acopio,
  activa, creada_por, creada_at
  -- Sin `verificada`: si la fila existe, un admin ya verificó RUES y NIT
  -- antes de crearla. `activa` es lo único que hace falta para suspender.

invitaciones_organizacion
  id, organizacion_id, codigo text UNIQUE,   -- aleatorio, va en enlace y QR
  rol_otorgado ('coordinador'|'miembro'),
  creada_por, expira_at, usos_max int, usos int default 0,
  activa, creada_at

miembros_organizacion
  organizacion_id, perfil_id,
  rol ('coordinador'|'miembro'),
  estado ('pendiente'|'activo'|'inactivo'),
  puede_ver_identidad bool default false,    -- ⚠ nunca automático
  puede_moderar bool default false,
  invitacion_id uuid, creado_at, aprobado_por, aprobado_at
  PK (organizacion_id, perfil_id)

identidades                       -- CIFRADA. Ver §5.7 para el ciclo de vida.
  id,
  solicitud_id uuid references solicitudes(id) on delete cascade,
  perfil_id    uuid references perfiles(id)    on delete cascade,
  CHECK (num_nonnulls(solicitud_id, perfil_id) = 1),
  titular_tipo ('solicitante'|'ofertador'|'aliado'),
  nombre_cifrado bytea,
  documento_tipo ('CC'|'CE'|'PEP'|'PPT'),    -- CHECK excluye TI y RC
  documento_cifrado bytea,
  documento_hash text,            -- sha256(documento || pepper del Vault)
  documento_ultimos4 text,        -- en claro, deliberado — ver §5.6
  telefono_cifrado bytea, telefono_hash text,
  autorizacion_version, autorizacion_at, creada_at

accesos_identidad                 -- SOBREVIVE a la purga. Sin PII.
  id,
  identidad_id uuid references identidades(id) on delete set null,
  identidad_ref text not null,    -- copia del uuid en texto
  leida_por uuid references auth.users(id) on delete set null,
  lector_ref text not null,       -- copia, para que sobreviva al borrado
  rol_lector, motivo, leida_at

conversaciones
  id,
  solicitud_id uuid references solicitudes(id) on delete cascade,
  ofertador_id uuid references perfiles(id) on delete set null,
  aliado_id    uuid references perfiles(id) on delete set null,
  organizacion_id uuid,
  estado ('esperando_aliado'|'asignada'|'abierta'|'acordada'
          |'entregada'|'cerrada'),
  creada_at, cerrada_at
  UNIQUE (solicitud_id, ofertador_id)

mensajes                          -- CASCADE desde conversaciones
  id, conversacion_id, autor_rol, autor_perfil_id,
  cuerpo (<=1000), creado_at, oculto, oculto_por, oculto_at

entregas                          -- ⚠ NO cascade. Ver §5.7
  id, organizacion_id, municipio, item_id, sugerencia_id, cantidad,
  recibido_at, confirmada_por_solicitante_at,
  solicitud_codigo text,          -- copia sin FK
  conversacion_id uuid references conversaciones(id) on delete set null
```

`perfiles` gana el tipo `'aliado'` (§5.4-2). **No** gana `identidad_id`.

### 5.3 Trampas del esquema actual — leer antes de migrar

**1 · Los estados nuevos rompen cuatro cosas.**

| Objeto | Línea | Qué pasa |
|---|---|---|
| `solicitudes_publicas` | `:246` filtra `estado = 'abierta'` | La solicitud **desaparece del tablero** al entrar en coordinación |
| `municipios_con_solicitudes` | `:275` | Mismo filtro, mismo efecto |
| `responder_solicitud` | `:776` exige `'abierta'` | Nadie más puede ofrecer — choca con la entrega parcial |
| `renovar_solicitud` | `:556` filtra `'abierta'` | **No se puede renovar** |

Corrección: predicado `estado_activo(estado)` que cubra `abierta`,
`en_coordinacion` y `entregada_parcial`, usado en los cuatro sitios, en la
misma migración que introduce los estados. **Y ver §5.7-3**, porque
`expirar_solicitudes()` es un problema aparte y peor.

**2 · `crear_perfil` rechaza `'aliado'` en duro.**
`schema.sql:693`: `if p_tipo not in ('ofertador','servidor') then raise`, y
su rama `else` hace `delete from servidores`. No basta con ampliar el CHECK:
hay que modificar la RPC.

En `src/lib/types.ts` hay que tocar **tres** tipos, no uno:
`TipoPerfil` (`:15`), `EstadoSolicitud` (`:19`, fijo a `'abierta'|'cumplida'`)
y `ItemResumen` (`:38`, cuya `unidad: string` deja de estar garantizada con
el `left join` del punto 5). El propio archivo lo pide en su línea 2.

**3 · `perfiles.contacto_publico` es `not null`, longitud 7–40.**
`schema.sql:56`. Un aliado no cabe. Hazlo nullable con CHECK condicional:
obligatorio para `ofertador` y `servidor`, opcional para `aliado`.

**4 · `es_admin()` no sirve dentro de políticas RLS.**
Tiene `EXECUTE` revocado (`:101`); `using (public.es_admin(...))` falla con
*permission denied* **para todo el mundo**. Las políticas nuevas hacen el
`EXISTS` a mano contra `administradores`, como las existentes.

> **Con `miembros_organizacion` no basta con copiar ese patrón.**
> `administradores` funciona porque su policy es de fila propia (`:418`). Si
> una policy de `conversaciones` hace `EXISTS` contra `miembros_organizacion`
> y la policy de `miembros_organizacion` referencia `conversaciones`, hay
> recursión infinita. Define la policy de `miembros_organizacion` como fila
> propia (`perfil_id = auth.uid()`), o encapsula la pertenencia en una
> función `security definer` **con `EXECUTE` concedido** — al revés que
> `es_admin()`, justamente para que sí sirva dentro de una policy.

**5 · Los ítems sugeridos desaparecen del INNER JOIN.**
`solicitudes_publicas` (`:242`) y `leer_solicitud` (`:530`) hacen
`join catalogo_items c on c.id = si.item_id`. Un ítem con solo
`sugerencia_id` no se vería ni en el tablero ni en la pantalla del propio
solicitante.

Corrección: `left join` a `catalogo_items`, `left join` a
`sugerencias_item`, y **`coalesce` de las tres columnas, no solo del
nombre**: la agregación usa `c.nombre`, `c.unidad` y `order by c.orden`. Con
`left join` a secas, `unidad` queda `NULL` y `describirItem()` en
`src/lib/catalogo.ts` renderiza literalmente *"3 null de Crema dental"* en
el tablero público — un cambio del Flujo 2 degradando el Flujo 1.

**6 · El `PATRON_PII` está duplicado en SQL.**
`src/lib/validacion.ts:3` y `crear_solicitud` (`schema.sql:468`) aplican el
mismo regex, y el comentario del archivo lo advierte. Cualquier RPC nueva
que reciba nota o barrio debe conservarlo.

**7 · `crear_solicitud` necesita `DROP`, no `CREATE OR REPLACE`.**
Agregarle un 7º parámetro con `create or replace` **no reemplaza** la
función de 6 argumentos: crea una sobrecarga. La vieja sigue con `grant` a
`anon` (`:492`), y PostgREST —que resuelve la RPC por el conjunto de claves
del body— devolverá **`PGRST203: could not choose the best candidate
function`** en cada `POST /rpc/crear_solicitud`. Es decir: el Flujo 1 deja
de funcionar entero.

Corrección: `drop function public.crear_solicitud(text,text,text,text,jsonb,text);`
y recrear con la firma nueva más su `grant execute`.

**8 · `crear_solicitud` no sabe insertar ítems sugeridos.**
Inserta `v_item->>'item_id'` a pelo (`:483-486`). Con el nuevo
`CHECK num_nonnulls(item_id, sugerencia_id)=1`, publicar con un ítem
sugerido **falla**. Hay que tocar también la escritura, no solo la lectura.

### 5.4 El cruce, y por qué no puede ser una vista pública

Instinto natural: una vista `matches_potenciales` con
`security_invoker = on`. **No funciona**, por dos razones del esquema real:

- `solicitudes` tiene `revoke all ... from anon, authenticated` (`:355`) y
  RLS activa **sin ninguna policy de `select`** (`:343`). Un aliado
  autenticado consultándola recibe *permission denied for table
  solicitudes*, no una lista filtrada.
- `perfiles` solo deja leer la fila propia (`:377`), así que el join
  vaciaría el resultado igual.

Y además `p.municipios` es del **ofertador**, no del lector: la vista no
filtra por el territorio del aliado en ningún lado.

**Diseño correcto**, coherente con el patrón que ya usa el proyecto
(tabla revocada + RPC como frontera):

```sql
-- Vista interna. SIN grant a anon ni authenticated.
create view public.v_cruces as
select
  s.id as solicitud_id, s.codigo, s.municipio, s.flujo,
  o.perfil_id as ofertador_id,
  count(*) as items_coincidentes,
  jsonb_agg(...) as detalle
from public.solicitud_items si
join public.solicitudes s on s.id = si.solicitud_id
join public.ofrecimientos o
     on (o.item_id is not null and o.item_id = si.item_id)
     or (o.sugerencia_id is not null and o.sugerencia_id = si.sugerencia_id)
join public.perfiles p on p.id = o.perfil_id
where si.cubierto = false
  and o.disponible = true
  and public.estado_activo(s.estado)
  and s.expira_at > now()
  and s.municipio = any(p.municipios)
  and p.tipo = 'ofertador'          -- ⚠ imprescindible
  and p.suspendido = false
group by 1,2,3,4,5;

revoke all on public.v_cruces from anon, authenticated;
```

Se consume solo desde `coincidencias_para_aliado()`, una RPC
`security definer` que:

1. Verifica que quien llama es miembro con `estado = 'activo'` de una
   organización con `activa = true` (§5.5).
2. Filtra `s.municipio = any(organizacion.municipios)`.
3. **Filtra `s.flujo = 'acompanado'`.** Sin esto, el aliado ve solicitudes
   anónimas del Flujo 1 en su panel y el botón "Conectar" arrastraría a un
   solicitante que nunca aceptó nada a un chat interno — violando la regla 3
   para el Flujo 1 y la regla R de golpe.

El filtro público de §6.2 **no usa esta vista**. Ver ahí.

### 5.5 Cómo nace un aliado

Dos actos separados, y esa separación es la que aguanta el peso:

**1 · La organización la crea un administrador.** Nunca se auto-registra.
Desde `/admin`, con nombre, tipo, NIT, municipios, dirección de acopio,
horario y **slug**. El admin ya verificó RUES y NIT antes de crear la fila —
por eso no hay cola de verificación ni columna `verificada`: si la
organización existe, es porque alguien la miró.

Al crearla, el admin genera la **invitación de coordinador** y le pasa ese
enlace a la persona de contacto de la fundación. Quien lo abre e inicia
sesión con Google queda como primer coordinador. Así el admin no necesita
saber de antemano qué cuenta de Google usa esa persona.

**2 · Los miembros se auto-registran contra esa organización.** No hay lista
desplegable de organizaciones en ningún lado: quien se une tiene que traer el
slug. Dos caminos:

| Camino | Cómo llega | Queda en |
|---|---|---|
| **Enlace o QR** | `/unirse/[slug]?c=<código>` — el coordinador lo genera desde su panel | `estado = 'activo'` de una vez |
| **Escribiendo el slug** | Campo de texto en `/registro`, sin código | `estado = 'pendiente'` hasta que un coordinador apruebe |

> **Por qué no basta con esconder la lista.** Un slug es adivinable por
> definición: `fundacion-manos-cali` se acierta al segundo intento. No
> mostrar el listado sube el costo del ataque, no lo cierra. Lo que lo cierra
> es la combinación: **el slug identifica, el código autoriza**, y quien
> llega sin código cae en una cola de aprobación donde no ve absolutamente
> nada.

**3 · `puede_ver_identidad` nunca se otorga solo.** Ni al entrar por enlace,
ni al ser aprobado, ni al ser coordinador. Siempre es un acto explícito de un
coordinador sobre un miembro concreto, y queda registrado. Es el permiso más
sensible del sistema: es lo que deja ver cédulas.

**4 · Qué puede hacer un coordinador.** Invitar (generar enlaces y QR),
aprobar o rechazar pendientes, otorgar y quitar `puede_ver_identidad` y
`puede_moderar`, desactivar miembros, y ascender a otro a coordinador.
**No puede quedar la organización sin coordinador**: el último no se puede
degradar ni desactivar a sí mismo.

**5 · Un miembro pendiente o inactivo no ve nada.** Ni solicitudes, ni
conversaciones, ni identidades, ni coincidencias. Panel vacío con el aviso de
que su ingreso está por aprobar. Es la misma regla que ya aplicaba a las
organizaciones sin verificar, movida al nivel donde ahora importa.

**6 · Las invitaciones caducan y se agotan.** `expira_at` y `usos_max`. Una
invitación de coordinador es de un solo uso. Un QR para pegar en la pared de
la fundación puede tener varios usos y un mes de vigencia — pero que sea
decisión del coordinador, con el costo explicado en pantalla.

**7 · Suspender.** El admin desactiva la organización (`activa = false`); el
coordinador desactiva miembros. Si una organización se desactiva con hilos
vivos, se dispara el fallback de §8-F5: los hilos van a la cola del admin y
las solicitudes se devuelven a Flujo 1 con aviso.

### 5.6 La columna en claro, y por qué

`documento_ultimos4` no está cifrada. Los hashes tampoco, pero llevan pepper
del Vault (regla P) y sin ese secreto no son reversibles.

`documento_ultimos4` existe para que el aliado reconozca a quién tiene
enfrente sin descifrar nada. Cuatro dígitos no identifican a nadie por sí
solos, pero **no pueden aparecer en pantallas públicas, ni en QR, ni en
URLs** (regla 6).

### 5.7 Ciclo de vida y borrado — la sección crítica

Aquí es donde un descuido deja cédulas cifradas huérfanas para siempre, o
borra la evidencia que hay que conservar. Cinco decisiones:

**1 · La FK de identidad va de `identidades` hacia afuera, no al revés.**
El instinto es poner `solicitudes.identidad_id`. **Está mal**: un
`ON DELETE CASCADE` ahí significa *"si borro la identidad, borro la
solicitud"*, y borrar la solicitud dejaría la identidad **huérfana, cifrada
y para siempre** — lo contrario exacto de la regla K.

Correcto: `identidades.solicitud_id → solicitudes(id) on delete cascade`
para solicitantes, y `identidades.perfil_id → perfiles(id) on delete
cascade` para ofertadores y aliados, con `CHECK` de que exactamente una está
puesta. Nada de `identidad_id` en `solicitudes` ni en `perfiles`.

**2 · La identidad del ofertador tiene otro ciclo, y hay que decírselo.**
No cuelga de ninguna solicitud: el ofertador la da una vez y sirve para
todas sus entregas. Muere con su cuenta, que él puede borrar cuando quiera
(la funcionalidad ya existe). En el momento de pedírsela hay que decir
exactamente eso: *"Se guarda mientras tengas cuenta. Si borras tu cuenta,
se borra."*

**3 · `expirar_solicitudes()` borra sin mirar el estado.**
`schema.sql:912-936` hace `delete from solicitudes where expira_at <= now()`
**sin condición de estado**. Una solicitud en `en_coordinacion`, con entrega
agendada en el acopio para mañana, se borra a las 72h con chat e identidad
incluidos, salvo que el solicitante renueve a mano. Arreglar `renovar_solicitud`
(§5.3-1) devuelve la *capacidad* de renovar, no evita el borrado.

Corrección: mientras exista una conversación en estado distinto de
`cerrada`, la solicitud se auto-renueva, **con techo duro de 14 días** para
que no viva indefinidamente. Al llegar al techo se cierra, se notifica a los
tres y se borra normal.

Segundo defecto de la misma función: inserta `cumplida = false` para todas.
Una `entregada_parcial` debe registrar que sí hubo entrega, o `metricas`
—que es el aporte que sobrevive al proyecto— miente.

**4 · Hay dos rutas de borrado más que el plan tiene que cubrir.**

- `resolver_reporte` (`:885-892`) hace `delete from solicitudes` directo: un
  moderador puede destruir una coordinación en curso sin métrica y sin
  avisarle al aliado. Debe cerrar los hilos y notificar antes de borrar.
- La policy `"perfil propio delete"` (`:384`) deja a cualquiera borrar su
  perfil, y `README.md:44` marca eso como implementado. Si las FK nuevas
  (`conversaciones.ofertador_id`, `conversaciones.aliado_id`,
  `accesos_identidad.leida_por`) quedan en el `NO ACTION` por defecto, **el
  borrado de cuenta empieza a fallar**; si se ponen en `CASCADE`, se llevan
  la bitácora que la regla N promete conservar. Van en `ON DELETE SET NULL`,
  con la copia de texto al lado. El esquema ya tiene el precedente comentado
  en `servidores.verificado_por` (`:77-80`) — sigue ese razonamiento.

**5 · Qué sobrevive, exactamente.** Ninguna de las tres con datos
personales:

| Tabla | Qué queda | Por qué sobrevive |
|---|---|---|
| `metricas` | Municipio, categoría, cumplida, tiempos, flujo | No tiene FK (`:206`): sobrevive por construcción |
| `entregas` | Ítems, cantidad, organización, municipio, fecha | `conversacion_id` en `SET NULL` + `solicitud_codigo` en texto |
| `accesos_identidad` | uuid, quién leyó, cuándo, motivo | `identidad_id` y `leida_por` en `SET NULL` + `identidad_ref` y `lector_ref` en texto |

---

## 6. El cruce en dos sentidos — Flujo 1

Esto es lo que le falta hoy a la app y sirve a los dos flujos.

### 6.1 El ofertador registra qué tiene

En `/registro` y editable desde el perfil: sección **"Qué tengo para dar"**,
con el mismo catálogo que usan los solicitantes, cantidad, y el botón de
sugerir ítem. Se guarda en `ofrecimientos`. Un servidor hace lo mismo con
`catalogo_servicios`.

**Es opcional, y esto no es negociable.** Cuatro razones:

- Ya hay ofertadores registrados en producción sin inventario. Obligarlo
  les pone un muro de migración a gente que se registró bien.
- **Hay precedente en el mismo formulario**: `serviciosIds` para servidores
  ya es opcional — `puedeGuardar` en `formulario-registro.tsx` exige
  nombre, municipios, contacto y autorización, pero no la lista de
  servicios. Hacer obligatorio el inventario sería incoherente.
- Muchos ofertadores son reactivos: no tienen bodega inventariada, ven una
  solicitud y piensan "eso lo tengo yo". Obligarlos a declarar stock por
  adelantado produce datos inventados, y datos inventados envenenan el
  cruce.
- Es la regla R aplicada al otro lado: no metas fricción en el camino que
  ya funciona.

Lo que sí hay que hacer es decir en pantalla qué se pierde al dejarlo
vacío: *"Si nos cuentas qué tienes, te avisamos cuando alguien cerca lo
necesite y la fundación puede conectarte directamente. Puedes llenarlo
después."* Sin inventario no aparece en las coincidencias del aliado ni
recibe avisos, pero navega y responde igual que hoy.

**Varias categorías, sin tope.** `ofrecimientos` es una fila por ítem y no
tiene columna de categoría: arroz, cobijas y acetaminofén conviven sin
problema. No hay límite de cuántos ítems guarda porque va por `POST`, no
por URL.

> **Dato del esquema que conviene tener presente:** `crear_solicitud` **no
> valida que los ítems pertenezcan a `p_categoria`** — inserta cualquier
> `item_id` que le pasen (`schema.sql:483-486`). O sea que
> `solicitudes.categoria` ya es hoy una etiqueta para el filtro del tablero,
> no una restricción, y una solicitud ya puede mezclar categorías. Lo que
> sí valida es el rango de **1 a 12 ítems** (`:471`). No confundas ese tope
> con el de ~10 del filtro público de §6.2, que existe solo por largo de
> URL y no aplica al inventario.

**Cómo se llena: buscar y escribir, nunca navegar 117 casillas.**

El componente ya existe y ya está en esa misma pantalla. `Combobox` con
`multiple`, `ComboboxChips` y `ComboboxChipsInput` es exactamente como se
seleccionan los servicios hoy en `formulario-registro.tsx`: se escribe, se
autocompleta, se agrega como chip, se quita con la X. Cada resultado muestra
el nombre y una segunda línea con contexto — hoy es el área
(`AREAS[s.area]`), para insumos sería la categoría.

Reusarlo contra `catalogo_items` no es trabajo nuevo y **no cuesta JS
extra**: Base UI ya está en el bundle de `/registro`, usado dos veces en esa
misma página (municipios y servicios).

Un ajuste: **un chip no aguanta bien un campo numérico adentro.** El patrón
es combobox arriba para buscar y agregar, y debajo una lista con una fila
por ítem: nombre, categoría, y un contador `− 3 +` con áreas táctiles de
48px, como manda la sección de accesibilidad de `CLAUDE.md`.

Y `ComboboxEmpty` —que hoy dice *"No encontramos ese servicio."*— es el
lugar natural del botón "No encuentro lo que necesito" de §6.3. Aparece
justo cuando la persona ya buscó y no halló nada, que es el único momento en
que ese botón tiene sentido.

**Cantidad opcional, y aproximada a propósito.**

`ofrecimientos.cantidad` es **nullable**. "Tengo cobijas, no sé cuántas" es
el caso honesto más común, y exigir un número produce exactamente el dato
inventado que envenena el cruce. Sin cantidad, la UI dice "tengo" y punto; el
cruce funciona igual, porque cruza por ítem, no por cantidad.

La cantidad real se establece **en la entrega**, no antes: `registrar_entrega`
es donde el aliado anota qué llegó de verdad, y esa cifra sí es dura porque
la escribió alguien que tenía la caja enfrente. Antes de eso, todo número es
una estimación y la interfaz debe tratarlo como tal — *"más o menos"*, no
*"cantidad exacta"*.

Esto es distinto de `solicitud_items.cantidad`, que es `not null` con
`check (cantidad > 0)`. Ahí el número sí importa desde el principio: es lo
que la persona necesita.

**No descuentes las cantidades solas.** Después de registrar una entrega, en
vez de restar en silencio, pregúntale al ofertador si todavía tiene ese ítem
y déjalo alternar `disponible`. Un inventario que se descuenta solo y queda
en cero deja de aparecer en los cruces sin que su dueño entienda por qué.

### 6.2 El filtro inverso en la página principal

La home gana un segundo modo, junto al tablero de siempre:

- **"Quién necesita ayuda"** — el tablero actual, sin cambios.
- **"¿Quién necesita lo que tengo?"** — marco ítems y veo las solicitudes
  abiertas que piden alguno, ordenadas por cuántos coinciden.

**El obstáculo real no es el "sin JavaScript" — es la fuente de datos.**
El jsonb `items` de `solicitudes_publicas` es `{nombre, cantidad, unidad}`
(`schema.sql:238-243`): **no trae `item_id`**, así que no se puede filtrar
por ítems marcados en la URL ni contar coincidencias en SQL.

Corrección: agregar `item_ids text[]` y `sugerencia_ids uuid[]` a
`solicitudes_publicas` (un `create or replace view` admite columnas nuevas
al final). Con eso el filtro es un `&&` de arreglos y el orden un
`cardinality(item_ids && $1)`. No hace falta tocar `matches_potenciales`,
que es otra cosa y vive en el Flujo 2.

**Sin JS sí es factible**, y hay precedente: `README.md:106` documenta que
el desplegable de municipio es `<select>` nativo justamente por el requisito
de formulario GET sin JavaScript. Checkboxes repetidos en un form GET llegan
a `searchParams` como `string[]` en Next 16.

**Pero 117 ítems son 117 checkboxes y una URL larguísima.** Presenta primero
las 8 categorías y despliega los ítems de la elegida; o limita la selección
a 10 ítems, que es más de lo que nadie carga en un carro. Decídelo mirando
la pantalla, no el SQL.

**Dos niveles de uso.** Sin cuenta: marco y busco, nadie tiene que
registrarse para ayudar. Con cuenta e inventario guardado: llega precargado,
aparezco en las coincidencias del aliado (§8-F7), y puedo recibir push
cuando entre una solicitud que me calce — reutilizando `push_ofertadores`,
que ya existe.

### 6.3 Sugerencias de ítem

Quien no encuentra algo lo escribe. Entra como `pendiente` y **la solicitud
se publica igual**, con el ítem marcado "por confirmar" — lo que exige el
`left join` de §5.3-5 **y** el arreglo de escritura de §5.3-8.

Un admin o aliado lo aprueba, lo rechaza o lo **fusiona** con un ítem
existente. Sin fusión terminas con "crema dental", "crema de dientes" y
"pasta dental" como tres ítems distintos, y el cruce deja de encontrar nada.

**Aprobar y fusionar no terminan al escribir `estado`.** Dos cosas más, sin
las cuales la fusión provoca el fallo que existía para evitar:

- Al **aprobar**, hay que generar el `id` del nuevo `catalogo_items`, que es
  una **PK de texto**, no un uuid (`schema.sql:17`). Slug del nombre,
  normalizado y con sufijo si choca.
- Al **fusionar**, hay que **remapear las filas que ya apuntan a la
  sugerencia**: `solicitud_items.sugerencia_id`, `ofrecimientos.sugerencia_id`
  y `entregas.sugerencia_id` pasan a `item_id = item_resultante_id`. Si no,
  un ofertador con `sugerencia_id = X` y una solicitud con
  `item_id = pasta_dental` dejan de cruzar para siempre.

---

## 7. Cómo se elige el flujo

### Al publicar

El formulario de 3 pasos **no cambia** para el Flujo 1. Después del paso de
municipio, si ese municipio tiene una organización activa, aparece una
tarjeta —no un modal, no una interrupción:

> **En tu municipio hay una fundación que puede acompañarte**
>
> Si quieres, la Fundación [Nombre] coordina la entrega: tú no tienes que
> encontrarte con nadie, ellos verifican y te entregan.
>
> Para eso necesitan tu nombre, tu documento y un teléfono. Solo ellos los
> ven; no aparecen en la página pública y se borran cuando se cierre la
> solicitud.
>
> [ Prefiero publicar directo ]   [ Quiero que me acompañen ]

Si el municipio no tiene aliado, la tarjeta no aparece.

**El botón por defecto es publicar directo** (regla R). El de
acompañamiento no está preseleccionado ni destacado en color.

### Después de publicar

Desde `/solicitud/[token]`, un enlace discreto: *"¿Prefieres que una
fundación coordine la entrega?"*. Ahí se piden los datos y la solicitud pasa
a `flujo = 'acompanado'`. Si ya había respuestas de Flujo 1, se conservan;
lo que cambia es que la coordinación pasa al chat.

**No hay botón para volver a anónimo.** Quien se arrepienta borra y
republica —que además es su derecho de supresión, así que la salida existe.
El sistema **sí** devuelve solicitudes a `'directo'` en tres casos, y son
automáticos, no una opción de menú: supresión de datos pedida por el titular
(§8-F11), aliado que se desactiva con hilos vivos (§8-F5), y decisión de
moderación. En los tres se avisa a los participantes y se cierran los hilos.

---

## 8. Flujos, uno por uno

### F1 · Publicar directo — sin cambios de mecánica

Municipio + barrio → categoría + ítems → nota + Turnstile. Token, QR,
`localStorage`. Cero PII. Lo nuevo: el botón "No encuentro lo que necesito"
en el paso de ítems, y la tarjeta de §7 donde haya aliado.

### F2 · Tablero público

Contenido sin cambios visibles. El SQL sí cambia: `left join` con `coalesce`
triple (§5.3-5), `estado_activo()` (§5.3-1), y las columnas nuevas
`item_ids`, `sugerencia_ids` y `flujo` en `solicitudes_publicas` —esta
última para el sello discreto de "hay una fundación coordinando", que hoy la
vista no expone y `types.ts:358-373` tampoco.

Una solicitud de Flujo 2 se ve igual de anónima que una de Flujo 1.

### F3 · Responder en Flujo 1 — sin cambios

`responder_solicitud`, mensaje de 200 caracteres, el solicitante ve el
contacto público y escribe por WhatsApp. Con el aviso de §3 en el momento de
abrir el contacto.

### F4 · Registro de ofertador

Agrega el paso "Qué tengo para dar" (§6.1). El documento **no** se pide
aquí: solo cuando entra a coordinar un Flujo 2, que es cuando hace falta
para el acopio. Pedirlo antes sería recolectar sin causa.

### F5 · Ofertador entra a un Flujo 2

`iniciar_conversacion`. Antes del primer mensaje se le explica que esta
solicitud va acompañada, que la entrega es en el acopio, que necesita su
documento para que lo validen allá, y **cuánto vive ese dato** (§5.7-2).

Al crear el hilo:

- **Hay organización en el municipio** → `estado = 'asignada'`, push a sus
  miembros. **Todavía no es `abierta`**: falta que un aliado concreto se
  haga cargo con `asignar_aliado`.
- **Hay varias** → la que menos hilos abiertos tenga.
- **No hay ninguna** → no debería pasar, porque el Flujo 2 solo se ofrece
  donde hay aliado. Si pasa (el aliado se desactivó entre medias), el hilo
  queda `esperando_aliado`, entra en la cola del admin, y la solicitud se
  devuelve a Flujo 1 con aviso al solicitante. Ese es el fallback que evita
  dejar a alguien colgado.

> **El estado `asignada` existe por la regla L.** Sin él, el hilo quedaría
> "abierto" con organización pero sin persona responsable: bilateral de
> hecho, que es justo lo prohibido.

> **El primer mensaje y el trigger.** El trigger de la regla L rechaza
> `INSERT` en `mensajes` cuando el estado es `esperando_aliado` o
> `asignada`, pero `iniciar_conversacion` necesita guardar el mensaje
> inicial. Resuélvelo con `set_config('aquive.mensaje_inicial','on',true)`
> dentro de la RPC. **El cliente no puede activarlo porque `set_config` vive
> en `pg_catalog` y PostgREST no lo expone** — no porque la RPC sea
> `security definer`, que es irrelevante aquí. Si algún día se expone una
> RPC que llame a `set_config` con parámetros del cliente, esta defensa cae:
> déjalo escrito en un comentario junto al trigger.

### F6 · Chat tripartito

Solicitante (por token), ofertador (por sesión), aliado (por sesión). El
admin puede leer y escribir en cualquier hilo, y su presencia se muestra.

- Máximo 1000 caracteres. Validación anti-contacto (regla M).
- Push al solicitante: *"Nuevo mensaje en tu solicitud [CÓDIGO]"* — nunca el
  contenido.
- Arriba del hilo: dirección del acopio, horario, ítems que se coordinan.
- **Aviso visible de que el chat se borra al cerrar la solicitud**, para que
  nadie lo use como archivo.

### F7 · Coincidencias, desde el panel del aliado

El aliado ve solicitudes **acompañadas** de sus municipios cruzadas con
ofertadores compatibles, y con un botón crea el hilo tripartito e invita a
ambos. Es el mismo cruce de §6.2 visto desde el otro lado, pero pasando por
`coincidencias_para_aliado()` y **solo sobre `flujo = 'acompanado'`**
(§5.4).

### F8 · Entrega y verificación en el acopio

1. Se acuerda día y punto en el chat.
2. El ofertador llega con su **código de entrega**: QR con un identificador
   **opaco**, nunca los últimos 4 del documento (regla 6).
3. El aliado escanea, pide la cédula física, `leer_identidad` le muestra
   nombre y número para cotejar. Queda en bitácora.
4. `registrar_entrega`: qué llegó y en qué cantidad.
5. Los ítems se **tachan**.
6. Estado: `entregada_parcial` si faltan, `cumplida` si no.
7. El solicitante recibe push y llama `confirmar_recepcion` al recibir.
   **Dos confirmaciones, no una.**
8. Si la fundación necesita planilla firmada, la exporta **aquí**, no
   después (regla Q).

### F9 · Cierre y borrado

Igual que en v1, y esto es lo importante: **el Flujo 2 no cambia el TTL.**
"Ya me ayudaron" o vencimiento sin renovar → `DELETE` real de la solicitud,
que arrastra conversaciones, mensajes e identidad. Quedan `metricas`,
`entregas` y `accesos_identidad`, ninguna con PII (§5.7-5).

Con la salvedad del auto-renovado mientras haya coordinación viva, con techo
de 14 días (§5.7-3).

### F10 · Recuperación de solicitud perdida — solo Flujo 2

En Flujo 1 perder el token sigue siendo definitivo, como hoy. En Flujo 2 el
solicitante va donde el aliado con su cédula física; el aliado usa
`buscar_identidad_presencial`, verifica en persona y reenvía el enlace.

**Solo presencial y solo por un aliado con `puede_ver_identidad`. Nunca por
formulario web**: eso sería un buscador de personas por número de cédula.

### F11 · Habeas data — solo Flujo 2

`/mis-datos` con el token: ver qué se guarda, corregir, pedir supresión.

La supresión borra la identidad y devuelve la solicitud a `'directo'`,
cerrando los hilos con aviso a los participantes. Los mensajes del titular
conservan rol y fecha, con el cuerpo reemplazado por *"[mensaje suprimido a
petición del titular]"* mientras el hilo siga vivo. No se borra el hilo
entero: contiene datos de otras dos personas.

En Flujo 1 esta pantalla no hace falta — no hay nada que consultar.

---

## 9. RPCs

Todas `security definer`, `set search_path = ''`, con prefijo `extensions.`
en las llamadas a pgcrypto.

### Los dos flujos

| RPC | Quién | Qué hace |
|---|---|---|
| `crear_solicitud` | `anon` | **Se hace `DROP` y se recrea** con `p_flujo` y soporte de `sugerencia_id` en los ítems (§5.3-7, §5.3-8) |
| `guardar_ofrecimientos(p_items jsonb)` | ofertador | Reemplaza el inventario del perfil |
| `sugerir_item(...)` | sesión o token | Crea `sugerencias_item` en `pendiente` |
| `resolver_sugerencia(...)` | admin, aliado activo | Aprueba (genera el slug de texto), rechaza o **fusiona con remapeo** (§6.3) |
| `crear_item_catalogo(...)` | admin, aliado activo | Alta manual |

### Solo Flujo 2

| RPC | Quién | Qué hace |
|---|---|---|
| `crear_organizacion(...)` | admin | Crea la organización y su invitación de coordinador (§5.5-1) |
| `crear_invitacion(p_rol, p_expira, p_usos_max)` | coordinador | Devuelve el código para el enlace y el QR |
| `unirse_a_organizacion(p_slug, p_codigo)` | sesión con Google | Con código válido → `activo`; sin código → `pendiente`. **Nunca otorga `puede_ver_identidad`** |
| `resolver_miembro_pendiente(p_perfil_id, p_aprobar)` | coordinador | Aprueba o rechaza |
| `otorgar_permiso_miembro(p_perfil_id, p_permiso, p_valor)` | coordinador | Único camino a `puede_ver_identidad` y `puede_moderar` |
| `desactivar_miembro(p_perfil_id)` | coordinador | Falla si es el último coordinador activo |
| `desactivar_organizacion(p_id)` | admin | Dispara el fallback de §8-F5 sobre sus hilos vivos |
| `crear_identidad(...)` | service role | Cifra y guarda, colgando de solicitud **o** de perfil. No descifra, no escribe bitácora |
| `leer_identidad(p_id, p_motivo)` | aliado con permiso, admin | Descifra. **Escribe bitácora.** Falla si el motivo viene vacío |
| `buscar_identidad_presencial(p_documento, p_motivo)` | aliado con permiso | Hashea con pepper y busca. Para F10. **Escribe bitácora.** Sin endpoint público |
| `activar_acompanamiento(p_token, ...)` | solicitante con token | Crea identidad y pasa la solicitud a `'acompanado'` |
| `coincidencias_para_aliado()` | aliado activo | Única puerta a `v_cruces`. Filtra por municipios de su organización y por `flujo='acompanado'` (§5.4) |
| `iniciar_conversacion(...)` | ofertador | Crea el hilo, resuelve organización, mete el mensaje inicial |
| `asignar_aliado(p_conversacion_id)` | aliado de esa organización | `asignada` → `abierta` |
| `enviar_mensaje(...)` | los 3 roles, admin | Anti-contacto. Falla si el estado no es `abierta`/`acordada` |
| `enviar_mensaje_token(p_token, ...)` | solicitante | Igual, por token portador |
| `registrar_entrega(...)` | aliado | Registra, marca `cubierto`, avanza estado |
| `confirmar_recepcion(p_token, ...)` | solicitante | Segunda confirmación |
| `marcar_item_cubierto(...)` | aliado, o solicitante con token | Tacha un ítem |
| `moderar_mensaje(p_mensaje_id)` | admin | Oculta, no borra |
| `bloquear_ofertador(...)` | aliado, admin | Cierra el hilo y suspende el perfil |
| `exportar_planilla(...)` | aliado con permiso | CSV con PII. Pasa por bitácora, va estampado |
| `devolver_a_directo(p_solicitud_id, p_motivo)` | sistema, admin, titular | Borra identidad, cierra hilos, avisa, vuelve a `'directo'` |

Y hay que **modificar** tres existentes: `expirar_solicitudes()` (§5.7-3),
`resolver_reporte()` (§5.7-4) y `crear_perfil()` (§5.3-2).

---

## 10. Pantallas

### Home

Dos modos, mismo tablero: **"Quién necesita ayuda"** (lo actual) y
**"¿Quién necesita lo que tengo?"** (§6.2). Ambos sin cuenta y sin
JavaScript.

### Panel de aliado — `/aliado`

Solo miembros con `estado = 'activo'` de una organización activa. Un
miembro **pendiente** o inactivo ve el panel vacío con el aviso de que su
ingreso está por aprobar, y **cero acceso a identidad, conversaciones y
coincidencias** (§5.5-5).

| Sección | Contenido |
|---|---|
| Resumen | Solicitudes acompañadas en sus municipios, hilos sin atender, entregas por verificar |
| Solicitudes | Ítems pendientes; el detalle con identidad pasa por `leer_identidad` |
| Ofertadores | Quién tiene qué |
| **Coincidencias** | El cruce, vía `coincidencias_para_aliado()`. Botón "Conectar" |
| Conversaciones | Sus hilos, estado, botón de bloquear ofertador |
| Entregas | Registrar recepción, escanear código, tachar ítems |
| Sugerencias | Aprobar / rechazar / fusionar |
| Catálogo | Alta manual de ítems |
| Planillas | Exportar CSV — con bitácora y estampado |

El aliado **no ve** solicitudes de Flujo 1 con más detalle que cualquiera:
son anónimas y siguen siéndolo, y no aparecen en Coincidencias.

### Panel de admin — `/admin`

Lo actual más: **crear y desactivar organizaciones** (§5.5-1),
todas las conversaciones con moderación, **bitácora de accesos a identidad**,
cola de `esperando_aliado`, sugerencias sin límite de municipio, y métricas
comparadas entre los dos flujos.

---

## 11. Huecos que hay que resolver

1. **Convertir el Flujo 1 en ciudadano de segunda.** El riesgo de producto
   más grande de todo esto. Si la UI lo pinta como la opción mala, la gente
   fuera de Cali siente que la app no es para ella y el proyecto pierde
   justo lo que lo hacía útil. La regla R existe por esto, y se verifica
   mirando pantallas, no leyendo código.
2. **El chat usado para saltarse el chat.** Sin filtro anti-contacto, el
   primer mensaje de todos será un número de WhatsApp y el Flujo 2 queda
   siendo el Flujo 1 pero con cédulas guardadas: lo peor de los dos.
3. **El aliado viendo solicitudes de Flujo 1 en Coincidencias.** Es el hueco
   más fácil de introducir sin darse cuenta y el que más daño hace: arrastra
   a alguien que eligió el anonimato a un proceso que no aceptó (§5.4).
4. **Identidades huérfanas.** Si la FK apunta al revés, borrar la solicitud
   deja la cédula cifrada guardada para siempre (§5.7-1).
5. **`expirar_solicitudes()` borrando coordinaciones vivas** (§5.7-3).
6. **El borrado de cuenta rompiéndose** por FK sin `SET NULL` (§5.7-4).
7. **Aliado que se desactiva con hilos vivos.** Cola del admin y
   `devolver_a_directo` con aviso.
8. **Suplantación de fundación.** Resuelto de raíz al quitar el
   auto-registro de organizaciones: solo un admin las crea, tras mirar RUES
   y NIT (§5.5-1). Lo que queda por cuidar es el otro extremo — que alguien
   adivine un slug y se cuele como miembro—, y para eso está el código de
   invitación más la cola de pendientes (§5.5-2).
9. **Quién dentro de la fundación ve la cédula.** `puede_ver_identidad` por
   miembro.
10. **Fusión de sugerencias sin remapeo**, que provoca exactamente el fallo
    que la fusión existía para evitar (§6.3).
11. **Reversa del acoso.** El ofertador conoce el barrio; en Flujo 2 el
    aliado lo sabe todo. `bloquear_ofertador` cierra el hilo y suspende. En
    Flujo 1 el equivalente es el botón de reportar, que ya existe.
12. **Entrega parcial.** Casi ninguna solicitud se cubre con un solo
    ofertador: varios hilos y tachado ítem por ítem.
13. **Doble tachado.** Que el aliado marque "entregado" no significa que
    llegó al solicitante.
14. **La planilla exportada es la fuga más probable del diseño.** Un CSV con
    cédulas sin bitácora, mandado por correo. Debe pasar por
    `leer_identidad`, quedar registrada y llevar estampado quién la generó.
15. **Turnstile en `activar_acompanamiento` y en `iniciar_conversacion`**,
    no solo al publicar.
16. **Métricas comparadas.** `metricas.flujo` permite responder en un mes si
    el acompañamiento sirvió. Sin esa columna, extenderlo a otros municipios
    se decide a ciegas.
17. **Los avisos de §3 hay que escribirlos bien.** Es copy, no código, y es
    lo que sostiene tu posición si algo sale mal en un Flujo 1.

---

## 12. Bloqueantes que NO son código

Menos que en la versión con retención de 90 días: sin retención larga el
problema se encoge bastante.

1. **Contrato de transmisión de datos** entre la fundación (responsable) y
   tú (encargado), art. 25 del Decreto 1377 de 2013. Va **antes** de la Fase
   D. Debe decir explícitamente que la plataforma no retiene tras el cierre y
   que la custodia de las planillas exportadas es de la fundación.
2. **Registro en el RNBD** ante la SIC, a nombre de la fundación.
3. **Canal de habeas data** (arts. 14–15): consulta 10 días hábiles, reclamo
   y supresión 15. Solo aplica a solicitudes de Flujo 2.
4. **Actualizar `docs/legal/PLANTILLAS.md`.** No hay que rehacerlo entero: el
   aviso actual sigue siendo cierto para el Flujo 1. Hay que **agregar** la
   sección del Flujo 2, el texto de autorización y el aviso de §3 sobre falta
   de verificación. Revisión de abogado.
5. **`src/lib/config.ts → RESPONSABLE`.** Tiene efecto legal y aparece en el
   texto que ahora aceptan también los solicitantes del Flujo 2. Revisar en
   la Fase F.
6. **Verificación de la fundación**, fuera de la app: certificado de
   existencia del RUES, NIT y persona de contacto. Es lo que el admin mira
   **antes** de crear la organización; por eso no hay cola de verificación
   dentro del producto.
7. **PITR sigue desactivado**, ahora sin conflicto: no hay retención larga
   que respaldar, así que la promesa de borrado duro de v1 se mantiene tal
   cual y el aviso no miente.
8. **Vercel Hobby**: verificado que prohíbe uso comercial y que las
   donaciones cuentan como tal. Con la fundación entrando, la lectura entra
   en zona gris. Pregúntale a soporte de Vercel —es gratis— en vez de
   adivinar. Detalle y cifras en §13.8.

---

## 13. Trabajar contra producción sin dejar basura

**No hay base de datos de pruebas.** Todo lo que se pruebe se escribe en la
base real, con usuarios reales usando el sitio al mismo tiempo. Esto no es un
detalle de infraestructura: cambia cómo se prueba cada fase.

### 13.1 El riesgo que no es técnico

Una solicitud de prueba **aparece en el tablero público**, que es donde entra
gente en crisis buscando ayuda. Alguien puede responderle, movilizarse, y
descubrir que no existía. Eso es peor que cualquier bug.

Por eso la marca de prueba **no es solo para poder borrar: es para que se vea
mientras existe.** Las tres medidas van juntas:

- `barrio` empieza con `PRUEBA — ` en toda solicitud de prueba. Es un campo
  visible en la tarjeta del tablero, así que cualquiera que la vea entiende
  qué es antes de invertir un viaje.
- `nombre_visible` empieza con `PRUEBA — ` en todo perfil de prueba.
- Usa **un municipio sin actividad real** para las pruebas. Míralo antes en
  `municipios_con_solicitudes`: si no aparece, está libre.

### 13.2 La trampa: `metricas` no se puede limpiar después

`cerrar_solicitud` (`:578`) y `expirar_solicitudes` (`:920`) **insertan en
`metricas` y después borran la solicitud**. `metricas` no tiene ninguna FK ni
ninguna referencia de vuelta (`:206`).

Consecuencia: cada solicitud de prueba que se cierre o expire deja una fila
permanente e **imposible de identificar después** en la tabla que está
pensada para publicarse como dato abierto. El `CASCADE` no la alcanza porque
no hay FK, y para cuando quieras limpiarla ya no existe la solicitud que te
diría cuál era.

Es el único sitio donde hace falta una columna, precisamente porque no hay
FK por donde limpiar:

```
solicitudes  + es_prueba boolean not null default false
metricas     + es_prueba boolean not null default false
```

Y `cerrar_solicitud` y `expirar_solicitudes` tienen que **propagar el
valor** al insertar en `metricas`. Las dos columnas se eliminan cuando
termine el periodo de pruebas; hasta entonces, `metricas` se publica siempre
con `where es_prueba = false`.

### 13.3 Cómo se marca todo lo demás

El resto no necesita columnas: cuelga por FK de tres raíces.

| Raíz | Marca | Qué arrastra al borrarla |
|---|---|---|
| `solicitudes` | `es_prueba = true` y `barrio` con prefijo | `solicitud_items`, `respuestas`, `push_suscripciones`, `conversaciones` → `mensajes`, `identidades` |
| `perfiles` | `nombre_visible` con prefijo | `servidores`, `ofrecimientos`, `push_ofertadores`, `miembros_organizacion` |
| `organizaciones` | `slug` empieza por `prueba-` | `invitaciones_organizacion` |

Tres tablas no cuelgan de nada y hay que borrarlas a mano, en este orden y
**antes** que sus raíces, porque están en `SET NULL` justamente para
sobrevivir (§5.7-5): `entregas`, `accesos_identidad` y `reportes`.

Y dos más que se crean sueltas: `sugerencias_item` (marcar
`nombre_propuesto` con el prefijo) y cualquier `catalogo_items` aprobado
durante las pruebas (`origen` distinto de `'semilla'` y `creado_por` de un
perfil de prueba).

### 13.4 Script de limpieza

`supabase/limpiar-pruebas.sql`, escrito en la Fase A y **actualizado en cada
fase que agregue una tabla**. Requisitos:

1. Empieza con un `select` que **cuente** lo que va a borrar, por tabla, sin
   borrar nada. Ese conteo se revisa antes de ejecutar.
2. Todo `delete` va filtrado por la marca. **Ningún `delete` sin `where`**, y
   ningún `where` que dependa de una fecha o de un rango de ids.
3. Corre dentro de una transacción explícita.
4. Termina reportando cuántas filas quedaron con marca de prueba: debe ser
   cero.

### 13.5 Lo que NO se prueba contra producción

- **`expirar_solicitudes()` y `purgar_datos_vencidos()`.** Son borrados
  globales sin filtro de prueba: una llamada manual se lleva por delante las
  solicitudes reales que estén vencidas en ese instante. Para probarlas,
  escribe una variante `..._para(p_solicitud_id)` que haga lo mismo sobre una
  sola fila, pruébala con esa, y borra la variante después.
- **Los cambios a `expirar_solicitudes` de la Fase I.** El auto-renovado y el
  techo de 14 días afectan a todas las solicitudes vivas. Revísalos leyendo
  el SQL y probando la variante acotada, no ejecutando el job.
- **`resolver_reporte` sobre contenido real**, por razones obvias.

### 13.6 La salida de verdad: Supabase local, no ramas

Las **ramas de base de datos** de Supabase serían lo ideal, pero son solo de
plan pago ($0.01344 por rama por hora). Y el plan Free permite **2 proyectos
activos**: hoy están ocupados por `aquive` y `coffea-test`, así que tampoco
hay hueco para un `aquive-dev` sin pausar otro.

**La salida es la CLI local, y es gratis.** `supabase start` levanta el stack
completo en tu máquina —Postgres, Auth, PostgREST, Studio— sin consumir
proyecto ni tocar producción. Incluye el Vault, así que el cifrado de la
Fase E se prueba de verdad.

```bash
npm install supabase --save-dev
npx supabase init
npx supabase start
# luego, contra la base local:
#   supabase/schema.sql
#   supabase/seed-municipios.sql
#   supabase/seed-catalogo.sql
```

Dos fricciones reales, ninguna de dinero:

- Requiere **Docker Desktop** (o Podman / Rancher Desktop). En Windows eso
  significa WSL2.
- **El login con Google no funciona en local** sin configurar un redirect a
  localhost. Para probar flujos con sesión, usa el proveedor de
  email/contraseña en local y deja el de Google para producción.

**Desde la Fase E en adelante, local deja de ser opcional.** Una cédula de
prueba en `identidades` es una fila cifrada real en la base real de
producción, y no hay forma cómoda de defender eso. Si por lo que sea hay que
tocar producción, usa documentos evidentemente falsos (`1000000001` en
adelante) y bórralos el mismo día.

### 13.7 Qué cuesta todo esto

Ninguna pieza de la v2 obliga a pagar. `pgcrypto` corre dentro de Postgres,
el Vault viene incluido en Free, el push con VAPID lo hospedas tú, el QR es
cliente y Turnstile es gratis.

**La decisión que sí puede costar caro es cómo se implementa el chat.**

| Implementación | Costo |
|---|---|
| **Supabase Realtime** (websocket) | Incluido en Free. Solo suma al egress |
| **Polling desde Vercel** | Cada consulta es una invocación de función |

Hobby incluye **1.000.000 de invocaciones al mes**. Veinte conversaciones
abiertas consultando cada 5 segundos son ~345.000 invocaciones **al día**: la
cuota se agota en tres días y el sitio se bloquea hasta que pase el mes.
**Usa Realtime.** Si por alguna razón hay que hacer polling, que sea de 30
segundos para arriba y solo con la conversación abierta en pantalla.

Los demás límites del plan Free no aprietan: los mensajes son de 1000
caracteres y mueren a las 72h, así que los 500 MB sobran; los 50.000 usuarios
activos también, porque solo tienen cuenta ofertadores, servidores y aliados.

Ojo con uno que ya te afecta hoy y la v2 no cambia: **los proyectos Free se
pausan tras una semana de inactividad.**

### 13.8 Vercel: no es un problema de costo, es de términos

Hobby es *"solo uso personal no comercial"*, y Vercel define comercial como
cualquier despliegue usado para el beneficio económico de **cualquiera**
involucrado en **cualquier parte** de la producción del proyecto, incluido un
empleado o consultor pagado que escriba el código. Y textualmente:
*"Asking for Donations fall under commercial usage."*

La regla de `CLAUDE.md` de nunca poner botón de donar sigue siendo correcta y
ahora está verificada contra la fuente.

Con la fundación entrando, la lectura se complica: mientras nadie cobre por
operar esto y no haya pasarela ni donaciones, el argumento de que sigue
siendo no comercial se sostiene. Se debilita si la fundación tiene personal
asalariado cuya función incluye operar la plataforma. **Es una zona gris que
conviene resolver antes de crecer, no después** — y se resuelve preguntándole
a soporte de Vercel, que es gratis, no adivinando.

Si al final toca pagar: **Supabase Pro desde $25/mes** y **Vercel Pro $20/mes
por asiento**. Nada de la v2 lo obliga hoy.

---

## 14. Fases para Claude Code

> **Antes de la primera línea: lee §13.** No hay base de datos de pruebas.
> Todo lo que crees se escribe en producción, donde hay gente real buscando
> ayuda, y `metricas` guarda residuo que después no se puede identificar.

**A, B y C mejoran el Flujo 1 y no tocan datos personales. Se pueden
desplegar solas, y probablemente deberían: benefician a todo el país desde
el primer día, sin esperar nada legal.**

### Fase A — Inventario y sugerencias

> Lee `CLAUDE.md`, este plan y `supabase/schema.sql` completos. Atención a
> §5.3.
>
> Migración `v2-a.sql`: `ofrecimientos`, `sugerencias_item`,
> `solicitud_items.sugerencia_id`, `catalogo_items.creado_por/origen`, con
> sus RPC y RLS.
>
> Los `UNIQUE` parciales de `ofrecimientos` van como **índices únicos
> parciales**, no como restricción de tabla: un `UNIQUE` de tabla no admite
> `WHERE`.
>
> **`crear_solicitud` se hace `DROP` y se recrea**, no `create or replace`:
> agregarle un parámetro crea una sobrecarga y PostgREST devuelve
> `PGRST203` en cada llamada, tumbando el Flujo 1 entero (§5.3-7). Y hay que
> enseñarle a insertar ítems con `sugerencia_id` (§5.3-8).
>
> Convierte a `left join` los `join catalogo_items` de
> `solicitudes_publicas` (`:242`) y `leer_solicitud` (`:530`), con `left
> join` a `sugerencias_item` y **`coalesce` de `nombre`, `unidad` y
> `orden`** — solo del nombre no basta: `describirItem()` en
> `src/lib/catalogo.ts` renderizaría *"3 null de Crema dental"* en el
> tablero público.
>
> Para las políticas **no uses `es_admin()`**: `EXECUTE` revocado, falla
> dentro de una policy. `EXISTS` a mano contra `administradores`.
>
> UI: sección "Qué tengo para dar" en `/registro`, editable desde el perfil.
>
> **Reusa el `Combobox` que ya está en esa pantalla**, tal como se usa hoy
> para servicios: `multiple`, `ComboboxChips`, `ComboboxChipsInput`, con la
> categoría como segunda línea de cada resultado —igual que `AREAS[s.area]`
> en el bloque de servicios. No escribas 117 checkboxes ni un selector
> nuevo. Base UI ya está en el bundle de esa página.
>
> Debajo del combobox, una lista con una fila por ítem: nombre, categoría y
> contador `− n +` de 48px. La cantidad es **opcional** (`cantidad`
> nullable) y se muestra como estimación, no como dato exacto.
> `ComboboxEmpty` es donde va el botón "No encuentro lo que necesito".
>
> **Opcional, nunca bloqueante**: no la agregues a `puedeGuardar` en
> `formulario-registro.tsx`. Sigue el precedente de `serviciosIds`, que ya
> es opcional para servidores en ese mismo formulario. Sin inventario, el
> perfil se guarda igual y el ofertador navega y responde como hoy; lo que
> pierde —coincidencias y avisos— se dice en pantalla, no se impone.
> Múltiples categorías y sin tope de ítems: `ofrecimientos` no tiene columna
> de categoría y la escritura va por `POST`.
>
> Botón "No encuentro lo que necesito" en los dos lados. Cola de
> sugerencias en `/admin` con aprobar, rechazar y **fusionar** —incluyendo
> la generación del slug de texto para `catalogo_items.id` y el remapeo de
> `solicitud_items`, `ofrecimientos` y `entregas` (§6.3).
>
> Actualiza `src/lib/types.ts`: `ItemResumen.unidad` deja de estar
> garantizada.
>
> **Y lo primero de todo, antes de cualquier otra cosa** (§13): agrega
> `es_prueba` a `solicitudes` y a `metricas`, haz que `cerrar_solicitud` y
> `expirar_solicitudes` lo propaguen al insertar en `metricas`, y crea
> `supabase/limpiar-pruebas.sql` con el conteo previo y los borrados
> filtrados. Sin eso, la primera solicitud de prueba que expire deja basura
> imposible de limpiar en el dato abierto.

### Fase B — El cruce inverso en la home

> Agrega `item_ids text[]` y `sugerencia_ids uuid[]` a
> `solicitudes_publicas` (un `create or replace view` admite columnas nuevas
> al final) y a `types.ts`. **Sin eso la fase no es implementable**: el
> jsonb `items` no trae `item_id` y no hay por dónde filtrar.
>
> Segundo modo del tablero: "¿Quién necesita lo que tengo?". Selección por
> `searchParams`, filtro con `&&` de arreglos, orden por cardinalidad de la
> intersección.
>
> **Debe funcionar sin cuenta y sin JavaScript**, como el filtro de
> municipio (`README.md:106`). Con 117 ítems, no pongas 117 checkboxes:
> categoría primero y ítems de esa categoría después, o tope de 10
> seleccionados. Decídelo mirando la pantalla.
>
> Si hay sesión con inventario, llega precargado. Reutiliza
> `push_ofertadores` para avisar de solicitudes que calcen.
>
> No uses `v_cruces` aquí: eso es Flujo 2 y va por RPC.

### Fase C — Honestidad sobre el Flujo 1

> Los avisos de §3, en los cuatro puntos indicados, con ese tono. Página
> corta de consejos de seguridad. Actualizar `/terminos`.
>
> **Sin sellos de confiabilidad, sin estrellas, sin reputación.**

---

**D en adelante es el Flujo 2 y no arranca hasta que §12.1 esté firmado.**

### Fase D — Organizaciones y rol aliado

> Implementa §5.5 completo. **Las organizaciones no se auto-registran**: no
> construyas embudo de solicitud ni cola de verificación.
>
> Migración `v2-d.sql`: `organizaciones` (con `slug` y `nit` únicos, sin
> columna `verificada`), `invitaciones_organizacion` y
> `miembros_organizacion` con `rol`, `estado` y los dos permisos.
>
> **La policy de `miembros_organizacion` va como fila propia**
> (`perfil_id = auth.uid()`) o encapsulada en una función `security definer`
> **con `EXECUTE` concedido**. Si haces `EXISTS` cruzado entre esa tabla y
> `conversaciones`, hay recursión infinita (§5.3-4).
>
> Para agregar `'aliado'` a `perfiles.tipo` **no basta con el CHECK**:
> `crear_perfil` (`:693`) lo rechaza en duro y su rama `else` borra de
> `servidores`; `contacto_publico` es `not null` 7–40, donde un aliado no
> cabe — nullable con CHECK condicional por tipo; y en `types.ts` hay que
> tocar `TipoPerfil` (`:15`) **y** `EstadoSolicitud` (`:19`).
>
> **En `/admin`**: crear organización (nombre, tipo, NIT, slug, municipios,
> dirección, horario) y generar la invitación de coordinador. El slug se
> propone a partir del nombre pero es editable, y se valida único con
> `[a-z0-9-]{3,40}`. Botón de desactivar organización.
>
> **En `/unirse/[slug]`**: pantalla que muestra el nombre de la organización
> y pide iniciar sesión con Google. Con `?c=<código>` válido, el miembro
> queda `activo`; sin código, queda `pendiente`. Un código caducado o
> agotado cae al camino de pendiente, no da error. **Genera también el QR**
> desde el panel del coordinador, reutilizando lo que ya se usa en la
> pantalla de confirmación de solicitud.
>
> **En `/aliado`, sección Equipo** (solo coordinadores): lista de miembros
> con su rol y permisos, cola de pendientes con aprobar/rechazar, botones de
> otorgar y quitar `puede_ver_identidad` y `puede_moderar`, generar
> invitaciones con vigencia y usos, y ascender a coordinador.
>
> Tres invariantes que van en la base, no en la UI:
> 1. `puede_ver_identidad` **nunca** se pone en `true` en un `INSERT`. Solo
>    por `otorgar_permiso_miembro`, y queda registrado.
> 2. Una organización **no puede quedarse sin coordinador activo**: el
>    último no se degrada ni se desactiva. Trigger.
> 3. Un miembro `pendiente` o `inactivo` no pasa el filtro de ninguna RPC de
>    aliado. Comprueba esto en la función de pertenencia, una sola vez, para
>    no repetir la condición en quince sitios.

### Fase E — Identidad cifrada

> Depende de la Fase D (`titular_tipo` incluye `'aliado'`) y de la F
> (`identidades.solicitud_id`). Si prefieres, hazla junto con la F: son un
> bloque.
>
> Migración `v2-e.sql`:
> 1. Secretos del Vault `aquive_identidad_key` y `aquive_documento_pepper`,
>    creados a mano en el dashboard (instrucciones en comentario). En
>    Supabase gestionado el vault **ya viene instalado**: si
>    `vault.decrypted_secrets` falla, el problema es de permisos del rol
>    dueño de la función, no de extensión ausente. **Déjalo escrito**: la
>    función tiene que ser propiedad de un rol con acceso al vault;
>    `security definer` por sí solo no basta si la creas desde otro rol.
> 2. `identidades` según §5.2, con `REVOKE ALL` a `anon` y `authenticated`,
>    CHECK que prohíbe `TI` y `RC`, y **las FK en el sentido correcto**:
>    `identidades.solicitud_id → solicitudes on delete cascade` y
>    `identidades.perfil_id → perfiles on delete cascade`, con `CHECK
>    num_nonnulls(...) = 1`. **No pongas `identidad_id` en `solicitudes` ni
>    en `perfiles`** — ver §5.7-1, es el error que deja cédulas huérfanas.
> 3. `accesos_identidad` con `identidad_id` y `leida_por` en
>    `ON DELETE SET NULL` más las copias de texto `identidad_ref` y
>    `lector_ref`; sin `UPDATE` ni `DELETE` para nadie.
> 4. `crear_identidad`, `leer_identidad`, `buscar_identidad_presencial`. Las
>    dos que descifran escriben bitácora antes de devolver.
> 5. Helpers `cifrar_texto` / `descifrar_texto` / `hash_documento`, con
>    `EXECUTE` revocado a todo el mundo.
>
> **Usa `extensions.pgp_sym_encrypt` con prefijo**: las funciones van con
> `set search_path = ''` y pgcrypto vive en `extensions`. Precedente real:
> `extensions.digest` en `:479`, `:507`, `:555`, `:576`, `:605`.
>
> Agrega `validarDocumento` y `validarTelefono` a `src/lib/validacion.ts`
> como funciones **nuevas y separadas**. No toques `contienePII`: su
> `\d{7,}` sigue siendo correcto para nota y barrio, y rechazaría justo lo
> que el formulario de identidad tiene que aceptar.
>
> Nada de UI. Nada de `any`. Un documento en claro no puede llegar a un
> Client Component, a un log ni a un mensaje de error.

### Fase F — Elección de flujo

> `solicitudes.flujo` y `organizacion_id`. `crear_solicitud` gana `p_flujo`
> con default `'directo'` (recordar el `DROP` de la Fase A).
> `activar_acompanamiento` para el cambio posterior (§7).
>
> Agrega `s.flujo` a `solicitudes_publicas` y a `types.ts`, para el sello
> discreto del tablero.
>
> Tarjeta de §7 tras el paso de municipio, **solo si hay aliado activo y
> activa ahí**. El botón por defecto es publicar directo (regla R).
> Enlace discreto en `/solicitud/[token]`.
>
> Aplica §5.3-1: crea `estado_activo(estado)` y úsalo en
> `solicitudes_publicas`, `municipios_con_solicitudes`,
> `responder_solicitud` y `renovar_solicitud`, en la **misma** migración que
> introduce `en_coordinacion` y `entregada_parcial`.
>
> Revisa `src/lib/config.ts → RESPONSABLE`: tiene efecto legal y ahora
> aparece en el texto que aceptan los solicitantes del Flujo 2.
>
> Prueba que falle si aparece cualquier dato de identidad en el HTML del
> tablero público.

### Fase G — Chat tripartito

> `conversaciones` (CASCADE desde `solicitudes`; `ofertador_id` y
> `aliado_id` en **`SET NULL`** para no romper el borrado de cuenta),
> `mensajes` (CASCADE desde `conversaciones`) y las RPC de §9. **No hay
> tabla de participantes**: los tres roles son columnas.
>
> La regla L se implementa en la base: trigger que rechace `INSERT` en
> `mensajes` cuando el estado sea `esperando_aliado` o `asignada`, con la
> excepción de la variable de sesión para el mensaje inicial. Deja escrito
> en un comentario **por qué** el cliente no puede activar esa variable
> (§8-F5): no es por `security definer`.
>
> **El chat va por Supabase Realtime, no por polling.** Con polling desde
> Vercel, veinte conversaciones abiertas consumen la cuota de 1M
> invocaciones del plan Hobby en tres días y el sitio se bloquea (§13.7).
> Si hace falta un respaldo sin websocket, que sea de 30 segundos para
> arriba y solo con la conversación visible en pantalla.
>
> La regla M es `contieneContacto`, **nueva y más estricta** que
> `contienePII`: además de teléfonos y correos, cubre `wa.me`, `t.me`,
> `api.whatsapp.com`, arrobas sin dominio y dígitos escritos en letras
> ("tres uno cero..."), que es la evasión obvia apenas alguien descubra el
> filtro. Duplicada en TypeScript y en la RPC, como `contienePII`.
>
> Aviso visible de que el chat se borra al cerrar la solicitud.

### Fase H — Panel de aliado, coincidencias y entregas

> Vista interna `v_cruces` **sin `grant` a `anon` ni `authenticated`**, y
> `coincidencias_para_aliado()` como única puerta: valida membresía en
> organización activa, filtra por sus municipios y **por
> `flujo = 'acompanado'`** (§5.4). No intentes resolverlo con
> `security_invoker`: `solicitudes` está revocada y sin policy de `select`,
> y `perfiles` solo deja leer la fila propia — devolvería error o cero filas
> para todo el mundo.
>
> `/aliado` con las secciones de §10. `registrar_entrega`,
> `confirmar_recepcion`, `marcar_item_cubierto`, `exportar_planilla`.
>
> `entregas` con `conversacion_id` en `SET NULL` más `solicitud_codigo` en
> texto, para que sobreviva al borrado (§5.7-5).
>
> Código de entrega en QR con **identificador opaco**, nunca los últimos 4
> del documento. `solicitud_items.cubierto` sigue siendo el booleano que
> leen la vista y la UI; `cubierto_at`/`cubierto_por` son metadato.
>
> Pantalla de verificación pensada para un celular a media luz y con
> guantes: botones grandes, poco texto.

### Fase I — Ciclo de vida, moderación y habeas data

> La fase que evita que todo lo anterior borre lo que no debe.
>
> **Modifica `expirar_solicitudes()`** (`:912-936`): hoy borra sin mirar
> `estado`. Debe auto-renovar mientras exista una conversación en estado
> distinto de `cerrada`, con **techo duro de 14 días**; al llegar al techo,
> cerrar, notificar a los tres y borrar. Y debe registrar `cumplida = true`
> para las `entregada_parcial`, en vez de `false` para todas (§5.7-3).
>
> **Modifica `resolver_reporte()`** (`:885-892`): hoy hace `delete from
> solicitudes` directo. Debe cerrar los hilos y notificar antes de borrar,
> y dejar métrica.
>
> **Verifica el borrado de cuenta**: la policy `"perfil propio delete"`
> (`:384`) sigue funcionando porque todas las FK nuevas hacia `perfiles` y
> `auth.users` están en `SET NULL` con copia de texto al lado. Precedente:
> `servidores.verificado_por` (`:77-80`).
>
> `/admin` con conversaciones, moderación, bitácora de accesos, cola de
> `esperando_aliado` y métricas comparadas. `bloquear_ofertador`,
> `devolver_a_directo`, `/mis-datos` (§8-F11). `metricas.flujo` y
> `con_aliado`.
>
> Actualiza `/privacidad` y `/terminos` con la sección del Flujo 2.
>
> En `CLAUDE.md`: **no reescribas las seis reglas duras, agrégales el
> alcance.** Cada una dice a qué flujo aplica, y se suman las reglas K a R
> de §2. El alcance cerrado y la prohibición de PII en logs siguen
> intactos; del párrafo final de la regla 5, solo se sustituye la parte de
> "una sola persona natural" por el reparto responsable/encargado, y solo
> para el Flujo 2.

---

## 15. Pruebas antes de desplegar

### Flujo 1 — que no se haya roto nada

1. `POST /rpc/crear_solicitud` desde la API pública **funciona** y no
   devuelve `PGRST203` (la prueba del `DROP`, §5.3-7).
2. Publicar sin acompañamiento: `solicitudes` sin nada identificable, y
   `identidades` sin ninguna fila asociada.
3. El tablero funciona con JavaScript desactivado, incluido el modo "¿Quién
   necesita lo que tengo?".
4. Una solicitud con ítem sugerido se ve en el tablero **y** en la pantalla
   del solicitante, **con su unidad bien escrita** — no "3 null de X".
5. Los avisos de §3 aparecen en los cuatro puntos.
6. Un municipio sin aliado nunca ve la tarjeta de acompañamiento.
7. Fusionar una sugerencia ya usada: la solicitud y el ofrecimiento que la
   referenciaban **siguen cruzando** después de la fusión.
8. **Registrar un ofertador nuevo sin tocar el inventario**: el perfil se
   guarda, y puede responder solicitudes con normalidad.
9. Un ofertador existente de producción, sin inventario, entra y todo
   funciona: no hay pantalla que lo obligue a llenar nada.
10. Guardar un inventario con ítems de cuatro categorías distintas y
    comprobar que los cuatro aparecen en los cruces.
11. Guardar un ítem **sin cantidad**: se acepta, y sigue cruzando.

### Flujo 2

8. Volcar `identidades`: las columnas `_cifrado` ilegibles sin la llave del
   Vault. Los hashes se ven —es lo esperado (§5.6)— y lo que hay que
   comprobar es que no se revierten sin el pepper.
9. Leer una identidad desde `/aliado` y confirmar la fila en
   `accesos_identidad`.
10. Mandar un celular por el chat → rechazo. Probar también "tres uno
    cero..." en letras.
11. Escribir en un hilo `esperando_aliado` o `asignada` → rechazo **desde la
    base**, llamando la RPC directo.
12. **Un aliado no ve ninguna solicitud de Flujo 1 en Coincidencias.**
12b. Entrar a `/unirse/[slug]` **sin código**: queda `pendiente` y el panel
    no muestra ni una solicitud, ni una conversación, ni una identidad.
12c. Entrar con un código **caducado o agotado**: cae a `pendiente`, no da
    error ni entra como activo.
12d. Un miembro recién aprobado tiene `puede_ver_identidad = false`, y
    `leer_identidad` le falla hasta que un coordinador se lo otorgue.
12e. El último coordinador activo **no puede** degradarse ni desactivarse.
12f. Dos organizaciones con el mismo NIT o el mismo slug: la segunda falla.
13. Un aliado de Cali no ve nada de Pereira: llamar
    `coincidencias_para_aliado()` con dos cuentas distintas.
14. Un aliado sin `puede_ver_identidad` no descifra nada.
15. Consultar `v_cruces` directo por API con una sesión cualquiera → debe
    fallar por permisos.
16. Activar acompañamiento sobre una solicitud ya publicada con respuestas
    de Flujo 1 vivas: las respuestas se conservan.

### Borrado — la parte que más importa

17. Cerrar una solicitud acompañada: desaparecen solicitud, conversaciones,
    mensajes **e identidad**. Confirmar que `identidades` no queda con
    filas huérfanas (§5.7-1).
18. Siguen ahí `metricas`, `entregas` y `accesos_identidad`, y ninguna
    tiene datos personales.
19. **Borrar la cuenta de un ofertador que participó en una entrega**: el
    borrado se completa, su identidad se va, y la bitácora sigue con
    `lector_ref` legible.
20. Dejar vencer una solicitud con coordinación viva: **no se borra**, se
    auto-renueva. Y al llegar a los 14 días, se cierra y se borra.
21. Una `entregada_parcial` que expira registra `cumplida = true` en
    `metricas`, no `false`.
22. Resolver un reporte sobre una solicitud en coordinación: los hilos se
    cierran y el aliado se entera antes del borrado.

### General

23. Buscar cualquier PII en el HTML crudo del tablero, sin sesión.
24. Flujo de entrega completo en un Android de gama baja con red lenta.
25. `/security-review` y `/accesslint scan` sobre todo lo nuevo.
26. **Correr `limpiar-pruebas.sql` y verificar que queda en cero**, y que
    `select count(*) from metricas where es_prueba` también. Después,
    confirmar que las solicitudes y perfiles reales siguen intactos: el
    conteo antes y después debe ser el mismo.

---

## 16. Orden

**A → B → C es un bloque desplegable solo.** Mejora el Flujo 1 en todo el
país, no toca datos personales, no depende de ningún papel firmado. Sácalo
primero.

**D → I es el Flujo 2**, y no arranca hasta que §12.1 esté firmado. Dentro
del bloque el orden importa y no es el obvio: **E y F son interdependientes**
—`identidades.solicitud_id` necesita la columna `flujo`, y `titular_tipo`
necesita el rol `'aliado'` de la D— así que van juntas o D→F→E. Después
G → H → I en orden.

**I no es opcional.** Es la fase donde se arreglan `expirar_solicitudes()` y
`resolver_reporte()`. Sin ella, el Flujo 2 borra coordinaciones vivas y deja
identidades donde no debe.

Y algo que no es una fase: **conseguir que coordinadores de albergues usen
esto sigue importando más que cualquier línea de este documento.**
