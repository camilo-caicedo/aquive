# Contrato de transmisión de datos personales

> **Borrador. No es asesoría jurídica.** Está escrito para que un abogado lo
> revise y lo corrija, no para firmarlo tal cual. Consultorio jurídico
> gratuito: Icesi, Javeriana Cali, Libre, Santiago de Cali, Univalle.
>
> Exigido por el artículo 25 del Decreto 1377 de 2013 para la transmisión
> de datos personales entre un responsable y un encargado.
>
> **Va firmado ANTES de crear la primera fila real en `organizaciones`.**
> Ese es el momento en que alguien puede activar un acompañamiento y
> escribir un nombre y una cédula: sin contrato firmado, ese tratamiento no
> tiene con qué defenderse.

Reemplaza todo lo que está entre `[CORCHETES]`.

---

## Contrato de transmisión de datos personales

Entre los suscritos:

**[NOMBRE DE LA FUNDACIÓN]**, entidad sin ánimo de lucro identificada con
NIT [NIT], domiciliada en [DIRECCIÓN], representada legalmente por
[NOMBRE DEL REPRESENTANTE], identificado con cédula de ciudadanía
[NÚMERO], quien en adelante se denominará **EL RESPONSABLE**;

y

**Juan Camilo Caicedo Sepulveda**, persona natural identificada con cédula
de ciudadanía [NÚMERO], domiciliado en Cali, Colombia, correo
soporte@aquive.co, operador de la plataforma web AquíVe
(https://aquive.co), quien en adelante se denominará **EL ENCARGADO**;

se celebra el presente contrato de transmisión de datos personales, previas
las siguientes

### Consideraciones

1. Que EL RESPONSABLE desarrolla labores de ayuda humanitaria en el marco
   de la emergencia derivada del sismo del 10 de agosto de 2026.
2. Que EL ENCARGADO opera, a título personal y sin ánimo de lucro, una
   plataforma web que permite a personas afectadas publicar qué insumos
   necesitan y a otras personas ofrecerlos.
3. Que la plataforma **no exige ningún dato personal** para publicar una
   solicitud, y que el tratamiento objeto de este contrato solo ocurre
   cuando el titular escoge, de manera expresa y separada, que EL
   RESPONSABLE acompañe la coordinación de su entrega.
4. Que en ese supuesto EL RESPONSABLE determina la finalidad del
   tratamiento y EL ENCARGADO trata los datos por cuenta de aquel, lo que
   configura una transmisión en los términos del artículo 3, literal j, del
   Decreto 1377 de 2013.
5. Que el artículo 25 del mismo decreto exige que esa transmisión conste en
   un contrato que señale su alcance, las actividades que se realizarán y
   las obligaciones de EL ENCARGADO.

Las partes acuerdan las siguientes

### Cláusulas

**Primera. Objeto.** Regular la transmisión de datos personales de EL
RESPONSABLE a EL ENCARGADO, y el tratamiento que este realiza por cuenta de
aquel, con la única finalidad de coordinar y verificar la entrega de
insumos entre quien los necesita y quien los ofrece.

**Segunda. Papeles.** EL RESPONSABLE es el responsable del tratamiento en
los términos de la Ley 1581 de 2012. EL ENCARGADO trata los datos
únicamente conforme a este contrato y a las instrucciones que EL
RESPONSABLE le imparta por escrito. EL ENCARGADO **no decide** sobre la
finalidad ni sobre el uso de los datos.

Este reparto aplica **solo** a los datos descritos en la cláusula tercera.
Respecto de los datos de quienes ofrecen ayuda y de quienes prestan
servicios profesionales —que son públicos y ajenos a este contrato— EL
ENCARGADO actúa como responsable independiente.

**Tercera. Datos comprendidos.** Únicamente los siguientes, respecto de
cada persona que acepta el acompañamiento:

- Nombre completo.
- Tipo y número de documento de identidad, limitado a cédula de
  ciudadanía, cédula de extranjería, permiso especial de permanencia (PEP)
  y permiso por protección temporal (PPT).
- Número de teléfono, cuando el titular decide entregarlo. Es opcional.

**No se transmiten ni se tratan datos de niñas, niños y adolescentes.** La
tarjeta de identidad y el registro civil están excluidos por una
restricción técnica de la base de datos, no por una validación de pantalla.

Tampoco se tratan datos sensibles en los términos del artículo 5 de la Ley
1581: no se recoge estado de salud, discapacidad, origen étnico, opinión
política, convicción religiosa ni dato biométrico alguno.

**Cuarta. Finalidad única.** Los datos se usan exclusivamente para que el
personal autorizado de EL RESPONSABLE pueda identificar a la persona en el
punto de acopio al momento de la entrega y dejar constancia de que esta
ocurrió. Queda prohibido cualquier otro uso, y en particular:

a) La publicación de los datos en cualquier medio.
b) Su entrega a quien ofrece los insumos o a cualquier otro tercero.
c) Su uso con fines de mercadeo, proselitismo, captación de donantes,
   evangelización o cualquier finalidad distinta de la entrega.
