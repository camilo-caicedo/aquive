-- =====================================================================
-- Directorio de servicios de prueba, para el proyecto de PRUEBAS.
--
-- 🔴 NUNCA en producción. Los tokens son legibles a propósito, así que
-- cualquiera que lea este archivo puede editar y borrar estas fichas.
--
-- Dos cosas que NO son decoración y hay que mantener si se edita:
--
--   · Todos los nombres empiezan por «PRUEBA — ». Esto es un directorio
--     público de gente que trabaja: una ficha falsa sin marcar es alguien
--     a quien de verdad van a llamar.
--   · Todos los teléfonos son ceros. No hay rango ficticio reservado en
--     Colombia, y un 3XX inventado es el número de alguien. Un número de
--     ceros pasa la validación y no marca a ninguna parte.
--
-- Lo que se puede se hace por RPC —referencias, códigos, calificaciones,
-- solicitudes y respuestas— para que pase por las mismas validaciones que
-- la aplicación. Las fichas van por `insert` directo porque
-- `guardar_proveedor` exige sesión de Google o un token que todavía no
-- existe, y `crear_proveedor_asistido` exige ser miembro de una
-- organización. Donde el insert directo se salta un efecto de la RPC
-- —proponer la zona escrita a mano— se llama a mano a `proponer_zona`.
--
-- Todo lleva `es_prueba = true`. Para limpiar:
--
--   delete from public.proveedores where es_prueba;
--   delete from public.solicitudes_servicio where es_prueba;
--   delete from public.metricas_servicio where es_prueba;
--   delete from public.accesos_referencia where es_prueba;
--   delete from public.zonas where estado = 'propuesta';
--
-- Se puede volver a correr: empieza borrando lo suyo.
--
-- Comprobar después:
--   select nombre_visible, telefono_verificado, oficios, servicios_confirmados
--     from public.proveedores_publicos order by nombre_visible;
-- =====================================================================

do $$
declare
  -- Los tokens de cada ficha, para poder abrirlas en
  -- /servicios/mi-perfil/<token> sin cuenta de Google.
  t_rosa    text := 'prueba-servicios-rosa-modista-cali';
  t_alvaro  text := 'prueba-servicios-alvaro-trasteos-cali';
  t_marta   text := 'prueba-servicios-marta-almuerzos-cali';
  t_jeison  text := 'prueba-servicios-jeison-celulares-cali';
  t_yamile  text := 'prueba-servicios-yamileth-cuidado-cali';
  t_camilo  text := 'prueba-servicios-camilo-transporte-cali';
  t_nubia   text := 'prueba-servicios-nubia-belleza-cali';
  t_wilson  text := 'prueba-servicios-wilson-jardines-jamundi';
  t_luz     text := 'prueba-servicios-luz-mascotas-palmira';

  -- Y los de las solicitudes, para abrirlas en
  -- /servicios/solicitud/<token>.
  s_ropa    text := 'prueba-servicios-solicitud-ropa-cali';
  s_trasteo text := 'prueba-servicios-solicitud-trasteo-cali';
  s_celular text := 'prueba-servicios-solicitud-celular-cali';
  s_comida  text := 'prueba-servicios-solicitud-comida-jamundi';

  id_rosa   uuid;
  id_alvaro uuid;
  id_marta  uuid;
  id_jeison uuid;
  id_yamile uuid;
  id_camilo uuid;
  id_nubia  uuid;
  id_wilson uuid;
  id_luz    uuid;

  sol_ropa    uuid;
  sol_trasteo uuid;

  c3  uuid;  -- Comuna 3
  c8  uuid;  -- Comuna 8
  c13 uuid;
  c2  uuid;
  c17 uuid;
  c19 uuid;

  codigo text;
  r_id   uuid;
