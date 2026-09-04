-- =====================================================================
-- Semilla de `catalogo_oficios` — la taxonomía del rebusque
--
-- Los grupos salen del §4 del documento de trabajo de la Fundación Nodo
-- Social. Idempotente: se puede volver a correr y actualiza nombres,
-- orden y riesgo sin tocar lo que ya esté enlazado desde una ficha.
--
-- 🔴 PROHIBIDO agregar aquí, y no es una cuestión de gusto:
--
--   · Oficios que exigen matrícula — reconstrucción, refuerzo o revisión
--     estructural, dictamen de habitabilidad, salud, gas, instalaciones
--     eléctricas, asesoría jurídica. Esos viven en `catalogo_servicios`,
--     que sí la verifica.
--   · Rescate, búsqueda de personas, urgencias, atención prehospitalaria.
--     Es competencia de bomberos, Defensa Civil y la línea 123.
--   · Alojamiento de personas y cualquier cosa que mueva dinero ajeno
--     (préstamos, «gota a gota», cambio de divisas, apuestas).
--   · Cerrajería. Abrir la cerradura de una casa ajena es acceso a la
--     vivienda de alguien; si algún día entra, entra en `alto` y con su
--     propia discusión.
--   · Fumigación y lavado de tanques: llevan concepto sanitario municipal,
--     que es la frontera de la matrícula por otro lado.
--
-- ⚠ Aquí decía además «nada de albañilería ni arreglo de paredes: después
-- de un sismo la frontera con lo estructural no existe». El ADR 0012 abre
-- el grupo `construccion` por decisión del responsable, y **la frontera no
-- se movió**: entra lo que no exige matrícula y no toca la estructura de
-- un edificio, y el nombre de cada oficio lleva ese límite escrito —por
-- eso es «Plomería: fugas y destapes» y no «Plomería», y por eso el peón
-- se llama «Ayudante de obra», que trabaja bajo la dirección de alguien.
--
-- Sobre `riesgo = 'alto'`: no significa peligroso de hacer, significa que
-- si quien lo presta es un mal actor el daño no es económico. Esos
-- oficios no se publican si el proveedor no tiene teléfono verificado Y
-- una referencia confirmada (regla S de PLAN-V3). Bajar uno de alto a
-- bajo es una decisión sobre personas, no una corrección de datos.
-- =====================================================================

