# Pendientes que no son código

> **Al día del 27 de agosto de 2026.** Una auditoría del código encontró que
> tres de las contradicciones que este documento anotaba ya no eran
> contradicciones: eran **falsedades**. Los términos decían «guardamos tu
> nombre, tu documento y un teléfono, cifrados» y el aviso de privacidad
> describía el flujo acompañado entero, los dos retirados por el ADR 0007.
> Esos bloques se quitaron del código. Lo que queda escrito abajo es lo que
> sigue faltando, y la mayoría no se resuelve programando.
>
> Se cerraron además dos huecos que sí eran de código y estaban en el mínimo
> legal: `perfiles` publicaba nombre y teléfono **sin guardar la versión de
> la autorización** (artículo 9), y la PQR no tenía cómo leerse ni
> responderse —`estado = 'respondida'` era inalcanzable—, así que los plazos
> de los artículos 14 y 15 no se podían cumplir por ninguna vía del producto.

Bloqueantes reales: ninguno se resuelve programando, y varios bloquean el
despliegue de una funcionalidad que ya está escrita.

Este archivo consolida lo que antes vivía repartido en `PLAN.md`, `PLAN-V2.md`
§12 y §13.8, y `PLAN-V3.md` §7. Esos planes se retiraron del repositorio el
25 de agosto de 2026 por estar ejecutados; su contenido de diseño quedó en la
historia de git, y lo que seguía pendiente quedó aquí.

Marca con `[x]` lo que se cierre, y anota la fecha.

## Bloquean el uso de datos personales reales

- [ ] **Registro en el RNBD** ante la SIC, a nombre de la fundación. Es el
      único de esta lista que bloquea operar con datos reales, sin más
      matices.
- [x] **Canal de habeas data** — consulta 10 días hábiles, reclamo y
      supresión 15 (artículos 14 y 15 de la Ley 1581). Existe en `/pqr`,
      con los plazos legales, y **es la única puerta que no exige cuenta**
      (ADR 0006): condicionar ese derecho a tener cuenta de Google lo haría
      inejercible. Falta lo que no es código: que alguien lo lea.
- [ ] **Texto de autorización de la cuenta creada por un admin**, en
      `docs/legal/PLANTILLAS.md`, revisado por abogado. Desde el ADR 0006 un
      admin crea cuentas para quien no tiene Google, y esa persona tiene que
      autorizar en ese momento, con el guion leído en voz alta y la versión
      del texto guardada con su fecha.
- [ ] **Verificación del centro de acopio**, fuera de la app: certificado de
      existencia del RUES, NIT y persona de contacto. Es lo que el admin mira
      **antes** de crearlo; por eso no hay cola de verificación dentro del
      producto.

> **Retirados el 26 de agosto de 2026, con el flujo acompañado (ADR 0007).**
> El *contrato de transmisión de datos* entre la fundación (responsable) y
> AquíVe (encargada) existía porque una fundación aliada trataba datos de
> terceros dentro de la plataforma. Ya no hay fundaciones aliadas ni datos
> de terceros: se borran `identidades` y `accesos_identidad`, y con ellas
> el supuesto que lo exigía. Si algún día vuelve algo parecido, el borrador
> sigue en `docs/legal/CONTRATO-TRANSMISION.md`.

## Bloquean el módulo de Servicios

- [ ] **Contrato de encargo firmado** con la Fundación Nodo Social, donde ella
      es responsable y AquíVe encargada. Es el reparto inverso al de
      `docs/legal/CONTRATO-TRANSMISION.md`; leerlo entero antes de escribir el
      nuevo. Borrador en `docs/legal/CONTRATO-SERVICIOS.md`.
- [ ] **Registro del módulo en el RNBD** a nombre de la fundación.
- [ ] **NIT del certificado del RUES y correo de habeas data** que la fundación
      vaya a atender. Van en `src/lib/config.ts`. Hasta entonces el aviso de
      privacidad de Servicios está incompleto y no se puede publicar.
- [ ] **Texto de autorización del proveedor** y **texto de consentimiento de la
      persona que sirve de referencia**, los dos en `docs/legal/PLANTILLAS.md` y
      los dos revisados por abogado.
- [ ] **Revisión jurídica de la ampliación de alcance** a transporte y cuidado
      de personas. Es donde más crece la exposición del proyecto.
- [ ] **Reescribir los términos, sección 3.** Hoy dicen literalmente «No hay
      estrellas, ni reputación, ni sellos de "confiable", y no los va a haber».
      Van a existir, y el texto tiene que explicar qué los sostiene —código de
      servicio, teléfono verificado, referencia— en vez de fingir que la frase
      anterior nunca estuvo.
- [ ] **Reescribir el aviso de privacidad en dos regímenes**, sin diluir la
      promesa actual: «si publicas una solicitud de ayuda no guardamos ningún
      dato tuyo» sigue siendo cierta y tiene que seguir leyéndose así de fuerte.
- [ ] **Que la fundación pueda sostener la moderación.** Si no hay quien modere,
      las insignias mienten y el reparto de papeles se cae en la práctica aunque
      el papel esté firmado.

## Configuración antes de un lanzamiento

- [ ] `src/lib/config.ts → RESPONSABLE`: nombre completo real. Aparece en el
      texto de autorización que se acepta, así que tiene efecto legal.
- [ ] `src/app/privacidad/page.tsx` y `src/app/terminos/page.tsx`: reemplazar
      `[CORREO]` y `[FECHA]`.
