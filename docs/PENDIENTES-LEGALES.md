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

## Zona gris sin resolver · uso comercial del alojamiento

El plan gratuito de Vercel es «solo uso personal no comercial», y Vercel define
comercial como cualquier despliegue usado para el beneficio económico de
**cualquiera** involucrado en **cualquier parte** de la producción del
proyecto, incluido un consultor pagado que escriba el código. Y textualmente:
*«Asking for Donations fall under commercial usage.»*

La regla de `CLAUDE.md` de nunca poner botón de donar es correcta y está
verificada contra la fuente.

Con la fundación a cargo, la lectura se complica. Mientras nadie cobre por
operar esto y no haya pasarela ni donaciones, el argumento de que sigue siendo
no comercial se sostiene. Se debilita si la fundación tiene personal asalariado
cuya función incluye operar la plataforma.

- [ ] **Preguntarle a soporte de Vercel.** Es gratis. Conviene resolverlo antes
      de crecer, no después, y no se resuelve adivinando.

Si al final toca pagar: Supabase Pro desde 25 USD/mes y Vercel Pro 20 USD/mes
por asiento. Nada de lo que hay hoy lo obliga.

## Pendiente de decisión, no de trámite

- [ ] **Subida de imágenes.** Choca con la regla 1 y necesita ADR antes de la
      primera línea de código. Ver `CLAUDE.md`, «Pregunta abierta · imágenes y
      datos personales».
