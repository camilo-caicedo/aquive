-- =====================================================================
-- Solicitudes de prueba para el proyecto de PRUEBAS.
--
-- 🔴 NUNCA en producción. Los tokens son legibles a propósito, así que
-- cualquiera que lea este archivo puede renovar y cerrar estas
-- solicitudes.
--
-- Va por `crear_solicitud` y no por `insert` directo para que pase por
-- las mismas validaciones que la aplicación: filtro de teléfonos y
-- correos en la nota, límite de 1 a 12 ítems, y las llaves foráneas
-- contra `municipios` y `catalogo_items`.
--
-- Cubre cinco municipios, cinco categorías y de 2 a 5 ítems, con y sin
-- nota, para ver el tablero con variedad. Expiran solas a las 72 horas;
-- vuelve a ejecutarlo cuando haga falta, genera códigos nuevos.
--
-- El prefijo `PRUEBA — ` en el barrio hace dos cosas a la vez: se ve en la
-- tarjeta del tablero, así que nadie se moviliza por una solicitud que no
-- existe, y `crear_solicitud` deriva de él `es_prueba = true`, que es lo
-- único que permite limpiar después las filas de `metricas` —esa tabla no
-- tiene ninguna FK—. Si le quitas el prefijo, la fila queda para siempre
-- en la página de datos abiertos.
--
-- Comprobar después:
--   select codigo, municipio_nombre, barrio, categoria
--     from public.solicitudes_publicas order by creada_at;
--   select codigo, barrio, es_prueba from public.solicitudes;
-- =====================================================================

select public.crear_solicitud('76001','PRUEBA — Comuna 18','alimentacion',
  'Somos varias familias en el salon comunal, falta mercado basico.',
  '[{"item_id":"agua","cantidad":40},{"item_id":"arroz","cantidad":20},{"item_id":"panela","cantidad":10},{"item_id":"aceite","cantidad":6}]'::jsonb,
  'prueba-test-1');

select public.crear_solicitud('66001','PRUEBA — Barrio Cuba','aseo', null,
  '[{"item_id":"panales_2","cantidad":8},{"item_id":"toallas_h","cantidad":12},{"item_id":"jabon","cantidad":15},{"item_id":"papel_h","cantidad":20}]'::jsonb,
  'prueba-test-2');

select public.crear_solicitud('17001','PRUEBA — La Enea','salud',
  'Puesto de salud improvisado, se acabaron los basicos.',
  '[{"item_id":"acetaminofen","cantidad":5},{"item_id":"suero_oral","cantidad":30},{"item_id":"gasas","cantidad":10}]'::jsonb,
  'prueba-test-3');

select public.crear_solicitud('27001','PRUEBA — Nino Jesus','abrigo',
  'Las noches estan frias y llueve.',
  '[{"item_id":"cobija","cantidad":25},{"item_id":"colchoneta","cantidad":15}]'::jsonb,
  'prueba-test-4');

select public.crear_solicitud('76109','PRUEBA — Juan XXIII','cocina', null,
  '[{"item_id":"olla","cantidad":4},{"item_id":"pimpina","cantidad":10},{"item_id":"linterna","cantidad":6},{"item_id":"pilas","cantidad":12},{"item_id":"comida_perro","cantidad":8}]'::jsonb,
  'prueba-test-5');
