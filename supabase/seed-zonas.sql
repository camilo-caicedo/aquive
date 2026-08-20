-- =====================================================================
-- Semilla de `zonas` — Santiago de Cali (76001)
--
-- 22 comunas y 15 corregimientos. Es el único municipio sembrado: en los
-- demás, el proveedor escribe su zona a mano en `proveedores.zona_texto`
-- y un administrador puede sembrar filas aquí cuando alguna ciudad lo
-- amerite.
--
-- ⚠ La lista de corregimientos hay que confirmarla contra el POT o la
-- página de la Alcaldía antes de darla por buena: circulan versiones que
-- cuentan Navarro y Los Limones de distinta forma y suman 14 o 16. Como
-- esto sale en un desplegable delante de gente que vive ahí, un nombre
-- mal puesto se nota. Corregir con un UPDATE o desde el panel; los
-- nombres son la llave natural, así que renombrar crea una fila nueva.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

insert into public.zonas (municipio, nombre, tipo, orden) values
  ('76001', 'Comuna 1',  'comuna',  1),
  ('76001', 'Comuna 2',  'comuna',  2),
  ('76001', 'Comuna 3',  'comuna',  3),
  ('76001', 'Comuna 4',  'comuna',  4),
  ('76001', 'Comuna 5',  'comuna',  5),
  ('76001', 'Comuna 6',  'comuna',  6),
  ('76001', 'Comuna 7',  'comuna',  7),
  ('76001', 'Comuna 8',  'comuna',  8),
  ('76001', 'Comuna 9',  'comuna',  9),
  ('76001', 'Comuna 10', 'comuna', 10),
  ('76001', 'Comuna 11', 'comuna', 11),
  ('76001', 'Comuna 12', 'comuna', 12),
  ('76001', 'Comuna 13', 'comuna', 13),
  ('76001', 'Comuna 14', 'comuna', 14),
  ('76001', 'Comuna 15', 'comuna', 15),
  ('76001', 'Comuna 16', 'comuna', 16),
  ('76001', 'Comuna 17', 'comuna', 17),
  ('76001', 'Comuna 18', 'comuna', 18),
  ('76001', 'Comuna 19', 'comuna', 19),
  ('76001', 'Comuna 20', 'comuna', 20),
  ('76001', 'Comuna 21', 'comuna', 21),
  ('76001', 'Comuna 22', 'comuna', 22),

  ('76001', 'El Hormiguero', 'corregimiento', 30),
  ('76001', 'Navarro',       'corregimiento', 31),
  ('76001', 'Pance',         'corregimiento', 32),
  ('76001', 'La Buitrera',   'corregimiento', 33),
  ('76001', 'Villacarmelo',  'corregimiento', 34),
  ('76001', 'Los Andes',     'corregimiento', 35),
  ('76001', 'Pichindé',      'corregimiento', 36),
  ('76001', 'La Leonera',    'corregimiento', 37),
  ('76001', 'Felidia',       'corregimiento', 38),
  ('76001', 'El Saladito',   'corregimiento', 39),
  ('76001', 'La Elvira',     'corregimiento', 40),
  ('76001', 'La Castilla',   'corregimiento', 41),
  ('76001', 'Montebello',    'corregimiento', 42),
  ('76001', 'Golondrinas',   'corregimiento', 43),
  ('76001', 'La Paz',        'corregimiento', 44)
on conflict (municipio, nombre) do update set
  tipo  = excluded.tipo,
  orden = excluded.orden;