- [ ] Variables de entorno: `VAPID_SUBJECT` con el correo real del proyecto, y
      las llaves reales de anti-abuso. **Las de prueba dejan pasar a
      cualquiera.**
- [ ] En Cloudflare Turnstile, agregar el dominio de producción a los hostnames
      del widget.
- [ ] Confirmar **Point-in-Time Recovery desactivado**. No es un olvido: PITR
      contradiría la promesa de borrado duro de la regla 4, y el aviso al
      usuario mentiría.
- [ ] Insertar la primera fila en `administradores` a mano, con el id del
      usuario que va a moderar. Sin eso, `/admin` no es accesible para nadie.

## Resuelto · uso comercial del alojamiento

- [x] **Se paga el alojamiento.** Decisión del responsable, 26 de agosto de 2026:
      el proyecto pasa a Vercel Pro. La restricción de «solo uso personal no
      comercial» del plan gratuito deja de aplicar, y con ella la zona gris que
      abría la fundación operando la plataforma. Ya no hace falta consultar a
      soporte.

La regla de no poner botón de donar **sigue en pie**, pero ahora por decisión de
producto —la plataforma no mueve dinero— y no por los términos del alojamiento.

## Nuevo · lo que el rediseño agrega a los textos legales

El chat interno y la subida de imágenes cambian promesas que los textos
actuales hacen. Van antes de publicar cualquiera de las dos:

- [ ] **Aviso de privacidad: mensajería.** Hoy promete que no hay mensajería
      interna. Ahora hay chat de servicios, que se borra con el pedido que lo
      abrió. Hay que decirlo, y decir cuánto vive.
- [ ] **Aviso de privacidad: imágenes.** Qué se guarda, dónde, cuánto vive, que
      se moderan antes de publicarse y que se borran con su publicación.
- [ ] **Términos: moderación de imágenes.** Criterios de rechazo y qué pasa con
      una cuenta que sube contenido rechazado varias veces.
- [ ] **Términos, sección 3.** Siguen diciendo «No hay estrellas, ni reputación,
      ni sellos de "confiable", y no los va a haber». Van a existir.
- [ ] **Autorización de publicación** para quien publica en el muro y en «Hecho
      en el barrio»: aparecen su nombre y su foto, así que necesita casilla
      explícita y versión guardada, igual que el prestador.

## Contradicciones dentro de los textos legales actuales

Encontradas el 26 de agosto de 2026 al repasar las pantallas. **No son
desactualización: son dos frases del mismo documento que no pueden ser ciertas
a la vez.** Tienen efecto legal y hay que resolverlas antes de publicar nada.

- [ ] **El documento de identidad.** `privacidad` y `terminos` §4b dicen
      «guardamos tu nombre, **tu documento** y un teléfono, cifrados».
      `privacidad` afirma en negrita, más abajo, «**No pedimos ni guardamos
      números de documento**». Una de las dos es falsa. `CLAUDE.md` y el
      esquema dicen que `identidades` sí lo guarda.

      **Se resuelve al tocar los textos** (ADR 0007): la tabla
      `identidades` se borra, así que la frase verdadera pasa a ser la de la
      negrita — no se piden ni se guardan documentos. Lo que hay que hacer es
      quitar el §4b, no elegir entre las dos.
- [ ] **«No guardamos ningún dato tuyo».** El título del régimen de emergencia
      lo afirma, y dos párrafos después el mismo documento explica el contacto
      opcional y el flujo acompañado con nombre y teléfono cifrados. El título
      se contradice consigo mismo.

      Con el flujo acompañado fuera (ADR 0007) queda solo el contacto
      opcional, así que basta con que el título deje de prometer un absoluto:
      hay que decir qué se guarda, que es poco.
- [ ] **Quién opera y quién responde.** `terminos` dice «operado por
      {RESPONSABLE}» mientras `privacidad` ya nombra a la fundación como
      responsable del tratamiento. Puede ser correcto —operador y responsable
      no son lo mismo— pero conviene revisarlo junto.

## Bloquean el mapa (ADR 0004)

- [ ] **Texto de autorización de ubicación**, revisado por abogado, en
      `docs/legal/PLANTILLAS.md`. Es una autorización APARTE de la de publicar
      nombre y teléfono: otra finalidad, otro consentimiento (artículo 9).
- [ ] **Aviso de privacidad: el servidor de teselas.** El mapa hace peticiones
      a OpenStreetMap desde el navegador de quien mira, así que a ese tercero
      le llegan su IP y qué zona está viendo. Hay que decirlo.
- [ ] **Revisión jurídica del riesgo** de publicar la ubicación de personas que
      trabajan solas. La decisión está tomada y registrada; lo que falta es que
      un abogado mire la exposición.
- [ ] **Proveedor de teselas para producción.** La política de OpenStreetMap
      prohíbe el uso intensivo. Con tráfico pequeño se tolera; al crecer hay
      que pasar a teselas propias (Protomaps, gratis y autoalojado) o a un plan
      de pago. No es opcional a futuro: es una cuenta pendiente.

## Pendiente de decisión, no de trámite

- [x] **Subida de imágenes.** Resuelta el 26 de agosto de 2026 por el ADR 0003:
      cualquier imagen, hasta 2 MB, moderada desde el panel de admin antes de
      publicarse. Los dos pasos técnicos obligatorios —reencodificar con `sharp`
      para descartar el EXIF con coordenadas, y borrar el objeto al borrar la
      fila— están en la regla de producto 8 de `CLAUDE.md`.