begin
  -- ---- Limpieza de una corrida anterior -----------------------------
  delete from public.proveedores where es_prueba;
  delete from public.solicitudes_servicio where es_prueba;
  delete from public.metricas_servicio where es_prueba;
  delete from public.accesos_referencia where es_prueba;
  delete from public.zonas where estado = 'propuesta' and municipio in ('76364','76520');

  select id into c3  from public.zonas where municipio='76001' and nombre='Comuna 3';
  select id into c8  from public.zonas where municipio='76001' and nombre='Comuna 8';
  select id into c13 from public.zonas where municipio='76001' and nombre='Comuna 13';
  select id into c2  from public.zonas where municipio='76001' and nombre='Comuna 2';
  select id into c17 from public.zonas where municipio='76001' and nombre='Comuna 17';
  select id into c19 from public.zonas where municipio='76001' and nombre='Comuna 19';

  if c3 is null then
    raise exception 'Faltan las comunas de Cali. Corre supabase/seed-zonas.sql primero.';
  end if;

  -- ===================================================================
  -- 1. Las fichas
  -- ===================================================================

  -- Rosa: el caso completo. Verificada, con referencia confirmada, con
  -- calificaciones y con una réplica. Es la que hay que mirar para ver
  -- la ficha «llena».
  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, zona_id, zona_texto,
     modalidad, dias, franjas, medios_pago, descripcion,
     acepto_publicacion, autorizacion_version, token_hash,
     telefono_verificado, verificado_at, es_prueba)
  values
    ('PRUEBA — Rosa, modista', 'persona', '000 000 0001', '76001', c3, 'San Nicolás',
     array['local','domicilio'], array['lun','mar','mie','jue','vie','sab'],
     array['manana','tarde'], array['efectivo','nequi'],
     'Arreglos de ropa y confección a la medida. Llevo veinte años cosiendo.',
     true, 'prueba', encode(extensions.digest(t_rosa,'sha256'),'hex'),
     true, now(), true)
  returning id into id_rosa;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo, precio_desde, unidad)
  values (id_rosa, 'arreglos_ropa',     'normal', 15000, 'prenda'),
         (id_rosa, 'confeccion_medida', 'normal', 90000, 'trabajo'),
         (id_rosa, 'uniformes',         'solidario', 45000, 'prenda');

  -- Don Álvaro: verificado pero sin referencias, y sin calificaciones.
  -- El caso «recién llegado y ya comprobado».
  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, zona_id,
     modalidad, dias, franjas, medios_pago, descripcion,
     acepto_publicacion, autorizacion_version, token_hash,
     telefono_verificado, verificado_at, es_prueba)
  values
    ('PRUEBA — Don Álvaro, trasteos', 'persona', '000 000 0002', '76001', c8,
     array['domicilio'], array['lun','mar','mie','jue','vie','sab','dom'],
     array['manana','tarde','noche'], array['efectivo'],
     'Trasteos y acarreos con camioneta propia. Cobro por viaje según distancia.',
     true, 'prueba', encode(extensions.digest(t_alvaro,'sha256'),'hex'),
     true, now(), true)
  returning id into id_alvaro;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo, precio_desde, unidad)
  values (id_alvaro, 'trasteos',      'normal', 120000, 'viaje'),
         (id_alvaro, 'acarreo_carga', 'normal',  80000, 'viaje');

  -- Marta: precio solidario y una calificación. Microempresa.
  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, zona_id, zona_texto,
     modalidad, dias, franjas, medios_pago, descripcion,
     acepto_publicacion, autorizacion_version, token_hash,
     telefono_verificado, verificado_at, es_prueba)
  values
    ('PRUEBA — Marta, almuerzos', 'microempresa', '000 000 0003', '76001', c13, 'El Vergel',
     array['local','domicilio'], array['lun','mar','mie','jue','vie'],
     array['manana','tarde'], array['efectivo','nequi','daviplata','bre_b'],
     'Almuerzos caseros. Tengo precio solidario para quien está sin trabajo.',
     true, 'prueba', encode(extensions.digest(t_marta,'sha256'),'hex'),
     true, now(), true)
  returning id into id_marta;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo, precio_desde, unidad)
  values (id_marta, 'almuerzos',     'solidario', 9000, 'plato'),
         (id_marta, 'cocina_por_dia','normal',   70000, 'dia'),
         (id_marta, 'tamales_empanadas', 'normal', 3500, 'unidad');

  -- Jeison: SIN verificar. Para ver la insignia «Sin verificar» y que
  -- aun así aparece en el directorio: sus oficios son de riesgo bajo.
  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, zona_id,
     modalidad, dias, franjas, medios_pago, descripcion,
     acepto_publicacion, autorizacion_version, token_hash, es_prueba)
  values
    ('PRUEBA — Jeison, celulares', 'persona', '000 000 0004', '76001', c2,
     array['local'], array['lun','mar','mie','jue','vie','sab'],
     array['tarde'], array['efectivo','bre_b'],
     'Cambio de pantalla y batería. Reparo computadores portátiles.',
     true, 'prueba', encode(extensions.digest(t_jeison,'sha256'),'hex'), true)
  returning id into id_jeison;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo, precio_desde, unidad)
  values (id_jeison, 'rep_celulares',   'normal', 80000, 'trabajo'),
         (id_jeison, 'rep_computadores','normal', 60000, 'trabajo');

  -- Yamileth: oficio de RIESGO ALTO que SÍ se publica, porque tiene las
  -- dos condiciones de la regla S. Es el contraste con Camilo.
  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, zona_id, zona_texto,
     modalidad, dias, franjas, medios_pago, descripcion,
     acepto_publicacion, autorizacion_version, token_hash,
     telefono_verificado, verificado_at, es_prueba)
  values
    ('PRUEBA — Yamileth, cuidado', 'persona', '000 000 0005', '76001', c17, 'Ciudad Jardín',
     array['domicilio'], array['lun','mar','mie','jue','vie'],
     array['manana','tarde'], array['efectivo','nequi'],
     'Cuido niños y hago aseo. Tengo experiencia con recién nacidos.',
     true, 'prueba', encode(extensions.digest(t_yamile,'sha256'),'hex'),
     true, now(), true)
  returning id into id_yamile;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo, precio_desde, unidad)
  values (id_yamile, 'cuidado_ninos', 'normal', 12000, 'hora'),
         (id_yamile, 'aseo_hogar',    'normal', 70000, 'dia');

  -- Camilo: su ÚNICO oficio es de riesgo alto y no está verificado, así
  -- que la regla S lo esconde entero. No sale en el directorio, y en
  -- /admin?ver=servicios aparece de primero en la cola con el aviso de
  -- que tiene un oficio esperando. Es el caso que hay que mirar para
  -- entender la regla.
  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, zona_id,
     modalidad, dias, franjas, medios_pago, descripcion,
     acepto_publicacion, autorizacion_version, token_hash, es_prueba)
  values
    ('PRUEBA — Camilo, transporte', 'persona', '000 000 0006', '76001', c19,
     array['domicilio'], array['lun','mar','mie','jue','vie','sab'],
     array['manana','tarde','noche'], array['efectivo'],
     'Llevo y traigo dentro de la ciudad. Carro de cuatro puestos.',
     true, 'prueba', encode(extensions.digest(t_camilo,'sha256'),'hex'), true)
  returning id into id_camilo;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo, precio_desde, unidad)
  values (id_camilo, 'transporte_pasajeros', 'normal', 20000, 'viaje');

  -- Nubia: modos gratis y aporte, para ver esos dos en la ficha. Con una
  -- referencia PENDIENTE, para que la cola del aliado tenga algo.
  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, zona_id, zona_texto,
     modalidad, dias, franjas, medios_pago, descripcion,
     acepto_publicacion, autorizacion_version, token_hash, es_prueba)
  values
    ('PRUEBA — Nubia, belleza', 'persona', '000 000 0007', '76001', c13, 'Marroquín',
     array['domicilio'], array['sab','dom'], array['manana'],
     array['efectivo'],
     'Peluquería y trenzas a domicilio los fines de semana.',
     true, 'prueba', encode(extensions.digest(t_nubia,'sha256'),'hex'), true)
  returning id into id_nubia;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo, precio_desde, unidad)
  values (id_nubia, 'trenzas',     'normal', 35000, 'trabajo'),
         (id_nubia, 'peluqueria',  'aporte', null, null),
         (id_nubia, 'manicure',    'gratis', null, null);

  -- ---- Fuera de Cali: sin comunas sembradas -------------------------
  -- Estas dos existen para ver el otro camino: no hay desplegable, se
  -- escribe la zona a mano, y esa zona entra a la cola de propuestas.

  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, zona_texto,
     modalidad, dias, franjas, medios_pago, descripcion,
     acepto_publicacion, autorizacion_version, token_hash, es_prueba)
  values
    ('PRUEBA — Wilson, jardines', 'persona', '000 000 0008', '76364', 'Ciudad Country',
     array['domicilio'], array['lun','mie','vie'], array['manana'],
     array['efectivo','daviplata'],
     'Poda de jardín y mantenimiento de zonas verdes.',
     true, 'prueba', encode(extensions.digest(t_wilson,'sha256'),'hex'), true)
  returning id into id_wilson;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo, precio_desde, unidad)
  values (id_wilson, 'jardineria', 'normal', 50000, 'dia'),
         (id_wilson, 'aseo_hogar', 'normal', 60000, 'dia');

  -- El insert directo se salta el efecto de `guardar_proveedor`, así que
  -- la propuesta se hace a mano. Si esto falta, la cola de zonas queda
  -- vacía y no se puede probar esa pantalla.
  perform public.proponer_zona('76364', 'Ciudad Country');

  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, zona_texto,
     modalidad, dias, franjas, medios_pago, descripcion,
     acepto_publicacion, autorizacion_version, token_hash, es_prueba)
  values
    ('PRUEBA — Luz, mascotas', 'persona', '000 000 0009', '76520', 'Zamorano',
     array['domicilio'], array['lun','mar','mie','jue','vie','sab'],
     array['manana','tarde'], array['efectivo','nequi'],
     'Paseo perros y hago peluquería canina a domicilio.',
     true, 'prueba', encode(extensions.digest(t_luz,'sha256'),'hex'), true)
  returning id into id_luz;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo, precio_desde, unidad)
  values (id_luz, 'paseo_mascotas',    'normal', 15000, 'hora'),
         (id_luz, 'peluqueria_canina', 'normal', 45000, 'trabajo');

  perform public.proponer_zona('76520', 'Zamorano');

  -- ===================================================================
  -- 2. Referencias — por RPC, así que van cifradas de verdad
  -- ===================================================================

  perform public.crear_referencia(
    'Cliente de prueba uno', '000 000 1001', 'arreglos_ropa', 'prueba', t_rosa);
  update public.referencias set estado = 'confirmada', revisada_at = now(), es_prueba = true
   where proveedor_id = id_rosa;

  perform public.crear_referencia(
    'Cliente de prueba dos', '000 000 1002', 'cuidado_ninos', 'prueba', t_yamile);
  update public.referencias set estado = 'confirmada', revisada_at = now(), es_prueba = true
   where proveedor_id = id_yamile;

  perform public.crear_referencia(
    'Cliente de prueba tres', '000 000 1003', 'almuerzos', 'prueba', t_marta);
  update public.referencias set estado = 'confirmada', revisada_at = now(), es_prueba = true
   where proveedor_id = id_marta;

  -- Esta se queda PENDIENTE a propósito: es lo que le da trabajo a la
  -- cola de muestreo del aliado y del administrador.
  perform public.crear_referencia(
    'Cliente de prueba cuatro', '000 000 1004', 'trenzas', 'prueba', t_nubia);
  update public.referencias set es_prueba = true where proveedor_id = id_nubia;

  -- ===================================================================
  -- 3. Servicios confirmados y calificaciones — también por RPC
  -- ===================================================================

  -- Rosa: tres servicios, tres notas distintas. Una con réplica.
  codigo := public.crear_codigo_servicio('arreglos_ropa', t_rosa);
  perform public.confirmar_y_resenar(codigo, 3, 3, 3,
    'Quedó perfecto y me lo entregó el mismo día.');

  codigo := public.crear_codigo_servicio('arreglos_ropa', t_rosa);
  perform public.confirmar_y_resenar(codigo, 3, 3, 2,
    'Muy buen trabajo. Se demoró un día más de lo que dijo.');

  codigo := public.crear_codigo_servicio('confeccion_medida', t_rosa);
  perform public.confirmar_y_resenar(codigo, 2, 3, 1,
    'El vestido quedó bien pero me tocó ir tres veces.');

  -- La réplica va sobre la calificación más baja, que es donde el
  -- derecho de réplica significa algo.
  select r.id into r_id from public.resenas r
   where r.proveedor_id = id_rosa order by r.puntualidad limit 1;
  perform public.responder_resena(
    r_id, 'Tiene razón, esa semana estaba sola en el taller. Ya no me pasa.', t_rosa);

  -- Marta: una sola calificación, buena.
  codigo := public.crear_codigo_servicio('almuerzos', t_marta);
  perform public.confirmar_y_resenar(codigo, 3, 3, 3,
    'La comida muy buena y siempre puntual.');

  -- Yamileth: dos, para que su ficha de riesgo alto tenga con qué.
  codigo := public.crear_codigo_servicio('cuidado_ninos', t_yamile);
  perform public.confirmar_y_resenar(codigo, 3, 3, 3, 'Los niños quedaron felices.');
  codigo := public.crear_codigo_servicio('aseo_hogar', t_yamile);
  perform public.confirmar_y_resenar(codigo, 3, 3, 3, null);

  -- Un código SIN usar, para ver esa cuenta en el panel del proveedor.
  perform public.crear_codigo_servicio('trasteos', t_alvaro);

  update public.servicios_prestados set es_prueba = true
   where proveedor_id in (id_rosa, id_marta, id_yamile, id_alvaro);
  update public.resenas set es_prueba = true
   where proveedor_id in (id_rosa, id_marta, id_yamile);

  -- ===================================================================
  -- 4. Solicitudes de servicio — por RPC, con el filtro de PII activo
  -- ===================================================================

  select s.solicitud_id into sol_ropa
  from public.crear_solicitud_servicio(
    'arreglos_ropa', '76001', c3, 'San Nicolás', 'hoy', 'no_puedo_pagar',
    'Son dos pantalones para bajar el ruedo.', s_ropa) s;

  select s.solicitud_id into sol_trasteo
  from public.crear_solicitud_servicio(
    'trasteos', '76001', c8, null, 'esta_semana', 'puedo_pagar',
    'Trasteo de un apartamento pequeño, un tercer piso sin ascensor.', s_trasteo) s;

  perform public.crear_solicitud_servicio(
    'rep_celulares', '76001', c2, 'Chiminangos', 'sin_prisa', 'pago_poco',
    'Se le partió la pantalla, todavía prende.', s_celular);

  -- En Jamundí, con zona escrita: propone otra zona para la cola.
  perform public.crear_solicitud_servicio(
    'almuerzos', '76364', null, 'La Morada', 'esta_semana', 'pago_poco',
    null, s_comida);

  update public.solicitudes_servicio set es_prueba = true where token_hash in (
    encode(extensions.digest(s_ropa,'sha256'),'hex'),
    encode(extensions.digest(s_trasteo,'sha256'),'hex'),
    encode(extensions.digest(s_celular,'sha256'),'hex'),
    encode(extensions.digest(s_comida,'sha256'),'hex'));

  -- ---- Respuestas ----------------------------------------------------
  perform public.responder_servicio(
    sol_ropa, 'Yo se lo hago hoy mismo. Traígamelos antes de las cinco.', t_rosa);

  perform public.responder_servicio(
    sol_trasteo, 'Tengo camioneta y ayudante. Le cotizo apenas me diga la dirección.',
    t_alvaro);

  -- ===================================================================
  -- 5. Resumen
  -- ===================================================================
  raise notice '--------------------------------------------------------';
  raise notice 'Fichas publicadas en el directorio: %',
    (select count(*) from public.proveedores_publicos);
  raise notice 'Fichas totales (incluye las que esconde la regla S): %',
    (select count(*) from public.proveedores);
  raise notice 'Solicitudes de servicio: %',
    (select count(*) from public.solicitudes_servicio);
  raise notice 'Zonas por revisar: %',
    (select count(*) from public.zonas where estado = 'propuesta');
  raise notice '--------------------------------------------------------';