d) Su cruce con otras bases de datos.
e) La elaboración de perfiles o de listados de beneficiarios más allá de la
   planilla de la cláusula novena.

**Quinta. Autorización del titular.** EL ENCARGADO recoge la autorización
previa, expresa e informada del titular, en nombre y por cuenta de EL
RESPONSABLE, mediante un texto que identifica a EL RESPONSABLE por su
nombre, enumera los datos, señala la finalidad y advierte que los datos no
se publican ni se entregan a quien ofrece la ayuda.

De cada autorización quedan almacenadas la fecha y hora y la versión del
texto aceptado. Esas dos constancias son la prueba del consentimiento y
sobreviven mientras exista el dato.

EL ENCARGADO **no puede** ofrecer el acompañamiento como opción
preseleccionada, ni presentar la publicación anónima como una alternativa
inferior. Publicar sin entregar datos es y seguirá siendo el camino
principal de la plataforma.

**Sexta. Medidas de seguridad.** EL ENCARGADO se obliga a mantener, como
mínimo, las siguientes:

a) Los datos se almacenan **cifrados** con una llave que reside en un
   almacén de secretos administrado, nunca en el código fuente ni en el
   repositorio.
b) El número de documento se almacena además como resumen criptográfico con
   sal secreta, para poder cotejarlo sin descifrarlo.
c) La tabla que los contiene tiene los permisos revocados para todos los
   perfiles de acceso público de la base de datos, y ninguna vista pública
   la consulta. El único acceso son tres procedimientos almacenados
   auditados.
d) El acceso a datos identificables requiere un permiso individual, que un
   coordinador de EL RESPONSABLE otorga persona por persona. Ese permiso no
   se concede automáticamente al ingresar al equipo, ni al ser aprobado, ni
   por ser coordinador.
e) La plataforma no almacena el correo electrónico de las cuentas: de la
   autenticación federada conserva únicamente un identificador interno.
f) No está habilitada la recuperación a un punto en el tiempo de la base de
   datos, precisamente para que el borrado sea real y no reversible.

**Séptima. Registro de accesos.** Cada consulta a un dato identificable
queda registrada con la identidad de quien consultó, la fecha y hora y el
motivo declarado. Ese registro **no contiene los datos consultados** y
sobrevive a su borrado.

El titular puede ver ese registro completo, por sí mismo y sin
intermediación, desde el enlace de su solicitud.

EL RESPONSABLE puede solicitarlo por escrito en cualquier momento.

**Octava. Conservación y supresión.** Los datos se suprimen de forma
definitiva —borrado físico de los registros, no marcación de inactivo— en
el primero de los siguientes momentos:

a) Cuando el titular lo solicite, de inmediato y sin intermediación.
b) Cuando venza la solicitud a la que están asociados. El término ordinario
   es de **72 horas** desde su publicación, prorrogable por el titular.
