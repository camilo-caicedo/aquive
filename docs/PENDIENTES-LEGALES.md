# Pendientes que no son código

Bloqueantes reales: ninguno se resuelve programando, y varios bloquean el
despliegue de una funcionalidad que ya está escrita.

Este archivo consolida lo que antes vivía repartido en `PLAN.md`, `PLAN-V2.md`
§12 y §13.8, y `PLAN-V3.md` §7. Esos planes se retiraron del repositorio el
25 de agosto de 2026 por estar ejecutados; su contenido de diseño quedó en la
historia de git, y lo que seguía pendiente quedó aquí.

Marca con `[x]` lo que se cierre, y anota la fecha.

## Bloquean el flujo acompañado

- [ ] **Contrato de transmisión de datos** entre la Fundación Nodo Social
      (responsable) y AquíVe (encargada), artículo 25 del Decreto 1377 de 2013.
      Debe decir explícitamente que la plataforma no retiene datos tras el
      cierre y que la custodia de las planillas exportadas es de la fundación.
      Borrador en `docs/legal/CONTRATO-TRANSMISION.md`.
- [ ] **Registro en el RNBD** ante la SIC, a nombre de la fundación.
- [ ] **Canal de habeas data** — consulta 10 días hábiles, reclamo y supresión
      15 (artículos 14 y 15 de la Ley 1581). Solo aplica al flujo acompañado.
      Tiene que existir y tiene que leerlo alguien: un canal que nadie abre es
      peor que no tenerlo.
- [ ] **Texto de autorización** del flujo acompañado, en
      `docs/legal/PLANTILLAS.md`, revisado por abogado. No hay que rehacer el
      documento entero: el aviso actual sigue siendo cierto para el flujo
      directo. Hay que **agregar** la sección del flujo acompañado y el aviso
      sobre falta de verificación.
- [ ] **Verificación de la fundación**, fuera de la app: certificado de
      existencia del RUES, NIT y persona de contacto. Es lo que el admin mira
      **antes** de crear la organización; por eso no hay cola de verificación
      dentro del producto.

Hasta que estos cinco estén, la pantalla que pide identidad no se despliega.

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

## Pendiente de decisión, no de trámite

- [x] **Subida de imágenes.** Resuelta el 26 de agosto de 2026 por el ADR 0003:
      cualquier imagen, hasta 2 MB, moderada desde el panel de admin antes de
      publicarse. Los dos pasos técnicos obligatorios —reencodificar con `sharp`
      para descartar el EXIF con coordenadas, y borrar el objeto al borrar la
      fila— están en la regla de producto 8 de `CLAUDE.md`.
