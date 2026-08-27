# ADR 0012 · Doce categorías de oficio, no ocho

- **Estado:** aceptada
- **Fecha:** 2026-08-27
- **Decide:** responsable del proyecto
- **Modifica:** la regla de producto 7 de `CLAUDE.md` (un cuarto oficio de
  riesgo alto), la cabecera de `seed-oficios.sql` (entra construcción) y la
  cifra de «ocho categorías» del ADR 0011

## Contexto

El catálogo nació con ocho grupos y cuarenta y cuatro oficios, sacados del §4
del documento de trabajo de la fundación. Es una taxonomía del rebusque de
casa: comida, belleza, confección, transporte, aseo, cuidado, reparación y
otros.

Lo que no cubre se ve mejor por el otro lado. El ADR 0011 dejó a quien pide
escribir con sus palabras qué necesita justamente porque «vamos a tener muchos
oficios que posiblemente no tendremos mapeados». Pero **quien ofrece sí tiene
que elegir de la lista**: `proveedor_oficios` apunta a `catalogo_oficios`, y no
hay campo libre. Si el oficio de una persona no está, esa persona no puede
publicar lo que hace — y esa es la mitad del directorio.

Cuatro ausencias grandes, todas de gente que vive de eso:

- **Quien arregla casas.** Pintura, estuco, enchape, goteras, plomería,
  carpintería de obra, rejas. Es el oficio más común del rebusque y el
  catálogo no tenía ni una entrada: «Reparación» era de electrodomésticos y
  celulares.
- **Quien enseña.** Refuerzo escolar, alfabetización de adultos, clases de
  música, enseñar a usar el celular. Hoy tendría que ponerse en «Otros ·
  Ayudante por día».
- **Quien trabaja en fiestas.** Decoración, sonido, alquiler de sillas,
  meseros, piñatas. La única entrada era «Cocina para eventos», que es otra
  cosa.
- **Quien tiene un computador y ningún capital.** Digitación, impresión,
  volantes, redes de un negocio, trámites por internet. El catálogo solo
  contemplaba *reparar* computadores, no usarlos.

## Decisión

**Cuatro grupos nuevos y treinta y dos oficios nuevos. Doce grupos en total.**

| Grupo nuevo | Nombre visible | Gajo |
| --- | --- | --- |
| `construccion` | Arreglos de la casa | rojo |
| `ensenanza` | Clases y refuerzo | verde |
| `eventos` | Fiestas y eventos | azul |
| `digital` | Computador y trámites | amarillo |

Y ocho oficios más repartidos entre los grupos que ya existían: postres,
masajes de relajación, cejas y pestañas, uñas acrílicas, tejido, transporte de
mascotas, reciclaje, reparación de máquinas de coser y afilado.

### Construcción entra, y su frontera se mantiene

La cabecera de `seed-oficios.sql` decía «Nada de "albañilería" ni "arreglo de
paredes": después de un sismo la frontera con lo estructural no existe». El
responsable decide abrirlo. **Lo que se abre es el oficio; la frontera no se
mueve.**

Entra el trabajo que no exige matrícula y no toca la estructura de un edificio:
pintura, estuco y drywall, enchape, impermeabilización y goteras, plomería de
fugas y destapes, carpintería y closets, rejas y soldadura, y ayudante de obra.

Sigue fuera, y no es negociable por conveniencia de producto porque es la
regla 7 de `CLAUDE.md`:

- **Reconstrucción, refuerzo o revisión estructural** —columnas, vigas, placas,
  muros de carga, dictamen de habitabilidad—. Va a `catalogo_servicios`, que sí
  verifica matrícula contra COPNIA.
- **Gas.** Instalación, revisión o traslado. Exige competencia laboral
  certificada, y una fuga no se equivoca dos veces.
- **Instalaciones eléctricas.** RETIE, y por el mismo motivo.

Por eso `plomeria` se llama «Plomería: fugas y destapes» y no «Plomería»: el
nombre es parte del límite, no adorno. Y por eso el oficio de peón se llama
`obra_menor`, «Ayudante de obra y arreglos menores» — un ayudante trabaja bajo
la dirección de alguien más, que es exactamente la diferencia.

**Cerrajería** tampoco entra. Abrir la cerradura de una casa ajena es acceso a
la vivienda de alguien; si entra algún día, entra como riesgo alto y con su
discusión propia. Lo mismo **fumigación y lavado de tanques**, que llevan
concepto sanitario municipal.

### Un cuarto oficio de riesgo alto

`refuerzo_escolar` nace en `alto`. Es el único de los treinta y dos que lo
hace, y no es prudencia genérica: **es el único que se define por estar a solas
con un menor de edad**, igual que `cuidado_ninos`. Que la excusa sea una tarea
de matemáticas y no un biberón no cambia la exposición.

La línea que separa alto de bajo dentro de los grupos nuevos es esa, y solo
esa:

- `animacion_infantil` es **bajo**: una fiesta ocurre con la familia delante.
- `clases_musica` es **bajo**: lo define el instrumento, no la edad de quien
  aprende. Si algún día se ofrece explícitamente «clases para niños en su
  casa», eso es otro oficio y nace en alto.