c) Mientras haya una coordinación abierta, la vigencia se prorroga
   automáticamente, con un **límite máximo de 5 días** contados desde la
   publicación. Alcanzado ese límite se cierran las conversaciones y se
   suprime todo.

En ningún caso EL ENCARGADO conserva los datos después de esos plazos, ni
aun con la autorización del titular o a solicitud de EL RESPONSABLE.

**Novena. Sobrevive únicamente lo anónimo.** Tras la supresión permanecen
en la plataforma, y solo para efectos estadísticos y de trazabilidad:

- Registros anónimos de municipio, categoría, si la solicitud se resolvió y
  cuánto tardó.
- Registros de entrega: qué insumos, en qué cantidad, por cuenta de qué
  organización y en qué municipio.
- El registro de accesos de la cláusula séptima.

**Ninguno de esos tres contiene datos personales**, ni referencia alguna
que permita reconstruirlos.

**Décima. Custodia de la planilla.** EL ENCARGADO pone a disposición de EL
RESPONSABLE, en el momento de la entrega, una planilla con los datos
necesarios para dejar constancia de esta. **Desde su descarga, la custodia
de ese archivo es exclusiva de EL RESPONSABLE**, quien responde por su
conservación, su seguridad y su supresión conforme a sus propias políticas
y a su registro en el RNBD.

La plataforma **no es el archivo de EL RESPONSABLE.** EL RESPONSABLE
declara conocer que lo que no exporte antes de los plazos de la cláusula
octava se pierde de manera irrecuperable, y acepta esa consecuencia.

**Undécima. Personal autorizado.** EL RESPONSABLE mantiene actualizada la
lista de personas de su equipo con acceso a la plataforma, retira sin
demora a quien deje de pertenecer a la organización, y garantiza que todas
ellas están vinculadas por deberes de confidencialidad que subsisten a la
terminación de su vínculo.

**Duodécima. Habeas data.** El titular puede ejercer sus derechos ante
cualquiera de las partes.

- EL ENCARGADO pone a disposición del titular, sin intermediación y sin
  necesidad de petición escrita, una pantalla donde puede ver qué datos
  suyos se guardan, quién los ha consultado y suprimirlos de inmediato.
- Las consultas recibidas por escrito se atienden en un máximo de **diez
  (10) días hábiles** y los reclamos en **quince (15) días hábiles**,
  conforme a los artículos 14 y 15 de la Ley 1581 de 2012.
- Cuando una petición exceda lo que EL ENCARGADO puede resolver por sí
  mismo, la traslada a EL RESPONSABLE dentro de los **dos (2) días
  hábiles** siguientes, con copia al titular.
- El canal de EL ENCARGADO es soporte@aquive.co. El de EL RESPONSABLE es
  [CORREO DE HABEAS DATA DE LA FUNDACIÓN].

**Decimotercera. Incidentes de seguridad.** EL ENCARGADO informará a EL
RESPONSABLE cualquier violación de los códigos de seguridad o riesgo en la
administración de la información dentro de las **veinticuatro (24) horas**
siguientes a su detección, con la descripción de lo ocurrido y de las
medidas adoptadas. EL RESPONSABLE queda a cargo del reporte ante la
Superintendencia de Industria y Comercio y de la comunicación a los
titulares, por ser quien tiene la base inscrita en el RNBD.

**Decimocuarta. Infraestructura de terceros.** EL RESPONSABLE autoriza a EL
ENCARGADO a alojar los datos en los proveedores de infraestructura
necesarios para operar la plataforma —actualmente [PROVEEDOR DE BASE DE
DATOS], con almacenamiento en [PAÍS/REGIÓN], y [PROVEEDOR DE ALOJAMIENTO
WEB]—. EL ENCARGADO informará por escrito cualquier cambio de proveedor con
[NÚMERO] días de antelación.

Por fuera de lo anterior, EL ENCARGADO no subcontrata ni cede el
tratamiento a ningún tercero.

