# Especificación funcional

## Roles

| Rol | Autenticación | Datos que guardamos |
|---|---|---|
| Necesitado | Token portador, sin cuenta | Ninguno personal |
| Ofertador | Google (`sub`) | Nombre visible, municipio, contacto público |
| Servidor | Google (`sub`) | Nombre, profesión, matrícula, contacto público |
| Administrador | Google (`sub`) + tabla `administradores` | — |

La asimetría es intencional: quien pide no se identifica; quien ofrece sí.
La carga de la prueba cae sobre el lado con poder en la transacción.

## Flujos

### F1 — Publicar solicitud

1. Elegir municipio (lista cerrada de municipios afectados)
2. Escribir barrio o comuna (texto corto, validado)
3. Elegir categoría y agregar ítems del catálogo con cantidad
4. Nota opcional, máximo 140 caracteres, validada contra PII
5. Turnstile
6. `POST /api/solicitudes` → RPC `crear_solicitud`
7. Respuesta: `{ codigo, token }`
8. Pantalla de confirmación:
   - Código visible grande (ej. `4F2A`)
   - Enlace guardado en `localStorage`
   - Botones: copiar enlace, descargar QR, "enviármelo por WhatsApp"
   - Ofrecer activar notificaciones (Web Push)
   - Advertencia: "Guarda este enlace. Es la única forma de volver."

### F2 — Ver solicitudes abiertas

Público, sin cuenta. Lista filtrable por municipio y categoría.
Orden: más recientes primero, con badge de frescura.
Nunca muestra token, endpoint push ni nada identificable.

### F3 — Responder una solicitud

Requiere sesión (ofertador o servidor).

1. Abrir solicitud → botón "Puedo ayudar"
2. Mensaje corto (máx. 200 caracteres) + qué ítems puede cubrir
3. Se envía Web Push al solicitante si tiene suscripción
4. La respuesta queda visible **solo** para quien tenga el token

Límite: un autor no puede responder dos veces la misma solicitud.

### F4 — Ver mis respuestas y contactar

El solicitante entra con su enlace, ve las respuestas con el nombre y el
contacto público del ofertador, y decide a quién escribir. El contacto se
abre en WhatsApp o teléfono. **La plataforma no participa.**

Botón "Ya me ayudaron" → marca cumplida → borra la solicitud, deja métrica.

### F5 — Directorio de servidores

Público. Filtrable por profesión y municipio.
Verificados primero, con sello. No verificados con advertencia clara.
Muestra: nombre, profesión, entidad y número de matrícula, municipios,
descripción, contacto público.

Un necesitado puede escribirle directamente por fuera de la plataforma.

### F6 — Renovación y expiración

- A las 60 horas, si hay suscripción push: "¿Sigues necesitando esto?"
- Un toque renueva 72 horas más
- Sin renovación, `DELETE` real al vencer
- La UI degrada visualmente lo que lleva más de 24 h sin confirmar

### F7 — Reportes

Botón visible en cada solicitud, respuesta y perfil.
Motivo de lista cerrada + nota opcional. Va a `reportes`.
El administrador puede ocultar o borrar contenido.

## Catálogo de ítems

Semilla mínima, agrupada por categoría. Ampliable solo por administrador.

- **Alimentación**: agua embotellada, arroz, panela, atún enlatado,
  aceite, sal, café, galletas, fórmula infantil, leche en polvo
- **Aseo**: jabón, papel higiénico, toallas higiénicas, pañales
  (por etapa), crema dental, cepillo, gel antibacterial
- **Salud**: acetaminofén, suero oral, gasas, alcohol, curas, guantes
- **Abrigo**: cobijas, colchonetas, carpas, ropa por talla, calzado
- **Cocina**: ollas, platos, vasos, cubiertos, estufa portátil, pimpinas
- **Otros**: linternas, pilas, velas, bolsas, cargador solar

## Modelo de datos

### `solicitudes`
Sin ningún dato personal. `token_hash` nunca sale al cliente.

### `solicitud_items`
Referencia al catálogo, con cantidad y unidad. Permite calcular qué falta.

### `respuestas`
Autor (ofertador o servidor), mensaje corto, ítems que puede cubrir.
Visible solo con el token de la solicitud.

### `perfiles`
`sub` de Google, nombre visible, tipo, municipios, contacto público
(el ofertador acepta explícitamente que sea público).

### `servidores`
Extiende `perfiles` con profesión, entidad de matrícula, número y estado
de verificación.

### `push_suscripciones`
`ON DELETE CASCADE` desde `solicitudes`.

### `metricas`
Residuo anónimo tras el borrado. Es el aporte que sobrevive al proyecto:
dónde se pidió qué y qué quedó sin atender. Sin texto, sin identificadores.

### `reportes`, `administradores`, `catalogo_items`

## Fuera de alcance (v1)

Mapas, mensajería interna, dinero, alojamiento, menores, transporte de
personas, verificación automática de matrículas, app nativa, multiidioma.
