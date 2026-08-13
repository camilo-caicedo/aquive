-- =====================================================================
-- Catálogo de ítems. Es la única fuente de lo que se puede pedir: la
-- interfaz no deja escribir ítems libres, y por eso esta lista define
-- el alcance real de la plataforma.
--
-- LÍMITES (CLAUDE.md regla 5). NO agregar aquí:
--   - medicamentos de control (opioides, benzodiacepinas, antibióticos)
--   - dinero, bonos, recargas, tarjetas
--   - alojamiento de personas, transporte de personas, cuidado de menores
--   - custodia de mascotas en casa ajena
-- Solo medicamentos de venta libre. Ante la duda, no se agrega.
-- =====================================================================

insert into public.catalogo_items (id, categoria, nombre, unidad, orden) values
  -- Alimentación ------------------------------------------------------
  ('agua','alimentacion','Agua embotellada','litro',1),
  ('agua_bolsa','alimentacion','Agua en bolsa','bolsa',2),
  ('formula_inicio','alimentacion','Fórmula infantil de inicio (0-6 meses)','tarro',3),
  ('formula_continuacion','alimentacion','Fórmula infantil de continuación (6-12 meses)','tarro',4),
  ('leche_polvo','alimentacion','Leche en polvo','tarro',5),
  ('leche_larga','alimentacion','Leche larga vida','litro',6),
  ('arroz','alimentacion','Arroz','libra',7),
  ('frijol','alimentacion','Fríjol','libra',8),
  ('lenteja','alimentacion','Lenteja','libra',9),
  ('pasta','alimentacion','Pasta','libra',10),
  ('harina','alimentacion','Harina de maíz','libra',11),
  ('atun','alimentacion','Atún enlatado','lata',12),
  ('sardina','alimentacion','Sardina enlatada','lata',13),
  ('salchicha_lata','alimentacion','Salchichas enlatadas','lata',14),
  ('panela','alimentacion','Panela','libra',15),
  ('azucar','alimentacion','Azúcar','libra',16),
  ('sal','alimentacion','Sal','libra',17),
  ('aceite','alimentacion','Aceite','botella',18),
  ('cafe','alimentacion','Café','libra',19),
  ('chocolate','alimentacion','Chocolate de mesa','libra',20),
  ('galletas','alimentacion','Galletas','paquete',21),
  ('avena','alimentacion','Avena','libra',22),
  ('bienestarina','alimentacion','Bienestarina','bolsa',23),
  ('papa','alimentacion','Papa','libra',24),
  ('platano','alimentacion','Plátano','unidad',25),
  ('yuca','alimentacion','Yuca','libra',26),
  ('huevos','alimentacion','Huevos','panal',27),
  ('comida_perro','mascotas','Alimento para perro','libra',300),
  ('comida_gato','mascotas','Alimento para gato','libra',301),

  -- Aseo ---------------------------------------------------------------
  ('panales_rn','aseo','Pañales recién nacido','paquete',40),
  ('panales_1','aseo','Pañales etapa 1','paquete',41),
  ('panales_2','aseo','Pañales etapa 2','paquete',42),
  ('panales_3','aseo','Pañales etapa 3','paquete',43),
  ('panales_4','aseo','Pañales etapa 4','paquete',44),
  ('panales_adulto','aseo','Pañales de adulto','paquete',45),
  ('panitos','aseo','Pañitos húmedos','paquete',46),
  ('toallas_h','aseo','Toallas higiénicas','paquete',47),
  ('jabon','aseo','Jabón de baño','unidad',48),
  ('jabon_ropa','aseo','Jabón para ropa','unidad',49),
  ('detergente','aseo','Detergente en polvo','bolsa',50),
  ('papel_h','aseo','Papel higiénico','rollo',51),
  ('crema_dental','aseo','Crema dental','tubo',52),
  ('cepillo_dientes','aseo','Cepillo de dientes','unidad',53),
  ('shampoo','aseo','Shampoo','unidad',54),
  ('gel_antibacterial','aseo','Gel antibacterial','unidad',55),
  ('cloro','aseo','Cloro / hipoclorito','litro',56),
  ('escoba','aseo','Escoba','unidad',57),
  ('trapero','aseo','Trapero','unidad',58),
  ('balde','aseo','Balde','unidad',59),
  ('bolsas_basura','aseo','Bolsas de basura','paquete',60),
  ('toalla','aseo','Toalla de baño','unidad',61),

  -- Salud (solo venta libre) --------------------------------------------
  ('acetaminofen','salud','Acetaminofén','caja',70),
  ('ibuprofeno','salud','Ibuprofeno','caja',71),
  ('suero_oral','salud','Suero oral','sobre',72),
  ('gasas','salud','Gasas','paquete',73),
  ('vendas','salud','Vendas','unidad',74),
  ('curas','salud','Curas / banditas','caja',75),
  ('alcohol','salud','Alcohol antiséptico','frasco',76),
  ('agua_oxigenada','salud','Agua oxigenada','frasco',77),
  ('isodine','salud','Antiséptico tipo yodo','frasco',78),
  ('guantes','salud','Guantes desechables','caja',79),
  ('tapabocas','salud','Tapabocas','caja',80),
  ('termometro','salud','Termómetro','unidad',81),
  ('repelente','salud','Repelente de insectos','unidad',82),
  ('bloqueador','salud','Bloqueador solar','unidad',83),
  ('botiquin','salud','Botiquín básico','unidad',84),
  ('crema_panal','salud','Crema antipañalitis','tubo',85),
  ('suero_fisiologico','salud','Suero fisiológico','frasco',86),

  -- Abrigo ---------------------------------------------------------------
  ('cobija','abrigo','Cobija','unidad',100),
  ('sabanas','abrigo','Sábanas','juego',101),
  ('almohada','abrigo','Almohada','unidad',102),
  ('colchoneta','abrigo','Colchoneta','unidad',103),
  ('colchon','abrigo','Colchón','unidad',104),
  ('hamaca','abrigo','Hamaca','unidad',105),
  ('toldillo','abrigo','Toldillo','unidad',106),
  ('carpa','abrigo','Carpa','unidad',107),
  ('plastico','abrigo','Plástico / lona impermeable','metro',108),
  ('ropa_bebe','abrigo','Ropa de bebé','muda',109),
  ('ropa_nino','abrigo','Ropa de niño','muda',110),
  ('ropa_adulto','abrigo','Ropa de adulto','muda',111),
  ('ropa_interior','abrigo','Ropa interior nueva','paquete',112),
  ('chaqueta','abrigo','Chaqueta o impermeable','unidad',113),
  ('calzado_nino','abrigo','Calzado de niño','par',114),
  ('calzado_adulto','abrigo','Calzado de adulto','par',115),
  ('botas','abrigo','Botas de caucho','par',116),

  -- Cocina ---------------------------------------------------------------
  ('olla','cocina','Olla','unidad',130),
  ('sarten','cocina','Sartén','unidad',131),
  ('platos','cocina','Platos','unidad',132),
  ('vasos','cocina','Vasos','unidad',133),
  ('cubiertos','cocina','Cubiertos','juego',134),
  ('estufa_portatil','cocina','Estufa portátil','unidad',135),
  ('cilindro_gas','cocina','Cilindro de gas','unidad',136),
  ('pimpina','cocina','Pimpina para agua','unidad',137),
  ('tanque_agua','cocina','Tanque de agua','unidad',138),
  ('filtro_agua','cocina','Filtro o purificador de agua','unidad',139),
  ('termo','cocina','Termo','unidad',140),
  ('tupper','cocina','Recipientes con tapa','unidad',141),
  ('fosforos','cocina','Fósforos o encendedor','caja',142),

  -- Otros -----------------------------------------------------------------
  ('linterna','otros','Linterna','unidad',160),
  ('pilas','otros','Pilas','paquete',161),
  ('velas','otros','Velas','paquete',162),
  ('cargador_solar','otros','Cargador solar','unidad',163),
  ('powerbank','otros','Batería portátil','unidad',164),
  ('radio','otros','Radio a pilas','unidad',165),
  ('extension','otros','Extensión eléctrica','unidad',166),
  ('bolsas','otros','Bolsas plásticas','paquete',167),
  ('cuerda','otros','Cuerda o lazo','metro',168),
  ('herramientas','otros','Herramientas básicas','juego',169),
  ('pala','otros','Pala','unidad',170),
  ('carretilla','otros','Carretilla','unidad',171),
  ('cuadernos','otros','Cuadernos','unidad',172),
  ('utiles_escolares','otros','Útiles escolares','juego',173),
  ('juguetes','otros','Juguetes','unidad',174),
  ('silla_ruedas','otros','Silla de ruedas','unidad',175),
  ('muletas','otros','Muletas','par',176),
  ('caminador','otros','Caminador','unidad',177),

  -- Mascotas ------------------------------------------------------------
  -- Son enseres, y por eso están dentro del alcance. Lo que CLAUDE.md
  -- excluye es la CUSTODIA de mascotas en casa ajena, no sus insumos.
  -- Solo antiparasitarios de venta libre: nada que exija fórmula.
  ('masc_perro_cachorro','mascotas','Alimento para cachorro','libra',302),
  ('masc_gato_gatito','mascotas','Alimento para gatito','libra',303),
  ('masc_humedo','mascotas','Alimento húmedo en lata','lata',304),
  ('masc_leche','mascotas','Leche de reemplazo para cachorros','tarro',305),
  ('masc_aves','mascotas','Alimento para aves','libra',306),
  ('masc_roedores','mascotas','Alimento para conejos o roedores','libra',307),
  ('masc_arena','mascotas','Arena para gato','bolsa',320),
  ('masc_arenera','mascotas','Arenera (caja de arena)','unidad',321),
  ('masc_tapetes','mascotas','Tapetes entrenadores','paquete',322),
  ('masc_bolsas_heces','mascotas','Bolsas para recoger heces','paquete',323),
  ('masc_shampoo','mascotas','Shampoo para mascota','unidad',324),
  ('masc_toallitas','mascotas','Pañitos húmedos para mascota','paquete',325),
  ('masc_cama','mascotas','Cama para mascota','unidad',340),
  ('masc_cobija','mascotas','Cobija para mascota','unidad',341),
  ('masc_ropa','mascotas','Ropa o abrigo para mascota','unidad',342),
  ('masc_guacal','mascotas','Guacal o transportadora','unidad',343),
  ('masc_corral','mascotas','Corral o jaula','unidad',344),
  ('masc_comedero','mascotas','Comedero','unidad',360),
  ('masc_bebedero','mascotas','Bebedero','unidad',361),
  ('masc_correa','mascotas','Correa','unidad',362),
  ('masc_collar','mascotas','Collar','unidad',363),
  ('masc_arnes','mascotas','Arnés','unidad',364),
  ('masc_placa','mascotas','Placa de identificación','unidad',365),
  ('masc_bozal','mascotas','Bozal','unidad',366),
  ('masc_juguete','mascotas','Juguete para mascota','unidad',367),
  ('masc_rascador','mascotas','Rascador para gato','unidad',368),
  ('masc_antipulgas','mascotas','Antipulgas','unidad',380),
  ('masc_desparasitante','mascotas','Desparasitante','caja',381),
  ('masc_botiquin','mascotas','Botiquín para mascota','unidad',382)
on conflict (id) do update set
  categoria = excluded.categoria,
  nombre    = excluded.nombre,
  unidad    = excluded.unidad,
  orden     = excluded.orden,
  activo    = true;

-- Reemplazado por ítems concretos (correa, guacal, comedero...). No se
-- borra para no romper una referencia histórica desde solicitud_items.
update public.catalogo_items set activo = false where id = 'panal_mascota';

-- Los servicios también se pueden PEDIR, no solo ofrecer. Se derivan de
-- catalogo_servicios en vez de escribirse dos veces: re-ejecutar esto los
-- deja sincronizados. La unidad 'servicio' es la que hace que la interfaz
-- oculte la cantidad y muestre solo el nombre.
insert into public.catalogo_items (id, categoria, nombre, unidad, orden)
select 'serv_' || s.id, 'servicios', s.nombre, 'servicio', 200 + s.orden
from public.catalogo_servicios s
where s.activo
on conflict (id) do update set
  nombre = excluded.nombre,
  unidad = excluded.unidad,
  orden  = excluded.orden,
  activo = true;
