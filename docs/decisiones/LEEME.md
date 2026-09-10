# Decisiones de arquitectura y producto

Aquí queda escrito **por qué** el proyecto es como es. El código dice qué hace;
estos documentos dicen qué se descartó y a cambio de qué.

Se escribe un ADR cuando una decisión:

- cambia el **núcleo invariante** de `CLAUDE.md` (reglas duras, alcance cerrado,
  accesibilidad), o
- cambia **quién sostiene** una regla dura — por ejemplo, una garantía que pasa
  del motor de base de datos a la capa de dominio, o
- cambia la **arquitectura**, o
- rehace un **flujo** o una parte del **sistema de diseño**.

No hace falta ADR para arreglar un bug, renombrar algo o mover una pantalla de
sitio sin cambiar el flujo.

El ADR se escribe **antes** del código. Si una tarea te obliga a contradecir
`CLAUDE.md` y no hay ADR que lo respalde, detente y pregunta.

## Índice

| # | Decisión | Estado |
| --- | --- | --- |
| [0001](0001-backend-tipado-en-typescript.md) | Backend tipado en TypeScript sobre Next.js | aceptada |
| [0002](0002-identidad-visual-carreta.md) | La identidad de la carreta reemplaza a la del gato | aceptada |
| [0003](0003-nuevo-flujo-alcance-e-imagenes.md) | Flujo nuevo, alcance nuevo y subida de imágenes | aceptada |
| [0004](0004-mapa-con-ubicacion-del-prestador.md) | El mapa muestra dónde está cada prestador | aceptada |
| [0005](0005-sin-esqueleto-de-carga.md) | Fuera el esqueleto de carga, porque impedía hidratar | aceptada |
| [0006](0006-cuenta-para-todo.md) | Cuenta para todo | aceptada |
| [0007](0007-fuera-el-flujo-acompanado.md) | Se retira el flujo acompañado | aceptada |
| [0008](0008-el-aliado-es-un-centro-de-acopio.md) | El aliado es un centro de acopio | aceptada |
| [0009](0009-un-solo-chat.md) | Un solo chat, para toda la aplicación | aceptada |
| [0010](0010-la-portada-es-la-bienvenida.md) | La portada es siempre la bienvenida | aceptada |
| [0011](0011-la-solicitud-dice-que-necesita.md) | Quien pide elige categoría y escribe qué necesita | aceptada |
| [0012](0012-mas-categorias-de-oficio.md) | Doce categorías de oficio, no ocho | aceptada |
| [0013](0013-categoria-y-subcategoria.md) | Categoría y subcategoría, en los dos lados | aceptada |
| [0014](0014-fuera-el-modulo-de-insumos.md) | Se retira el módulo de insumos | aceptada |
| [0015](0015-la-cuenta-es-de-cualquiera.md) | La cuenta es de cualquiera, y no dice a qué vino | aceptada |
| [0016](0016-la-version-minima.md) | Fuera el muro de necesidades y las solicitudes abiertas | aceptada |
| [0017](0017-la-solicitud-es-una-orden.md) | La solicitud es una orden dirigida a un prestador | aceptada |
| [0018](0018-la-sombrilla-abre-el-menu.md) | La sombrilla abre el menú | aceptada |
| [0019](0019-municipio-barrio-y-direccion.md) | Municipio, barrio y dirección, cada uno con lo suyo | aceptada |
| [0020](0020-destacados-en-inicio.md) | Vuelve una sección de destacados a `/inicio` | aceptada |
| [0021](0021-la-calificacion-pesa-mas-en-la-ficha.md) | La ficha sube la prominencia visual de la calificación | aceptada |
| [0022](0022-la-ficha-absorbe-pedir-un-servicio.md) | La ficha absorbe el flujo de pedir un servicio | aceptada |
| [0023](0023-la-matricula-pierde-su-puerta-en-el-perfil.md) | La matrícula pierde su puerta de autoservicio en el perfil | aceptada |
| [0024](0024-se-retira-datos-abiertos.md) | Se retira la pantalla «Datos abiertos» | aceptada |
| [0025](0025-el-precio-admite-un-techo.md) | El precio admite un techo opcional, además del piso | aceptada |
| [0026](0026-nombre-de-negocio-y-horarios-por-hora.md) | Nombre de negocio y horario por hora exacta, sumados sin reemplazar | aceptada |

## Plantilla

```markdown
# ADR NNNN · Título en una línea

- **Estado:** propuesta | aceptada | reemplazada por ADR NNNN
- **Fecha:** AAAA-MM-DD
- **Decide:** quién
- **Reemplaza:** qué regla o qué ADR, si aplica

## Contexto

Qué cambió en el mundo para que esto haya que decidirlo. Con datos, no con
adjetivos: cuántas líneas, cuántas pantallas, qué pidió quién.

## Decisión

Qué se hace. En presente y en afirmativo.

## Alternativas consideradas

Una por una, cada una con la razón concreta por la que se descarta. Una
alternativa sin razón escrita es una alternativa que nadie miró de verdad, y en
seis meses alguien la va a proponer otra vez.

## Qué reglas duras cambian de garante

Tabla: regla, quién la sostiene hoy, quién la sostiene después, con qué se
compensa la diferencia. Si ninguna cambia, dilo explícitamente — es información,
no una sección vacía.

## Consecuencias

Positivas, negativas y neutras. Las negativas son obligatorias: una decisión sin
costo escrito es una decisión que no se pensó.

## Plan

Los pasos, en orden, y qué se puede hacer en paralelo.

## Revisión

Bajo qué condición se vuelve a mirar esta decisión.
```
