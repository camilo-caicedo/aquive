# ADR 0007 · Se retira el flujo acompañado

- **Estado:** aceptada
- **Fecha:** 2026-08-26
- **Decide:** responsable del proyecto
- **Retira:** el módulo de fundaciones aliadas del Flujo 2

## Contexto

La aplicación tenía un segundo recorrido para el módulo de emergencia: una
solicitud podía marcarse como **acompañada** y entonces la atendía una
fundación aliada. Alrededor de eso vivía:

- **Hilos de tres.** Quien pide, quien ofrece y un aliado a cargo. Un
  trigger impedía que se escribiera sin aliado asignado, y no la interfaz.
- **Identidades cifradas.** El nombre y el documento de quien pedía, con
  AES-256-GCM, y una bitácora —`accesos_identidad`— que registraba cada
  lectura con su motivo y sobrevivía al borrado del dato.
- **Coincidencias.** El cruce de qué tiene una fundación contra lo que se
  está pidiendo en sus municipios.
- **Entregas** coordinadas con doble confirmación.

Son unas 3.500 líneas entre pantallas, paneles y dominio.

## Por qué se va

**Ya no es el enfoque.** AquíVe es de la Fundación Nodo Social y no va a
haber otras fundaciones aliadas; lo general lo hacen ahora los admins de la
aplicación. Sin ese reparto, un flujo pensado para coordinar entre
organizaciones no coordina nada.

**Y estaba muerto.** Al decidirlo, en la base había **0 entregas, 0
identidades, 0 conversaciones y 0 mensajes**. Nunca se usó en producción.

**Un módulo que nadie mantiene es el que un día se despierta con un fallo.**
Enterrarlo sin borrarlo deja código sin ruta que llega igual a producción,
tablas con datos cifrados de algo que ya no existe, y una bitácora legal que
custodia lecturas que ya nadie hace.

## Decisión

Se borra entero: código, rutas y tablas.

| Tabla | Qué era |
| --- | --- |
| `identidades` | Nombre y documento cifrados de quien pedía acompañado |
| `accesos_identidad` | Bitácora de cada lectura de lo anterior |
| `conversaciones` | El hilo de tres |
| `mensajes` | Sus mensajes |

Y `entregas.conversacion_id`, que es lo único que las ataba.

## ⚠ Lo que NO se toca

**El chat de servicios se queda.** `chats_servicio` y `mensajes_servicio`
son otra cosa: la regla de producto 2, el chat que se abre por un pedido de
servicio y muere con él. No confundirlos al borrar.

**`entidades` se queda.** Es el directorio público de organizaciones
externas —Cruz Roja, Defensa Civil, líneas de atención— y no tiene ninguna
relación con esto.

**`organizaciones`, `miembros_organizacion`, `invitaciones_organizacion` y
`entregas` se quedan**, con otro trabajo: pasan a ser centros de acopio.
Ver ADR 0008.

## Consecuencias

- Lo que era trabajo general del aliado pasa a `/admin`: el muestreo de
  referencias y las zonas propuestas.
- `/mensajes` queda con los chats de servicio y nada más. Deja de aplicar el
  comentario que explicaba por qué eran «una sola bandeja».
- La quinta celda de la barra deja de tener dos públicos: solo el equipo de
  un centro de acopio.
- Se retira el cifrado de identidades. Era lo único que usaba
  `node:crypto` con AES-256-GCM en la capa de dominio.