end;
$$;

-- Los enlaces de cada ficha y de cada solicitud, para abrirlos sin
-- cuenta. Los tokens están arriba en claro; esto solo arma la URL.
select 'ficha'  as tipo, p.nombre_visible as quien,
       '/servicios/mi-perfil/' || t.token as ruta
from (values
  ('prueba-servicios-rosa-modista-cali'),
  ('prueba-servicios-alvaro-trasteos-cali'),
  ('prueba-servicios-marta-almuerzos-cali'),
  ('prueba-servicios-jeison-celulares-cali'),
  ('prueba-servicios-yamileth-cuidado-cali'),
  ('prueba-servicios-camilo-transporte-cali'),
  ('prueba-servicios-nubia-belleza-cali'),
  ('prueba-servicios-wilson-jardines-jamundi'),
  ('prueba-servicios-luz-mascotas-palmira')
) as t(token)
join public.proveedores p
  on p.token_hash = encode(extensions.digest(t.token,'sha256'),'hex')
union all
select 'solicitud', s.codigo || ' · ' || c.nombre,
       '/servicios/solicitud/' || t.token
from (values
  ('prueba-servicios-solicitud-ropa-cali'),
  ('prueba-servicios-solicitud-trasteo-cali'),
  ('prueba-servicios-solicitud-celular-cali'),
  ('prueba-servicios-solicitud-comida-jamundi')
) as t(token)
join public.solicitudes_servicio s
  on s.token_hash = encode(extensions.digest(t.token,'sha256'),'hex')
join public.catalogo_oficios c on c.id = s.oficio_id
order by 1, 2;