- Ningún oficio de construcción es alto: el daño de un mal actor ahí es
  económico, que es justo lo que `alto` no significa.

Con esto la regla de producto 7 pasa de tres oficios de riesgo alto a cuatro.
Ninguno baja de alto a bajo: eso sería una decisión sobre personas, y el propio
`seed-oficios.sql` lo dice.

### El reparto de gajos se rebalancea

Doce grupos entre cuatro colores, tres cada uno. Los que se confunden entre sí
siguen en colores distintos: reparación (azul) contra construcción (rojo),
cuidado (rojo) contra enseñanza (verde), belleza (rojo) contra eventos (azul),
reparación (azul) contra digital (amarillo).

El color sigue sin informar solo: cada tarjeta lleva la palabra del grupo
encima (regla de interfaz 9).

## Alternativas consideradas

**Dejar «Otros» absorbiéndolo todo.** Es lo que pasa hoy, y por eso quien
enseña aparece como «Ayudante por día». Un grupo que significa cualquier cosa
no se puede buscar ni filtrar, y `/categorias` lo muestra como una tarjeta más
sin decir qué hay dentro.

**Meter construcción dentro de «Reparación».** Ahorra un grupo y junta arreglar
una nevera con enchapar un baño. Son dos clientelas y dos escalas de trabajo
distintas; el filtro dejaría de servirle a las dos.

**Campo libre también para quien ofrece.** Simétrico con el ADR 0011 y mucho
peor aquí: el oficio de una ficha es lo que gobierna la regla 7. Si el oficio
es texto, «cuidado de niños» escrito a mano se salta el filtro de riesgo alto
entero, y «reconstrucción estructural» se salta el de matrícula. Por eso
`catalogo_oficios` sigue siendo cerrado, y el ADR 0011 lo dejó dicho.

**Un grupo enorme «Servicios varios».** Junta enseñanza, fiestas y computador
en algo que no significa nada. Grupos de seis o siete oficios se leen; uno de
veinte, no.

## Qué reglas duras cambian de garante

| Regla | Hoy | Después |
| --- | --- | --- |
| Regla 7 · el oficio de riesgo alto no se publica sin respaldo | tres oficios en `alto`: cuidado de niños, cuidado de dependientes, transporte de pasajeros | **cuatro**: entra `refuerzo_escolar`, con el mismo criterio —a solas con un menor— y el mismo filtro de la vista |
| Regla 7 · lo que exige matrícula no entra en `catalogo_oficios` | estructural, salud, gas, eléctricas, jurídica | **igual, sin cambio**. Construcción entra por lo que no lo exige, y el nombre de cada oficio lleva el límite escrito |
| ADR 0011 · «la categoría sale de las ocho de `GRUPOS`» | ocho | **doce**. La forma no cambia: sigue siendo una lista corta, cerrada, que cabe en una pantalla |

Ninguna del mínimo legal. Un grupo de oficio no es un dato personal.

## Consecuencias

**Positivas.** El oficio más común del rebusque deja de estar ausente del
directorio, y otros tres dejan de tener que disfrazarse de «Otros».
`/categorias` gana cuatro puertas con nombre. Y quien pide gana cuatro
categorías que antes no podía elegir en el primer paso.

**Negativas.** Doce tarjetas en `/categorias` son seis filas en un teléfono,
contra cuatro. Se acepta porque esa pantalla ya solo muestra los grupos que
tienen a alguien detrás: hasta que haya un pintor publicado, la tarjeta no
aparece.

Y el riesgo de que la frontera de lo estructural se cruce en la práctica —una
ficha de «Estuco y drywall» que en realidad levanta un muro— existe y no lo
cierra el catálogo. Lo cierra la moderación, igual que el resto: la cola de
`/admin` es donde se mira una ficha que promete más de lo que su oficio dice.

**Neutras.** El reparto de gajos deja de ser 2–2–2–2 y pasa a 3–3–3–3. Que un
color se repita tres veces no rompe nada mientras la palabra vaya encima, que
es lo que la regla 9 exige.

## Plan

1. Migración: ensanchar los dos `CHECK` de `grupo` —el de `catalogo_oficios` y
   el de `solicitudes_servicio`—, que son la garantía real.
2. `seed-oficios.sql`: los treinta y dos oficios, con la cabecera reescrita
   —qué se abre y qué sigue prohibido— y el porqué de `refuerzo_escolar`.
3. `GrupoOficio` y `NOMBRE_GRUPO` en el contrato; el union de `types.ts`;
   `POR_GRUPO` en `familias.ts`.
4. `CLAUDE.md`: la regla 7 y la cifra del ADR 0011.

## Revisión

Cuando haya fichas publicadas en los cuatro grupos nuevos, mirar si alguno se
quedó vacío. Un grupo sin nadie detrás durante meses es una hipótesis que no se
cumplió, y se retira igual que se agregó.

Y mirar las fichas de construcción una por una la primera vez: es el grupo
donde el nombre del oficio y lo que la persona escribe en su presentación
pueden separarse, y donde eso importa.
