# ADR 0004 · El mapa muestra dónde está cada prestador

- **Estado:** aceptada
- **Fecha:** 2026-08-26
- **Decide:** responsable del proyecto
- **Reemplaza:** la regla de producto 10 de `CLAUDE.md`
- **Depende de:** ADR 0002 (identidad), ADR 0003 (flujo)

## Contexto

La regla de producto 10 decía, hasta hoy: «Los mapas agregan por zona, nunca
por persona. La granularidad máxima es municipio y barrio o comuna. Sin
librería de mapas y sin geocoding.»

El responsable pide un mapa real con un pin por prestador. Se le presentaron
tres opciones —zonas, municipios o personas— con la advertencia de que la
tercera contradice la regla 10 y publica dónde encontrar a alguien que trabaja
solo en la calle. **Eligió personas, y lo reafirmó por escrito.** Esta decisión
es suya y queda registrada como tal.

Hecho que condicionaba todo: en la base **no había una sola coordenada**. Ni en
`zonas`, ni en `municipios`, ni PostGIS. Así que esto no era integrar una
librería, era decidir de dónde salen unos datos que no existían.

## Decisión

Un mapa con Leaflet, un pin por prestador, alimentado por coordenadas que el
propio prestador pone.

### Piezas

| Qué | Cómo |
| --- | --- |
| Librería | Leaflet 1.9, cargada solo en el navegador (`dynamic`, `ssr: false`) |
| Teselas | OpenStreetMap directo, con atribución ODbL |
| Coordenadas | Las pone el prestador arrastrando el pin |
| Geocoding | **Ninguno** |
| Almacenamiento | Dos `numeric(9,6)` en `proveedores` |
| Consentimiento | `acepto_mapa`, aparte del de publicación |

### Que el prestador ponga su propio pin no es un atajo

Era la alternativa a un servicio de geocoding, que habría costado dinero —el
responsable pidió que todo fuera gratis— pero además resuelve algo que el
geocoding empeora: **cada quien elige su precisión**. Se puede marcar la
esquina en vez del portón, o la cuadra en vez de la casa. Un geocodificador
convierte «Calle 5 #23-40» en el punto exacto de esa puerta, sin preguntar.

### El consentimiento es una casilla nueva, no la que ya había

`acepto_mapa` es distinto de `acepto_publicacion`, y no es celo de más: el
artículo 9 de la Ley 1581 exige autorización previa e informada **con finalidad
declarada**. Quien aceptó que se publicara su nombre y su teléfono no aceptó
con eso que se publicara dónde está — es otra finalidad. Reutilizar la casilla
vieja sería dar por dado un consentimiento que nadie dio.

Lleva su propia versión y su propia fecha, como la otra: el día que alguien
pregunte qué autorizó y cuándo, la respuesta tiene que estar en la fila.

**Quien no la marca sigue apareciendo en el directorio.** No hay penalización
por no querer salir en el mapa, y la pantalla del mapa dice cuántas personas
más hay en la lista — si no, quien ve seis pines cree que hay seis personas.

### El filtro vive en la vista, no en las consultas

`proveedores_publicos` devuelve `latitud` y `longitud` en `NULL` para quien no
marcó `acepto_mapa`. Es el mismo patrón que la regla de producto 7: si el
filtro se duplica en cada consulta, un día una de las copias se olvida — y aquí
olvidarse significa publicar dónde encontrar a alguien que no lo autorizó.

Verificado contra la base de pruebas: al quitar `acepto_mapa`, la coordenada
sigue guardada en la tabla y la vista pública devuelve `null`.

## Qué reglas cambian

| Regla | Antes | Ahora |
| --- | --- | --- |
| 10 · Granularidad | máximo barrio o comuna, sin librería de mapas | punto exacto **si el prestador lo autoriza**, con Leaflet |
| Mínimo legal 2 | autorización para publicar nombre y teléfono | **más** una autorización aparte para la ubicación |

Lo que **no** cambia: quien **pide** un servicio sigue sin dejar rastro. Este
ADR es sobre quien ofrece, que publica con consentimiento. Una solicitud sigue
sin municipio más fino que barrio y sin coordenadas.

## Alternativas consideradas

**Pines por zona** (comuna, barrio). Era mi recomendación y la que dibuja el
prototipo. Descartada por el responsable. Habría necesitado centroides por
ciudad: Cali los tiene en datos abiertos, el resto hay que buscarlos uno a uno
y mantenerlos.

**Pines por municipio.** Centroides del DANE, un archivo público, se siembran
una vez. Seguro y barato, pero «Cali: 14 personas» no dice más que la lista que
ya existe.

**PostGIS.** Descartado. No hay ninguna consulta espacial que hacer: el mapa
dibuja lo que la lista ya filtró. Sería infraestructura para una pregunta que
nadie hace.

**Un proveedor de teselas de pago** (MapTiler y similares). Descartado por
coste, por petición expresa.

## Consecuencias

### Positivas

- Buscar «una modista cerca» pasa a ser una pregunta que la pantalla contesta.
- La coordenada la controla quien la publica, no un algoritmo.
- Sin dependencia de un servicio externo de pago.

### Negativas, y hay que mirarlas

- **La política de uso de OpenStreetMap prohíbe el uso intensivo.** Con tráfico
  de fundación pequeña se tolera; si el proyecto crece hay que pasar a teselas
  propias (Protomaps sirve un `.pmtiles` desde el propio alojamiento y sigue
  siendo gratis) o a un proveedor con plan. **Esto no es opcional a futuro: es
  una cuenta pendiente.**
- **El navegador de quien mira le manda su IP y qué zona está viendo al
  servidor de teselas.** Es una petición a un tercero y el aviso de privacidad
  tiene que decirlo.
- **Leaflet pesa ~42 KB comprimido más su CSS.** Va en carga diferida, así que
  solo lo paga quien abre el mapa — pero lo paga, y el público del proyecto usa
  teléfonos viejos con datos contados.
- Aparece una superficie nueva de moderación: un pin mal puesto —o puesto en
  casa de otro— es un reporte que alguien tiene que atender.

### Riesgo que se acepta a sabiendas

Publicar la ubicación de una persona que trabaja sola aumenta su exposición.
Las mitigaciones que se implementan son: consentimiento expreso y separado,
precisión elegida por la propia persona, posibilidad de quitarse del mapa sin
perder la ficha, y el aviso en pantalla de que un pin no es una invitación a
presentarse sin avisar.

No eliminan el riesgo. Lo reducen.

## Pendiente antes de producción

- [ ] Texto de autorización de ubicación, revisado por abogado, en
      `docs/legal/PLANTILLAS.md`.
- [ ] Aviso de privacidad: decir que el mapa hace peticiones a un servidor de
      teselas de terceros y qué le llega.
- [ ] Revisión jurídica del riesgo de publicar ubicaciones de personas.
- [ ] Decidir el proveedor de teselas de producción antes de que el tráfico
      crezca.

Están en `docs/PENDIENTES-LEGALES.md`.

## Revisión

Se revisa si aparece un incidente de seguridad relacionado con un pin, si
OpenStreetMap corta el servicio por volumen, o si la tasa de prestadores que
aceptan el mapa resulta tan baja que la pantalla no vale lo que cuesta.
