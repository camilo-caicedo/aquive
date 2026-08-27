# ADR 0008 · El aliado es un centro de acopio

- **Estado:** aceptada
- **Fecha:** 2026-08-26
- **Decide:** responsable del proyecto
- **Depende de:** ADR 0007 (se retira el flujo acompañado), ADR 0004 (mapa)

## Contexto

El ADR 0007 retira el trabajo que tenía el rol de aliado: coordinar
solicitudes acompañadas entre fundaciones. El rol queda vacío, pero la
necesidad que lo justificaba no desapareció del todo — sigue habiendo cosas
físicas que alguien tiene que recibir y entregar.

El responsable decide que el aliado pase a ser eso: **un centro de acopio.**
Un lugar con dirección y horario donde se dejan donaciones y productos.

**Se mantiene el nombre «aliado»** para el rol, por decisión suya: no hace
falta un rol nuevo.

## Por qué se reusa `organizaciones` y no se crea una tabla

Porque la tabla ya era esto a medias. Tiene, desde que se escribió:

```sql
-- Dirección de un acopio, no de una persona: una bodega con horario.
direccion_acopio text check (char_length(direccion_acopio) <= 200),
horario_acopio   text check (char_length(horario_acopio) <= 200),
```

Y trae ya resuelto lo que costaría rehacer: el NIT con su formato, el slug
para `/unirse`, los municipios donde opera, que **la crea un admin y jamás
se auto-registra**, y su equipo con altas y bajas.

## Decisión

Un centro de acopio hace cuatro cosas.

**1 · Aparece en el mapa y en una lista.** Nombre, dirección, horario,
municipio y teléfono, en `/acopios`. Quien tiene algo que donar necesita
saber dónde dejarlo, y hoy no hay dónde mirarlo.

El punto del mapa lo pone quien administra el centro, arrastrando el pin,
igual que un prestador (ADR 0004). **Pero aquí sin casilla de
consentimiento**: la dirección de una bodega no es el domicilio de una
persona, así que no hay una segunda finalidad que autorizar. Es la
diferencia que justifica tratarlos distinto.

**2 · Registra lo que entra y lo que sale.** Reusa `entregas` tal como está:
ítem, cantidad, municipio y fecha, **sin un solo dato personal**, y
sobrevive al borrado de lo que la originó —por eso no tiene llave foránea
hacia la solicitud y lleva el código copiado en texto—. Se le quita
`conversacion_id` y se le añade de dónde vino: una publicación del muro o un
producto.

**3 · Una donación puede indicar su centro.** `publicaciones_muro.acopio_id`
opcional: quien dona elige un centro como punto de entrega en vez de
acordar una dirección por chat. **Así no da la suya**, que es coherente con
todo lo demás — esta aplicación no publica dónde vive nadie.

**4 · Tiene equipo.** `miembros_organizacion` e
`invitaciones_organizacion` sin cambios: un coordinador da de alta a quien
atiende el centro. El slug identifica y el código autoriza, y va en el path,
nunca en query string (regla de interfaz 9).

## Consecuencias

- El panel `/aliado` queda con tres pestañas: Entregas, Equipo y su ficha
  pública. Se van Coincidencias, Conversaciones, Solicitudes y Referencias.
- `organizaciones` gana `telefono`, `latitud` y `longitud`.
- `organizaciones.tipo` conserva sus valores: un centro puede ser una
  fundación, una junta o una entidad pública. Lo que cambia es qué hace,
  no quién puede serlo.