insert into public.catalogo_oficios (id, grupo, nombre, riesgo, orden) values
  -- Comida ------------------------------------------------------------
  ('almuerzos',            'comida',      'Almuerzos a domicilio',            'bajo',  10),
  ('desayunos',            'comida',      'Desayunos y onces',                'bajo',  11),
  ('tamales_empanadas',    'comida',      'Tamales, empanadas y fritos',      'bajo',  12),
  ('panaderia',            'comida',      'Panadería y repostería',           'bajo',  13),
  ('jugos_bebidas',        'comida',      'Jugos, tintos y bebidas',          'bajo',  14),
  ('cocina_eventos',       'comida',      'Cocina para eventos',              'bajo',  15),
  ('cocina_por_dia',       'comida',      'Cocinar por día en casa',          'bajo',  16),
  ('postres',              'comida',      'Postres y helados caseros',        'bajo',  17),

  -- Belleza -----------------------------------------------------------
  ('peluqueria',           'belleza',     'Peluquería',                       'bajo',  20),
  ('barberia',             'belleza',     'Barbería',                         'bajo',  21),
  ('manicure',             'belleza',     'Manicure y pedicure',              'bajo',  22),
  ('trenzas',              'belleza',     'Trenzas y peinados',               'bajo',  23),
  ('maquillaje',           'belleza',     'Maquillaje',                       'bajo',  24),
  ('depilacion',           'belleza',     'Depilación',                       'bajo',  25),
  -- «De relajación» es parte del límite, no adorno: la fisioterapia y
  -- cualquier masaje terapéutico exigen matrícula (ReTHUS) y van en
  -- `catalogo_servicios`.
  ('masajes',              'belleza',     'Masajes de relajación',            'bajo',  26),
  ('cejas_pestanas',       'belleza',     'Cejas y pestañas',                 'bajo',  27),
  ('unas_acrilicas',       'belleza',     'Uñas acrílicas y semipermanentes', 'bajo',  28),

  -- Confección y arreglos ---------------------------------------------
  ('arreglos_ropa',        'confeccion',  'Arreglos de ropa',                 'bajo',  30),
  ('confeccion_medida',    'confeccion',  'Confección a la medida',           'bajo',  31),
  ('uniformes',            'confeccion',  'Uniformes y dotación',             'bajo',  32),
  ('bordado_estampado',    'confeccion',  'Bordado y estampado',              'bajo',  33),
  ('cortinas',             'confeccion',  'Cortinas y lencería',              'bajo',  34),
  ('tapiceria',            'confeccion',  'Tapicería de muebles',             'bajo',  35),
  ('tejido',               'confeccion',  'Tejido y crochet',                 'bajo',  36),

  -- Transporte y trasteos ---------------------------------------------
  -- `transporte_pasajeros` entró al alcance por decisión escrita del
  -- responsable (CLAUDE.md regla 5), y por eso nace en `alto`.
  ('trasteos',             'transporte',  'Trasteos y mudanzas',              'bajo',  40),
  ('acarreo_carga',        'transporte',  'Acarreo de carga y escombros',     'bajo',  41),
  ('mensajeria',           'transporte',  'Mensajería y domicilios',          'bajo',  42),
  ('transporte_pasajeros', 'transporte',  'Transporte de personas',           'alto',  43),
  ('transporte_mascotas',  'transporte',  'Transporte de mascotas',           'bajo',  44),

  -- Aseo ---------------------------------------------------------------
  ('aseo_hogar',           'aseo',        'Aseo de casas',                    'bajo',  50),
  ('aseo_locales',         'aseo',        'Aseo de locales y oficinas',       'bajo',  51),
  ('limpieza_posdesastre', 'aseo',        'Limpieza después del sismo',       'bajo',  52),
  ('lavado_ropa',          'aseo',        'Lavado y planchado de ropa',       'bajo',  53),
  ('lavado_vehiculos',     'aseo',        'Lavado de carros y motos',         'bajo',  54),
  ('jardineria',           'aseo',        'Jardinería y poda',                'bajo',  55),
  ('reciclaje',            'aseo',        'Reciclaje y recuperación',         'bajo',  56),

  -- Cuidado -------------------------------------------------------------
  -- Los tres de personas nacen en `alto`. Es el punto donde más crece la
  -- exposición del proyecto y donde la regla S hace todo su trabajo.
  ('cuidado_ninos',        'cuidado',     'Cuidado de niñas y niños',         'alto',  60),
  ('cuidado_mayores',      'cuidado',     'Cuidado de personas mayores',      'alto',  61),
  ('acompanamiento',       'cuidado',     'Acompañamiento a personas enfermas','alto', 62),
  ('cuidado_mascotas',     'cuidado',     'Cuidado de mascotas a domicilio',  'bajo',  63),
  ('paseo_mascotas',       'cuidado',     'Paseo de mascotas',                'bajo',  64),
  ('peluqueria_canina',    'cuidado',     'Peluquería de mascotas',           'bajo',  65),

  -- Reparación -----------------------------------------------------------
  ('rep_electrodomesticos','reparacion',  'Reparación de electrodomésticos',  'bajo',  70),
  ('rep_celulares',        'reparacion',  'Reparación de celulares',          'bajo',  71),
  ('rep_computadores',     'reparacion',  'Reparación de computadores',       'bajo',  72),
  ('rep_calzado',          'reparacion',  'Reparación de calzado',            'bajo',  73),
  ('rep_bicicletas',       'reparacion',  'Reparación de bicicletas',         'bajo',  74),
  ('rep_motos',            'reparacion',  'Mecánica de motos',                'bajo',  75),
  ('rep_muebles',          'reparacion',  'Arreglo de muebles de madera',     'bajo',  76),
  ('rep_maquinas_coser',   'reparacion',  'Reparación de máquinas de coser',  'bajo',  77),
  ('afilado',              'reparacion',  'Afilado de cuchillos y herramientas','bajo', 78),

  -- Otros ----------------------------------------------------------------
  ('mandados',             'otros',       'Mandados y diligencias',           'bajo',  80),
  ('ayudante_general',     'otros',       'Ayudante por día',                 'bajo',  81),

  -- Arreglos de la casa (ADR 0012) --------------------------------------
  -- El oficio más común del rebusque, y el catálogo no tenía ni una
  -- entrada: «Reparación» era de neveras y celulares.
  --
  -- ⚠ Cada nombre lleva su límite dentro. NO entra, y no por gusto:
  -- reconstrucción, refuerzo o revisión estructural —columnas, vigas,
  -- placas, muros de carga, habitabilidad—, gas, e instalaciones
  -- eléctricas. Las tres exigen matrícula o competencia certificada y
  -- viven en `catalogo_servicios`, que sí la verifica.
  ('pintura',              'construccion','Pintura de casas y locales',       'bajo',  90),
  ('estuco_drywall',       'construccion','Estuco y drywall',                 'bajo',  91),
  ('enchape',              'construccion','Enchape de pisos y baños',         'bajo',  92),
  ('impermeabilizacion',   'construccion','Impermeabilización y goteras',     'bajo',  93),
  -- «Fugas y destapes», no «Plomería» a secas: el gas queda fuera y el
  -- nombre tiene que decirlo desde la lista, no desde una nota al pie.
  ('plomeria',             'construccion','Plomería: fugas y destapes',       'bajo',  94),
  ('carpinteria_obra',     'construccion','Carpintería, closets y puertas',   'bajo',  95),
  ('rejas_soldadura',      'construccion','Rejas y soldadura',                'bajo',  96),
  -- «Ayudante», no «albañil»: un ayudante trabaja bajo la dirección de
  -- alguien más, que es justo lo que lo separa de la obra estructural.
  ('obra_menor',           'construccion','Ayudante de obra y arreglos menores','bajo',97),

  -- Clases y refuerzo (ADR 0012) ----------------------------------------
  -- ⚠ `refuerzo_escolar` es el único oficio nuevo que nace en `alto`, y
  -- es el único que se define por estar a solas con un menor de edad —lo
  -- mismo que `cuidado_ninos`—. Que la excusa sea una tarea de
  -- matemáticas y no un biberón no cambia la exposición.
  --
  -- Los demás son `bajo` porque los define la materia, no la edad de
  -- quien aprende. Si algún día se ofrece «clases para niños en su casa»,
  -- eso es otro oficio y nace en alto.
  ('refuerzo_escolar',     'ensenanza',   'Refuerzo escolar y tareas',        'alto', 100),
  ('clases_musica',        'ensenanza',   'Clases de música y canto',         'bajo', 101),
  ('clases_idiomas',       'ensenanza',   'Clases de inglés y otros idiomas', 'bajo', 102),
  ('alfabetizacion',       'ensenanza',   'Leer, escribir y cuentas básicas', 'bajo', 103),
  ('manejo_celular',       'ensenanza',   'Enseñar a usar el celular',        'bajo', 104),
  ('clases_manualidades',  'ensenanza',   'Clases de manualidades y oficios', 'bajo', 105),
  ('entrenamiento',        'ensenanza',   'Entrenamiento físico y baile',     'bajo', 106),

  -- Fiestas y eventos (ADR 0012) ----------------------------------------
  -- `animacion_infantil` es `bajo` a propósito: una fiesta ocurre con la
  -- familia delante, que es la diferencia con `cuidado_ninos`.
  ('decoracion_fiestas',   'eventos',     'Decoración de fiestas',            'bajo', 110),
  ('animacion_infantil',   'eventos',     'Animación y recreación',           'bajo', 111),
  ('alquiler_sillas',      'eventos',     'Alquiler de sillas, mesas y toldos','bajo', 112),
  ('sonido_musica',        'eventos',     'Sonido, música y karaoke',         'bajo', 113),
  ('fotografia',           'eventos',     'Fotografía y video',               'bajo', 114),
  ('meseros',              'eventos',     'Meseros y logística de evento',    'bajo', 115),
  ('pinatas',              'eventos',     'Piñatas y mesa de dulces',         'bajo', 116),

  -- Computador y trámites (ADR 0012) ------------------------------------
  -- Para quien tiene un computador y ningún capital. El catálogo solo
  -- contemplaba *reparar* computadores, no usarlos.
  ('digitacion',           'digital',     'Digitación y transcripción',       'bajo', 120),
  ('impresion',            'digital',     'Impresión, copias y escaneo',      'bajo', 121),
  ('diseno_volantes',      'digital',     'Diseño de volantes y pendones',    'bajo', 122),
  ('redes_negocio',        'digital',     'Manejar las redes de un negocio',  'bajo', 123),
  ('tramites_linea',       'digital',     'Ayuda con trámites por internet',  'bajo', 124),
  ('respaldo_archivos',    'digital',     'Instalar programas y respaldar',   'bajo', 125)
on conflict (id) do update set
  grupo  = excluded.grupo,
  nombre = excluded.nombre,
  riesgo = excluded.riesgo,
  orden  = excluded.orden;