**Decimoquinta. Alcance cerrado.** Este contrato no habilita a EL ENCARGADO
a operar alojamiento de personas, cuidado de menores, transporte de
personas, custodia de mascotas, medicamentos de control ni manejo de
dinero, donaciones o pagos, ni siquiera por instrucción de EL RESPONSABLE.
Esas actividades están fuera del objeto de la plataforma.

**Decimosexta. Gratuidad.** No hay contraprestación económica entre las
partes. Ninguna de las dos paga ni recibe pago de la otra, ni recauda
dinero a través de la plataforma.

**Decimoséptima. Naturaleza del servicio.** La plataforma se presta «tal
como está», sin garantía de disponibilidad, mantenida por una sola persona
natural en su tiempo libre. EL ENCARGADO no verifica la identidad, los
antecedentes ni las intenciones de las personas que la usan, y no responde
por lo que ocurra entre ellas. EL RESPONSABLE declara conocerlo.

**Decimoctava. Vigencia y terminación.** Este contrato rige desde su firma
y hasta que cualquiera de las partes lo termine mediante aviso escrito con
[NÚMERO] días de antelación, o hasta que la plataforma deje de operar.

A la terminación, EL ENCARGADO suprime de forma definitiva todos los datos
transmitidos, sin conservar copia, y lo certifica por escrito dentro de los
[NÚMERO] días hábiles siguientes. Lo dispuesto en la cláusula novena sobre
registros anónimos subsiste.

Las obligaciones de confidencialidad subsisten indefinidamente.

**Decimonovena. Carácter temporal de la plataforma.** Las partes reconocen
que AquíVe fue creada para la emergencia del sismo del 10 de agosto de 2026
y que dejará de operar cuando deje de ser útil, momento en el cual se
eliminarán todas las bases de datos.

**Vigésima. Ley aplicable y solución de controversias.** Leyes de la
República de Colombia. Las diferencias se resolverán de buena fe entre las
partes y, de no lograrse acuerdo, ante los jueces competentes de [CIUDAD].

**Vigesimoprimera. Notificaciones.** Las comunicaciones se surtirán a los
correos electrónicos señalados en la cláusula duodécima.

Para constancia se firma en [CIUDAD], a los [DÍA] días del mes de [MES] de
[AÑO], en dos ejemplares del mismo tenor.

<br>

| EL RESPONSABLE | EL ENCARGADO |
|---|---|
| | |
| ______________________________ | ______________________________ |
| [NOMBRE DEL REPRESENTANTE] | Juan Camilo Caicedo Sepulveda |
| [NOMBRE DE LA FUNDACIÓN] | C.C. [NÚMERO] |
| NIT [NIT] | |

---

## Anexo — qué mirar antes de firmar

Lista para la cita con el abogado. Cada punto es una decisión que el
borrador tomó y que puede estar mal.

- [ ] **Que la figura sea la correcta.** El borrador asume transmisión
      (responsable → encargado). Si el abogado ve una transferencia, o dos
      responsables independientes, cambia el documento entero.
- [ ] **Que el RNBD lo inscriba la fundación**, no la persona natural. El
      Decreto 090 de 2018 acota la obligación por tipo de entidad y
      activos; ver `PLANTILLAS.md`, «Tu situación: persona natural».
- [ ] **Los plazos en corchetes**: preaviso de terminación, certificación
      de supresión, antelación para cambiar de proveedor.
- [ ] **El aviso de incidentes en 24 horas.** Es exigente para una sola
      persona. Confirmar si es sostenible o si conviene 48.
- [ ] **La cláusula decimoséptima.** Un contrato que dice «sin garantía de
      disponibilidad» y a la vez promete plazos de supresión puede leerse
      como contradictorio. Que lo revisen juntos.
- [ ] **Que la fundación pueda cumplir la cláusula décima.** Si no tiene
      dónde custodiar la planilla ni política de retención propia, el
      reparto de papeles se cae en la práctica aunque el papel esté firmado.
- [ ] **Que el correo de habeas data de la fundación exista y lo lea
      alguien.** Un canal que nadie abre es peor que no tenerlo.
