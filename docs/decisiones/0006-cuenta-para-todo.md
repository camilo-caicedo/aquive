# ADR 0006 · Cuenta para todo

- **Estado:** aceptada
- **Fecha:** 2026-08-26
- **Decide:** responsable del proyecto
- **Reemplaza:** la asimetría de la regla de producto 4 y la sección
  «Autenticación» de `CLAUDE.md`
- **Depende de:** ADR 0001 (backend tipado)

## Contexto

Hasta hoy la aplicación tenía dos clases de usuario y esa asimetría era
deliberada:

> Quien **pide** —un servicio o un insumo— sigue publicando sin cuenta y sin
> dar datos […]. Esa asimetría con quien ofrece **se sostiene en el modelo de
> datos**, no en que la interfaz se acuerde.

Quien pedía se llevaba un token portador —32 bytes, se guardaba solo su
`sha256`, se mostraba una vez— y con él volvía a lo suyo. Quien ofrecía
necesitaba cuenta, porque publica su nombre y su teléfono.

El responsable decide que **todo exige cuenta**: crear una solicitud, poner
un producto, publicar una donación y recibir cualquier cosa.

## Decisión

Una sola manera de ser dueño de algo: `perfil_id`. Desaparecen los tokens
portadores de `solicitudes`, `solicitudes_servicio`, `publicaciones_muro` y
`proveedores`.

**Quien no tiene cuenta de Google la recibe de un admin.** Se le crea un
usuario de verdad, con un identificador sintético —`<uuid>@sin-correo…`, no
su correo, que se sigue sin guardar— y se le entrega un enlace de acceso en
mano o por WhatsApp. Es lo que ya hacía `crear_proveedor_asistido` para las
fichas, generalizado a la persona.

## Lo que se pierde, dicho sin adornos

**Quien no tiene cuenta de Google no puede pedir ayuda hasta que un admin lo
dé de alta.** Eso es una barrera, y cae justo sobre el público que esta
aplicación busca: gente en el rebusque y en albergues, con teléfonos viejos
y a veces sin correo.

Antes, esa persona publicaba sola y en un minuto. Ahora depende de que haya
un admin disponible. La decisión es del responsable y queda registrada como
tal; lo que no puede pasar es que se tome creyendo que no cuesta nada.

Lo que se gana a cambio: una sola forma de identidad en todo el modelo, la
posibilidad de recuperar lo propio sin depender de un papel con un token, y
que quien recibe algo tenga a quién responder.

## Lo que NO cambia

**La PQR sigue abierta sin cuenta**, y no es negociable. Es el canal de
habeas data: la Ley 1581 de 2012, artículos 14 y 15, le da a cualquier
titular el derecho a consultar, reclamar y pedir supresión de sus datos.
Condicionar ese derecho a tener cuenta de Google lo haría inejercible —y
además sería absurdo: parte de quien reclama lo hace *porque* quiere dejar
de estar en la plataforma.

`pqr.token_hash` se queda. Es la única puerta sin cuenta que sobrevive.

**Tampoco cambia qué se le pide a quien pide.** Tener cuenta no es lo mismo
que dar datos: una solicitud sigue llevando oficio o categoría, municipio,
zona, urgencia, capacidad de pago y la nota filtrada, y nada más. El nombre
de quien pide no se publica.

## Consecuencias

- Se borran las filas sin dueño que existan al desplegar, con sus imágenes
  del almacén. Decisión del responsable: eran 11 solicitudes de servicio y 4
  publicaciones del muro, todas de prueba.
- Desaparecen las rutas por token: `/solicitud/[token]`,
  `/servicios/solicitud/[token]`, `/servicios/mi-perfil/[token]`,
  `/mis-datos/[token]` y `/responder/[codigo]`. Lo suyo cuelga de `/perfil`.
- Se va el `localStorage` que recordaba los tokens de este teléfono. Con
  ello desaparece el fallo abierto del README —la lista que no siempre
  aparecía—, que era exactamente eso.
- Quien llega sin sesión a una pantalla de publicar **ve la pantalla y el
  motivo**, con el enlace para entrar. No se le rebota a `/login`: es la
  misma regla que ya sigue `/perfil`.
