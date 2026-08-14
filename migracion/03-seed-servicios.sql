-- =====================================================================
-- Catálogo de servicios profesionales.
--
-- ESTE ARCHIVO FALTABA EN EL REPO. Las 36 filas existían solo en la base
-- de producción: `schema.sql` crea la tabla y `seed-catalogo.sql` deriva
-- ítems a partir de ella, pero nadie la llenaba. Levantar el proyecto
-- desde cero dejaba la categoría de servicios profesionales vacía.
--
-- ORDEN DE EJECUCIÓN: va DESPUÉS de schema.sql y ANTES de
-- seed-catalogo.sql, porque ese archivo hace
--   insert into catalogo_items ... select from catalogo_servicios where activo
-- y sin estas filas no deriva nada.
--
-- LÍMITES (CLAUDE.md regla 5). PROHIBIDO agregar aquí rescate, búsqueda de
-- personas, urgencias o atención prehospitalaria: es competencia de
-- bomberos, Defensa Civil y la línea 123. Ver el comment de la tabla.
--
-- Re-ejecutable: el `on conflict` deja la tabla sincronizada.
-- =====================================================================

insert into public.catalogo_servicios (id, area, nombre, activo, orden) values
  ('ing_dano_estructural', 'ingenieria', 'Evaluación de daños estructurales', true, 1),
  ('ing_habitabilidad', 'ingenieria', 'Concepto de habitabilidad de la vivienda', true, 2),
  ('ing_reforzamiento', 'ingenieria', 'Diseño de reforzamiento o reparación', true, 3),
  ('ing_electrica', 'ingenieria', 'Revisión de instalaciones eléctricas', true, 4),
  ('ing_hidraulica', 'ingenieria', 'Revisión de redes de agua y alcantarillado', true, 5),
  ('ing_geotecnia', 'ingenieria', 'Evaluación de riesgo de deslizamiento', true, 6),
  ('ing_agua_potable', 'ingenieria', 'Potabilización y manejo de agua', true, 7),

  ('arq_levantamiento', 'arquitectura', 'Levantamiento de daños en vivienda', true, 20),
  ('arq_habitabilidad', 'arquitectura', 'Concepto de habitabilidad', true, 21),
  ('arq_diseno_reparacion', 'arquitectura', 'Diseño de reparación de vivienda', true, 22),
  ('arq_alojamiento_temporal', 'arquitectura', 'Diseño de soluciones temporales', true, 23),

  ('psi_primeros_auxilios', 'psicologia', 'Primeros auxilios psicológicos', true, 40),
  ('psi_estres_agudo', 'psicologia', 'Manejo de ansiedad y estrés agudo', true, 41),
  ('psi_duelo', 'psicologia', 'Acompañamiento en duelo', true, 42),
  ('psi_ninos', 'psicologia', 'Atención psicológica a niñas y niños', true, 43),
  ('psi_adultos_mayores', 'psicologia', 'Acompañamiento a personas mayores', true, 44),
  ('psi_cuidadores', 'psicologia', 'Orientación a cuidadores', true, 45),
  ('psi_grupal', 'psicologia', 'Sesiones grupales de contención', true, 46),

  ('sal_medicina_general', 'salud', 'Consulta médica general', true, 60),
  ('sal_curaciones', 'salud', 'Curaciones y manejo de heridas', true, 61),
  ('sal_enfermeria', 'salud', 'Atención de enfermería', true, 62),
  ('sal_cronicos', 'salud', 'Control de enfermedades crónicas', true, 63),
  ('sal_gestantes', 'salud', 'Control prenatal y atención a gestantes', true, 64),
  ('sal_pediatria', 'salud', 'Atención pediátrica', true, 65),
  ('sal_oral', 'salud', 'Salud oral básica', true, 66),
  ('sal_nutricion', 'salud', 'Nutrición y alimentación infantil', true, 67),
  ('sal_fisioterapia', 'salud', 'Fisioterapia y rehabilitación', true, 68),
  ('sal_optometria', 'salud', 'Optometría', true, 69),
  ('sal_farmacia', 'salud', 'Orientación sobre medicamentos', true, 70),

  ('der_orientacion', 'derecho', 'Orientación jurídica general', true, 90),
  ('der_documentos', 'derecho', 'Recuperación de documentos perdidos', true, 91),
  ('der_seguros', 'derecho', 'Reclamación a aseguradoras', true, 92),
  ('der_vivienda', 'derecho', 'Asesoría en vivienda y arrendamiento', true, 93),
  ('der_tutela', 'derecho', 'Derechos de petición y tutelas', true, 94),
  ('der_laboral', 'derecho', 'Asesoría laboral', true, 95),
  ('der_familia', 'derecho', 'Asesoría en derecho de familia', true, 96)
on conflict (id) do update set
  area   = excluded.area,
  nombre = excluded.nombre,
  activo = excluded.activo,
  orden  = excluded.orden;

-- Verificación: debe devolver 36.
-- select count(*) from public.catalogo_servicios where activo;
