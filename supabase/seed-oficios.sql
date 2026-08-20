-- =====================================================================
-- Semilla de `catalogo_oficios` — la taxonomía del rebusque
--
-- Los grupos salen del §4 del documento de trabajo de la Fundación Nodo
-- Social. Idempotente: se puede volver a correr y actualiza nombres,
-- orden y riesgo sin tocar lo que ya esté enlazado desde una ficha.
--
-- 🔴 PROHIBIDO agregar aquí, y no es una cuestión de gusto:
--
--   · Oficios que exigen matrícula — reconstrucción o revisión
--     estructural, salud, gas, instalaciones eléctricas, asesoría
--     jurídica. Esos viven en `catalogo_servicios`, que sí la verifica.
--     Nada de «albañilería» ni «arreglo de paredes»: después de un sismo
--     la frontera con lo estructural no existe.
--   · Rescate, búsqueda de personas, urgencias, atención prehospitalaria.
--     Es competencia de bomberos, Defensa Civil y la línea 123.
--   · Alojamiento de personas y cualquier cosa que mueva dinero ajeno
--     (préstamos, «gota a gota», cambio de divisas, apuestas).
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

  -- Belleza -----------------------------------------------------------
  ('peluqueria',           'belleza',     'Peluquería',                       'bajo',  20),
  ('barberia',             'belleza',     'Barbería',                         'bajo',  21),
  ('manicure',             'belleza',     'Manicure y pedicure',              'bajo',  22),
  ('trenzas',              'belleza',     'Trenzas y peinados',               'bajo',  23),
  ('maquillaje',           'belleza',     'Maquillaje',                       'bajo',  24),
  ('depilacion',           'belleza',     'Depilación',                       'bajo',  25),

  -- Confección y arreglos ---------------------------------------------
  ('arreglos_ropa',        'confeccion',  'Arreglos de ropa',                 'bajo',  30),
  ('confeccion_medida',    'confeccion',  'Confección a la medida',           'bajo',  31),
  ('uniformes',            'confeccion',  'Uniformes y dotación',             'bajo',  32),
  ('bordado_estampado',    'confeccion',  'Bordado y estampado',              'bajo',  33),
  ('cortinas',             'confeccion',  'Cortinas y lencería',              'bajo',  34),
  ('tapiceria',            'confeccion',  'Tapicería de muebles',             'bajo',  35),

  -- Transporte y trasteos ---------------------------------------------
  -- `transporte_pasajeros` entró al alcance por decisión escrita del
  -- responsable (CLAUDE.md regla 5), y por eso nace en `alto`.
  ('trasteos',             'transporte',  'Trasteos y mudanzas',              'bajo',  40),
  ('acarreo_carga',        'transporte',  'Acarreo de carga y escombros',     'bajo',  41),
  ('mensajeria',           'transporte',  'Mensajería y domicilios',          'bajo',  42),
  ('transporte_pasajeros', 'transporte',  'Transporte de personas',           'alto',  43),

  -- Aseo ---------------------------------------------------------------
  ('aseo_hogar',           'aseo',        'Aseo de casas',                    'bajo',  50),
  ('aseo_locales',         'aseo',        'Aseo de locales y oficinas',       'bajo',  51),
  ('limpieza_posdesastre', 'aseo',        'Limpieza después del sismo',       'bajo',  52),
  ('lavado_ropa',          'aseo',        'Lavado y planchado de ropa',       'bajo',  53),
  ('lavado_vehiculos',     'aseo',        'Lavado de carros y motos',         'bajo',  54),
  ('jardineria',           'aseo',        'Jardinería y poda',                'bajo',  55),

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

  -- Otros ----------------------------------------------------------------
  ('mandados',             'otros',       'Mandados y diligencias',           'bajo',  80),
  ('ayudante_general',     'otros',       'Ayudante por día',                 'bajo',  81)
on conflict (id) do update set
  grupo  = excluded.grupo,
  nombre = excluded.nombre,
  riesgo = excluded.riesgo,
  orden  = excluded.orden;
