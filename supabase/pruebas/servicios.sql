-- =====================================================================
-- Pruebas del módulo de Servicios
--
--   node migracion/aplicar.mjs test servicios.sql
--
-- ⚠ Ojo: `aplicar.mjs` lee de `supabase/migraciones/`. Para correr esto
-- se pasa la ruta completa o se copia el bloque en el editor SQL del
-- panel de Supabase, contra el entorno de PRUEBA. Nunca contra producción:
-- el bloque escribe y borra filas.
--
-- No hay marco de pruebas en el proyecto y no se va a traer uno. Esto es
-- un `do $$ … $$` con `assert`: si algo deja de ser verdad, revienta con
-- el mensaje puesto y la transacción entera se deshace.
--
-- Cubre lo que no es obvio de mirar a ojo: la regla S en la vista, los
-- CHECK que sostienen reglas de negocio, y el borrado. Lo trivial no se
-- prueba.
--
-- Las funciones de escritura (S2 en adelante) traen sus propias
-- comprobaciones cuando existan; los §7 y §8 de PLAN-V3 §9 están aquí,
-- el resto llega con su fase.
-- =====================================================================

do $$
declare
  v_prov_alto  uuid;
  v_prov_bajo  uuid;
  v_sol        uuid;
  v_serv_usado uuid;
  v_serv_libre uuid;
  v_n          integer;
  v_fallo      boolean;
begin
  -- ------------------------------------------------------------------
  -- Fixtures. Todo con es_prueba y con nombres reconocibles.
  -- ------------------------------------------------------------------
  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, acepto_publicacion,
     autorizacion_version, token_hash, es_prueba)
  values
    ('PRUEBA riesgo alto', 'persona', '3000000001', '76001', true,
     'prueba', 'hash-prueba-alto', true)
  returning id into v_prov_alto;

  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, acepto_publicacion,
     autorizacion_version, token_hash, es_prueba)
  values
    ('PRUEBA riesgo bajo', 'persona', '3000000002', '76001', true,
     'prueba', 'hash-prueba-bajo', true)
  returning id into v_prov_bajo;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo)
  values (v_prov_alto, 'cuidado_ninos', 'normal'),
         (v_prov_bajo, 'arreglos_ropa', 'normal');

  -- ------------------------------------------------------------------
  -- 1. Regla S — un oficio de riesgo alto no se publica sin las DOS
  --    condiciones. Es lo único que separa «conectar gente» de
  --    «conectar a un desconocido con un niño», así que se prueba en
  --    los tres estados y no solo en el final.
  -- ------------------------------------------------------------------
  select count(*) into v_n from public.proveedor_oficios_publicos
   where proveedor_id = v_prov_alto;
  assert v_n = 0,
    'Regla S rota: oficio de riesgo alto visible sin teléfono verificado ni referencia';

  select count(*) into v_n from public.proveedores_publicos
   where id = v_prov_alto;
  assert v_n = 0,
    'Regla S rota: proveedor sin ningún oficio publicable aparece igual en el directorio';

  -- Solo el teléfono no basta.
  update public.proveedores set telefono_verificado = true where id = v_prov_alto;

  select count(*) into v_n from public.proveedor_oficios_publicos
   where proveedor_id = v_prov_alto;
  assert v_n = 0,
    'Regla S rota: teléfono verificado sin referencia confirmada ya publica el oficio de riesgo';

  -- Una referencia pendiente tampoco. `bytea` literal a propósito: esto
  -- prueba la vista, no el cifrado, y así no depende del Vault.
  insert into public.referencias
    (proveedor_id, nombre_cifrado, telefono_cifrado, telefono_hash,
     consentimiento_version, estado, es_prueba)
  values
    (v_prov_alto, '\x00'::bytea, '\x00'::bytea, 'hash-prueba',
     'prueba', 'pendiente', true);

  select count(*) into v_n from public.proveedor_oficios_publicos
   where proveedor_id = v_prov_alto;
  assert v_n = 0,
    'Regla S rota: una referencia PENDIENTE ya cuenta como confirmada';

  -- Las dos juntas, sí.
  update public.referencias set estado = 'confirmada' where proveedor_id = v_prov_alto;

  select count(*) into v_n from public.proveedor_oficios_publicos
   where proveedor_id = v_prov_alto;
  assert v_n = 1,
    'Regla S: con teléfono verificado y referencia confirmada el oficio debería publicarse';

  -- Y un oficio de riesgo bajo se publica siempre.
  select count(*) into v_n from public.proveedor_oficios_publicos
   where proveedor_id = v_prov_bajo;
  assert v_n = 1, 'Un oficio de riesgo bajo no debería exigir verificación';

  -- Suspender esconde todo, verificado o no.
  update public.proveedores set suspendido = true where id = v_prov_alto;
  select count(*) into v_n from public.proveedores_publicos where id = v_prov_alto;
  assert v_n = 0, 'Un proveedor suspendido sigue apareciendo en el directorio';
  update public.proveedores set suspendido = false where id = v_prov_alto;

  -- ------------------------------------------------------------------
  -- 2. Los CHECK que sostienen reglas, no tipos de dato.
  -- ------------------------------------------------------------------

  -- Dos dueños a la vez: prohibido.
  v_fallo := false;
  begin
    insert into public.proveedores
      (nombre_visible, tipo, telefono, municipio, autorizacion_version,
       perfil_id, token_hash, es_prueba)
    values ('PRUEBA dos dueños', 'persona', '3000000003', '76001', 'prueba',
            gen_random_uuid(), 'hash-prueba-dos', true);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Un proveedor pudo nacer con cuenta Y token: se rompe el habeas data del alta asistida';

  -- Ningún dueño: prohibido. Sin esto quedaría una ficha que nadie puede
  -- corregir ni borrar.
  v_fallo := false;
  begin
    insert into public.proveedores
      (nombre_visible, tipo, telefono, municipio, autorizacion_version, es_prueba)
    values ('PRUEBA sin dueño', 'persona', '3000000004', '76001', 'prueba', true);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Un proveedor pudo nacer sin dueño: nadie podría borrar esa ficha';

  -- Gratis con precio: incoherente.
  v_fallo := false;
  begin
    insert into public.proveedor_oficios (proveedor_id, oficio_id, modo, precio_desde, unidad)
    values (v_prov_bajo, 'uniformes', 'gratis', 20000, 'prenda');
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Un oficio en modo gratis aceptó un precio';

  -- Precio sin unidad: no se puede comparar ni mostrar.
  v_fallo := false;
  begin
    insert into public.proveedor_oficios (proveedor_id, oficio_id, modo, precio_desde)
    values (v_prov_bajo, 'cortinas', 'normal', 20000);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Un precio pudo guardarse sin unidad';

  -- ------------------------------------------------------------------
  -- 3. Regla T — un código, una reseña. En la base, no en la interfaz.
  -- ------------------------------------------------------------------
  insert into public.servicios_prestados
    (proveedor_id, oficio_id, codigo_hash, confirmado_at, es_prueba)
  values (v_prov_bajo, 'arreglos_ropa', 'hash-codigo-prueba-1', now(), true)
  returning id into v_serv_usado;

  insert into public.resenas
    (servicio_id, proveedor_id, cumplimiento, trato, puntualidad, es_prueba)
  values (v_serv_usado, v_prov_bajo, 3, 3, 2, true);

  v_fallo := false;
  begin
    insert into public.resenas
      (servicio_id, proveedor_id, cumplimiento, trato, puntualidad, es_prueba)
    values (v_serv_usado, v_prov_bajo, 1, 1, 1, true);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Regla T rota: el mismo código de servicio admitió dos reseñas';

  -- Una reseña oculta no sale, pero sigue existiendo para la moderación.
  update public.resenas set oculta = true where servicio_id = v_serv_usado;
  select count(*) into v_n from public.resenas_publicas where proveedor_id = v_prov_bajo;
  assert v_n = 0, 'Una reseña oculta sigue saliendo en resenas_publicas';
  update public.resenas set oculta = false where servicio_id = v_serv_usado;

  -- ------------------------------------------------------------------
  -- 4. Regla U — el rastro sobrevive a lo que registra.
  -- ------------------------------------------------------------------
  insert into public.accesos_referencia
    (referencia_id, referencia_ref, lector_ref, rol_lector, motivo, es_prueba)
  select r.id, r.id::text, 'prueba', 'admin',
         'comprobacion de la prueba automatica', true
  from public.referencias r where r.proveedor_id = v_prov_alto;

  delete from public.referencias where proveedor_id = v_prov_alto;

  select count(*) into v_n from public.accesos_referencia
   where es_prueba and referencia_id is null;
  assert v_n >= 1,
    'Regla U rota: el rastro de acceso se fue con la referencia en vez de quedarse huérfano';

  -- Motivo vago: rechazado. Sin esto la bitácora cuenta accesos, no
  -- diligencia.
  v_fallo := false;
  begin
    insert into public.accesos_referencia
      (referencia_ref, lector_ref, rol_lector, motivo, es_prueba)
    values ('x', 'prueba', 'admin', ' ', true);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'La bitácora aceptó un motivo vacío';

  -- ------------------------------------------------------------------
  -- 5. Nadie del lado del cliente ve las referencias.
  -- ------------------------------------------------------------------
  assert not has_table_privilege('anon', 'public.referencias', 'select'),
    'anon puede leer `referencias`';
  assert not has_table_privilege('authenticated', 'public.referencias', 'select'),
    'authenticated puede leer `referencias`';
  assert not has_table_privilege('anon', 'public.accesos_referencia', 'select'),
    'anon puede leer `accesos_referencia`';
  assert not has_table_privilege('anon', 'public.proveedores', 'select'),
    'anon puede leer `proveedores` directo, saltándose la vista y la regla S';
  assert has_table_privilege('anon', 'public.proveedores_publicos', 'select'),
    'anon NO puede leer el directorio: la sección se vería vacía en producción';

  -- ------------------------------------------------------------------
  -- 6. Borrado — regla 4. Lo vencido se va y deja métrica anónima.
  -- ------------------------------------------------------------------
  insert into public.solicitudes_servicio
    (codigo, token_hash, oficio_id, municipio, urgencia, capacidad_pago,
     expira_at, es_prueba)
  values ('PRB1', 'hash-token-prueba', 'arreglos_ropa', '76001', 'hoy',
          'no_puedo_pagar', now() - interval '1 hour', true)
  returning id into v_sol;

  insert into public.respuestas_servicio (solicitud_id, proveedor_id, mensaje)
  values (v_sol, v_prov_bajo, 'Mensaje de la prueba automatica');

  -- Un código sin usar y vencido, y otro confirmado: solo el primero cae.
  insert into public.servicios_prestados
    (proveedor_id, codigo_hash, expira_at, es_prueba)
  values (v_prov_bajo, 'hash-codigo-prueba-2', now() - interval '1 hour', true)
  returning id into v_serv_libre;

  perform public.expirar_servicios();

  select count(*) into v_n from public.solicitudes_servicio where id = v_sol;
  assert v_n = 0, 'expirar_servicios() no borró una solicitud vencida';

  select count(*) into v_n from public.respuestas_servicio where solicitud_id = v_sol;
  assert v_n = 0, 'La respuesta no se fue en cascada con la solicitud';

  select count(*) into v_n from public.metricas_servicio
   where es_prueba and oficio = 'arreglos_ropa' and hubo_respuesta;
  assert v_n >= 1, 'No quedó la métrica anónima de la solicitud borrada';

  select count(*) into v_n from public.servicios_prestados where id = v_serv_libre;
  assert v_n = 0, 'Un código sin usar y vencido sobrevivió';

  select count(*) into v_n from public.servicios_prestados where id = v_serv_usado;
  assert v_n = 1, 'Un código YA CONFIRMADO se borró: se lleva por delante la reseña que sostiene';

  -- La ficha del proveedor no la toca nadie.
  select count(*) into v_n from public.proveedores where id = v_prov_bajo;
  assert v_n = 1, 'expirar_servicios() borró un proveedor: esa tabla no expira';

  -- ------------------------------------------------------------------
  -- Limpieza. Si un assert falló, `aplicar.mjs` deshace la transacción
  -- entera y esto no hace falta; si pasaron todos, sí.
  -- ------------------------------------------------------------------
  delete from public.proveedores where es_prueba;
  delete from public.solicitudes_servicio where es_prueba;
  delete from public.accesos_referencia where es_prueba;
  delete from public.metricas_servicio where es_prueba;

  raise notice 'Pruebas del módulo de Servicios: OK';
end;
$$;

-- =====================================================================
-- Fase S2 — la RPC que guarda la ficha
--
-- Se prueba por el camino del token: `auth.uid()` no existe en una sesión
-- de psql, y el cuerpo de la función es el mismo para los dos dueños. Lo
-- único que queda sin cubrir aquí es la rama de creación con cuenta, que
-- son seis líneas de INSERT.
-- =====================================================================

do $$
declare
  v_tok   text := 'token-de-prueba-s2-no-usar-en-nada-real';
  v_id    uuid;
  v_ficha jsonb;
  v_n     integer;
  v_fallo boolean;
  v_ok    jsonb := '[{"oficio_id":"arreglos_ropa","modo":"normal","precio_desde":15000,"unidad":"prenda"}]'::jsonb;
begin
  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, acepto_publicacion,
     autorizacion_version, token_hash, telefono_verificado, es_prueba)
  values
    ('PRUEBA S2', 'persona', '3000000009', '76001', true, 'prueba',
     encode(extensions.digest(v_tok, 'sha256'), 'hex'), true, true)
  returning id into v_id;

  -- ---- Un token que no existe no edita nada -------------------------
  v_fallo := false;
  begin
    perform public.guardar_proveedor(
      'PRUEBA S2', 'persona', '3000000009', '76001', null, null,
      array['domicilio'], null, null, null, null, v_ok, true, 'prueba',
      'token-que-no-existe');
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Un token inventado pudo guardar una ficha';

  -- ---- Sin autorización no se publica nada --------------------------
  v_fallo := false;
  begin
    perform public.guardar_proveedor(
      'PRUEBA S2', 'persona', '3000000009', '76001', null, null,
      array['domicilio'], null, null, null, null, v_ok, false, 'prueba', v_tok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Se guardó una ficha sin marcar la autorización de publicación';

  -- ---- Regla 2: la descripción pasa por el filtro de PII ------------
  v_fallo := false;
  begin
    perform public.guardar_proveedor(
      'PRUEBA S2', 'persona', '3000000009', '76001', null, null,
      array['domicilio'], null, null, null,
      'Escríbeme al 3001234567', v_ok, true, 'prueba', v_tok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'La descripción aceptó un teléfono';

  -- ---- La zona: de la lista o escrita, no las dos -------------------
  v_fallo := false;
  begin
    perform public.guardar_proveedor(
      'PRUEBA S2', 'persona', '3000000009', '76001',
      (select z.id from public.zonas z where z.municipio = '76001' limit 1),
      'San Fernando', array['domicilio'], null, null, null, null,
      v_ok, true, 'prueba', v_tok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Se aceptaron zona de lista y zona escrita a la vez';

  -- ---- Una zona de otro municipio no es de este ---------------------
  v_fallo := false;
  begin
    perform public.guardar_proveedor(
      'PRUEBA S2', 'persona', '3000000009', '76109',
      (select z.id from public.zonas z where z.municipio = '76001' limit 1),
      null, array['domicilio'], null, null, null, null,
      v_ok, true, 'prueba', v_tok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Se aceptó una comuna de Cali en otro municipio';

  -- ---- Hay que decir cómo se atiende --------------------------------
  v_fallo := false;
  begin
    perform public.guardar_proveedor(
      'PRUEBA S2', 'persona', '3000000009', '76001', null, null,
      '{}', null, null, null, null, v_ok, true, 'prueba', v_tok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Se guardó una ficha sin modalidad de atención';

  -- ---- Un oficio inventado no entra ---------------------------------
  v_fallo := false;
  begin
    perform public.guardar_proveedor(
      'PRUEBA S2', 'persona', '3000000009', '76001', null, null,
      array['domicilio'], null, null, null, null,
      '[{"oficio_id":"reconstruccion_estructural","modo":"normal"}]'::jsonb,
      true, 'prueba', v_tok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Se aceptó un oficio que no está en el catálogo';

  -- ---- El camino feliz, y el precio en modo gratis se descarta ------
  perform public.guardar_proveedor(
    'PRUEBA S2 editada', 'persona', '3000000009', '76001', null, 'San Fernando',
    array['domicilio','local'], array['lun','mar'], array['manana'],
    array['efectivo','nequi'], 'Arreglo ropa hace veinte años.',
    '[{"oficio_id":"arreglos_ropa","modo":"normal","precio_desde":15000,"unidad":"prenda"},
      {"oficio_id":"uniformes","modo":"gratis","precio_desde":99999,"unidad":"prenda"}]'::jsonb,
    true, 'prueba', v_tok);

  select count(*) into v_n from public.proveedor_oficios where proveedor_id = v_id;
  assert v_n = 2, 'No quedaron los dos oficios';

  select count(*) into v_n from public.proveedor_oficios
   where proveedor_id = v_id and oficio_id = 'uniformes' and precio_desde is null;
  assert v_n = 1, 'Un oficio en modo gratis conservó el precio en vez de descartarlo';

  -- El teléfono no cambió, así que la verificación sigue en pie.
  select count(*) into v_n from public.proveedores
   where id = v_id and telefono_verificado;
  assert v_n = 1, 'Guardar sin tocar el teléfono tumbó la verificación';

  -- ---- Regla V: cambiar el teléfono tumba la marca ------------------
  perform public.guardar_proveedor(
    'PRUEBA S2 editada', 'persona', '3000000099', '76001', null, 'San Fernando',
    array['domicilio'], null, null, null, null, v_ok, true, 'prueba', v_tok);

  select count(*) into v_n from public.proveedores
   where id = v_id and not telefono_verificado and verificado_at is null;
  assert v_n = 1,
    'Regla V rota: se cambió el teléfono y la marca de verificado sobrevivió';

  -- Y el reemplazo de oficios es completo, no aditivo.
  select count(*) into v_n from public.proveedor_oficios where proveedor_id = v_id;
  assert v_n = 1, 'Los oficios se acumularon en vez de reemplazarse';

  -- ---- La ficha pública ---------------------------------------------
  v_ficha := public.ficha_proveedor(v_id);
  assert v_ficha is not null, 'ficha_proveedor no devolvió nada para una ficha publicada';
  assert v_ficha->>'nombre_visible' = 'PRUEBA S2 editada', 'La ficha devolvió otro nombre';
  assert jsonb_array_length(v_ficha->'oficios') = 1, 'La ficha no trajo el oficio';

  update public.proveedores set suspendido = true where id = v_id;
  assert public.ficha_proveedor(v_id) is null,
    'ficha_proveedor devuelve fichas suspendidas';
  update public.proveedores set suspendido = false where id = v_id;

  -- `mi_proveedor` sí las ve: es la pantalla de su dueño.
  assert public.mi_proveedor(v_tok) is not null,
    'El dueño no puede leer su propia ficha con su token';
  assert public.mi_proveedor('token-que-no-existe') is null,
    'Un token inventado leyó una ficha';

  -- ---- Reportes: los dos objetos y los dos motivos nuevos -----------
  perform public.crear_reporte('proveedor', v_id, 'extorsion_resena', null);
  perform public.crear_reporte('proveedor', v_id, 'discriminacion', null);
  v_fallo := false;
  begin
    perform public.crear_reporte('inventado', v_id, 'otro', null);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'crear_reporte aceptó un tipo de objeto inventado';

  -- ---- Borrado duro ---------------------------------------------------
  perform public.borrar_proveedor(v_tok);
  select count(*) into v_n from public.proveedores where id = v_id;
  assert v_n = 0, 'borrar_proveedor no borró';
  select count(*) into v_n from public.proveedor_oficios where proveedor_id = v_id;
  assert v_n = 0, 'Los oficios sobrevivieron al borrado de la ficha';

  delete from public.reportes where objeto_id = v_id;
  delete from public.proveedores where es_prueba;

  raise notice 'Pruebas de la fase S2: OK';
end;
$$;

-- =====================================================================
-- Fase S3 — alta asistida y verificación
--
-- Sin sesión, `auth.uid()` es null. Eso hace de esta sesión el peor caso
-- posible —un anónimo llamando a las RPC del equipo de la fundación— y
-- por eso lo que se prueba aquí es exactamente lo que más importa: que
-- nada de esto se pueda hacer sin ser quien dice ser.
-- =====================================================================

do $$
declare
  v_id    uuid;
  v_n     integer;
  v_fallo boolean;
begin
  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, acepto_publicacion,
     autorizacion_version, token_hash, es_prueba)
  values
    ('PRUEBA S3', 'persona', '3000000010', '76001', true, 'prueba',
     'hash-prueba-s3', true)
  returning id into v_id;

  -- ---- Nadie verifica un teléfono sin ser admin ni del equipo -------
  v_fallo := false;
  begin
    perform public.verificar_telefono_proveedor(v_id, true);
  exception when others then v_fallo := true;
  end;
  assert v_fallo,
    'Regla V rota: un anónimo pudo marcar un teléfono como verificado';

  select count(*) into v_n from public.proveedores
   where id = v_id and telefono_verificado;
  assert v_n = 0, 'La ficha quedó verificada pese a que la llamada falló';

  -- ---- Suspender es solo del administrador --------------------------
  v_fallo := false;
  begin
    perform public.suspender_proveedor(v_id, true);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Un anónimo pudo suspender una ficha';

  -- ---- Y verificar una ficha que no existe tampoco pasa -------------
  v_fallo := false;
  begin
    perform public.verificar_telefono_proveedor(gen_random_uuid(), true);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'verificar_telefono_proveedor no se queja de una ficha inexistente';

  -- ---- Dar de alta a nombre de una organización ajena ---------------
  v_fallo := false;
  begin
    perform public.crear_proveedor_asistido(
      gen_random_uuid(),
      repeat('a', 64),
      'PRUEBA intrusa', 'persona', '3000000011', '76001', null, null,
      array['domicilio'],
      '[{"oficio_id":"arreglos_ropa","modo":"normal"}]'::jsonb,
      'prueba');
  exception when others then v_fallo := true;
  end;
  assert v_fallo,
    'Un anónimo pudo dar de alta un proveedor a nombre de una organización';

  -- ---- Sin equipo no hay cola ---------------------------------------
  assert public.proveedores_de_mi_organizacion() = '[]'::jsonb,
    'proveedores_de_mi_organizacion devuelve algo sin sesión';
  assert public.mi_organizacion_activa() is null,
    'mi_organizacion_activa devuelve algo sin sesión';

  delete from public.proveedores where es_prueba;

  raise notice 'Pruebas de la fase S3: OK';
end;
$$;

-- =====================================================================
-- Fase S4 — referencias cifradas
--
-- Si el bloque revienta con «Falta la llave de cifrado», el problema no
-- es esta prueba: es que el secreto `aquive_identidad_key` no está en el
-- Vault de esta base. Es exactamente lo que tiene que pasar antes que
-- guardar un NULL donde debería ir un nombre cifrado.
-- =====================================================================

do $$
declare
  v_tok   text := 'token-de-prueba-s4-no-usar-en-nada-real';
  v_prov  uuid;
  v_ref   uuid;
  v_lista jsonb;
  v_n     integer;
  v_fallo boolean;
begin
  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, acepto_publicacion,
     autorizacion_version, token_hash, es_prueba)
  values
    ('PRUEBA S4', 'persona', '3000000020', '76001', true, 'prueba',
     encode(extensions.digest(v_tok, 'sha256'), 'hex'), true)
  returning id into v_prov;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo)
  values (v_prov, 'cuidado_ninos', 'normal');

  -- ---- El teléfono no va escondido en el nombre ---------------------
  v_fallo := false;
  begin
    perform public.crear_referencia(
      'Ana Perez 3001234567', '3009999001', null, 'prueba', v_tok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'El nombre de la referencia aceptó un teléfono dentro';

  -- ---- Y el teléfono tiene que parecer un teléfono ------------------
  v_fallo := false;
  begin
    perform public.crear_referencia('Ana Perez', 'llamame', null, 'prueba', v_tok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Se aceptó un teléfono que no lo es';

  -- ---- Sin versión del consentimiento no se guarda nada -------------
  v_fallo := false;
  begin
    perform public.crear_referencia('Ana Perez', '3009999001', null, '', v_tok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo,
    'Se guardó el dato de un tercero sin dejar constancia de qué texto se le leyó';

  -- ---- Camino feliz ---------------------------------------------------
  v_ref := public.crear_referencia(
    'Ana Perez', '300 999 9001', 'cuidado_ninos', 'prueba', v_tok);
  assert v_ref is not null, 'No se creó la referencia';

  -- Lo guardado está cifrado de verdad: el nombre en claro no aparece.
  --
  -- El BEGIN interno no es adorno: en plpgsql, un `exception` atrapa
  -- deshaciendo TODO su bloque, así que ponerlo en el bloque de afuera
  -- borraría los fixtures y el siguiente bloque no encontraría la ficha.
  -- Aquí lo que se traga es solo el error de codificación de
  -- `convert_from` sobre bytea cifrado, que además prueba lo mismo.
  begin
    select count(*) into v_n from public.referencias r
     where r.id = v_ref
       and position('Ana Perez' in convert_from(r.nombre_cifrado, 'UTF8')) > 0;
    assert v_n = 0, 'El nombre quedó guardado en claro';
  exception
    when character_not_in_repertoire or untranslatable_character then
      null;
  end;
end;
$$;

do $$
declare
  v_tok   text := 'token-de-prueba-s4-no-usar-en-nada-real';
  v_prov  uuid;
  v_ref   uuid;
  v_lista jsonb;
  v_n     integer;
  v_fallo boolean;
begin
  select p.id into v_prov from public.proveedores p
   where p.token_hash = encode(extensions.digest(v_tok, 'sha256'), 'hex');
  select r.id into v_ref from public.referencias r where r.proveedor_id = v_prov limit 1;

  -- ---- La misma persona no cuenta dos veces --------------------------
  v_fallo := false;
  begin
    -- Escrito distinto, mismo número: `normalizar_telefono` los iguala.
    perform public.crear_referencia('Ana P.', '+573009999001', null, 'prueba', v_tok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo,
    'El mismo teléfono escrito distinto entró como una segunda referencia';

  -- ---- Tope de tres ---------------------------------------------------
  perform public.crear_referencia('Beto', '3009999002', null, 'prueba', v_tok);
  perform public.crear_referencia('Carla', '3009999003', null, 'prueba', v_tok);
  v_fallo := false;
  begin
    perform public.crear_referencia('Dora', '3009999004', null, 'prueba', v_tok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Se pudo pasar del tope de tres referencias';

  -- ---- Lo que ve el proveedor NO trae los datos del tercero ---------
  v_lista := public.mis_referencias(v_tok);
  assert jsonb_array_length(v_lista) = 3, 'mis_referencias no trajo las tres';
  assert not (v_lista::text like '%Ana%'),
    'mis_referencias devuelve el nombre de la referencia: eso solo sale por leer_referencia';
  assert not (v_lista::text like '%9999001%'),
    'mis_referencias devuelve el teléfono de la referencia';

  -- ---- Regla S: pendientes no destapan el oficio de riesgo ----------
  update public.proveedores set telefono_verificado = true where id = v_prov;
  select count(*) into v_n from public.proveedor_oficios_publicos
   where proveedor_id = v_prov;
  assert v_n = 0,
    'Regla S rota: tres referencias PENDIENTES ya publican el oficio de riesgo';

  -- ---- Nadie descifra sin ser quien dice ser -------------------------
  v_fallo := false;
  begin
    perform public.leer_referencia(v_ref, 'comprobacion de la prueba');
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Regla U rota: un anónimo descifró una referencia';

  -- Y sin motivo falla ANTES de mirar si existe: una llamada sin motivo
  -- no puede servir ni para sondear qué uuid hay.
  v_fallo := false;
  begin
    perform public.leer_referencia(gen_random_uuid(), 'x');
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'leer_referencia aceptó un motivo de un carácter';

  select count(*) into v_n from public.accesos_referencia
   where motivo = 'comprobacion de la prueba';
  assert v_n = 0, 'Se escribió bitácora de una lectura que no ocurrió';

  -- ---- Marcar tampoco --------------------------------------------------
  v_fallo := false;
  begin
    perform public.marcar_referencia(v_ref, 'confirmada');
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Un anónimo pudo confirmar una referencia';

  -- ---- Las colas son del equipo y del administrador -------------------
  v_fallo := false;
  begin
    perform public.referencias_por_revisar();
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'referencias_por_revisar respondió sin sesión';

  v_fallo := false;
  begin
    perform public.accesos_a_referencias();
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'La bitácora se puede leer sin ser administrador';

  -- ---- El proveedor sí puede borrar la suya ---------------------------
  perform public.borrar_referencia(v_ref, v_tok);
  select count(*) into v_n from public.referencias where id = v_ref;
  assert v_n = 0, 'borrar_referencia no borró';

  -- ---- Y no puede borrar la de otro -----------------------------------
  v_fallo := false;
  begin
    perform public.borrar_referencia(
      (select r.id from public.referencias r where r.proveedor_id <> v_prov limit 1),
      v_tok);
  exception when others then v_fallo := true;
  end;
  -- Si no hay referencias de nadie más, no hay nada que probar y la
  -- llamada falla por «no existe», que también es un fallo.
  assert v_fallo or not exists (
    select 1 from public.referencias r where r.proveedor_id <> v_prov),
    'Un proveedor pudo borrar la referencia de otro';

  delete from public.proveedores where es_prueba;
  delete from public.accesos_referencia where es_prueba;

  raise notice 'Pruebas de la fase S4: OK';
end;
$$;

-- =====================================================================
-- Fase S5 — el lado de la demanda
-- =====================================================================

do $$
declare
  v_tok   text := 'token-de-prueba-s5-solicitud-no-usar-en-nada-real';
  v_ptok  text := 'token-de-prueba-s5-proveedor-no-usar-en-nada-real';
  v_sol   uuid;
  v_cod   text;
  v_prov  uuid;
  v_leida jsonb;
  v_n     integer;
  v_fallo boolean;
begin
  -- ---- Regla 1: la nota no admite un teléfono -----------------------
  v_fallo := false;
  begin
    perform public.crear_solicitud_servicio(
      'arreglos_ropa', '76001', null, null, 'hoy', 'puedo_pagar',
      'Llamame al 3001234567', v_tok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Regla 1 rota: la nota de la solicitud aceptó un teléfono';

  -- ---- Ni un correo ---------------------------------------------------
  v_fallo := false;
  begin
    perform public.crear_solicitud_servicio(
      'arreglos_ropa', '76001', null, null, 'hoy', 'puedo_pagar',
      'escribeme a juan@correo.com', v_tok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Regla 1 rota: la nota aceptó un correo';

  -- ---- Zona de otro municipio ----------------------------------------
  v_fallo := false;
  begin
    perform public.crear_solicitud_servicio(
      'arreglos_ropa', '76109',
      (select z.id from public.zonas z where z.municipio = '76001' limit 1),
      null, 'hoy', 'puedo_pagar', null, v_tok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Se aceptó una comuna de Cali en otro municipio';

  -- ---- Camino feliz ----------------------------------------------------
  select s.solicitud_id, s.codigo into v_sol, v_cod
  from public.crear_solicitud_servicio(
    'arreglos_ropa', '76001', null, 'San Fernando', 'hoy', 'no_puedo_pagar',
    'Son dos pantalones.', v_tok) s;

  assert v_sol is not null, 'No se creó la solicitud';
  assert char_length(v_cod) = 4, 'El código no tiene cuatro caracteres';

  update public.solicitudes_servicio set es_prueba = true where id = v_sol;

  -- El token no se guarda en claro en ninguna columna.
  select count(*) into v_n from public.solicitudes_servicio s
   where s.id = v_sol and s.token_hash = v_tok;
  assert v_n = 0, 'El token quedó guardado en claro';

  -- ---- Responder exige ficha publicada --------------------------------
  v_fallo := false;
  begin
    perform public.responder_servicio(v_sol, 'Yo puedo hacerlo mañana', v_ptok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Alguien sin ficha pudo responder una solicitud';

  -- Ahora sí, con ficha publicada.
  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, acepto_publicacion,
     autorizacion_version, token_hash, es_prueba)
  values
    ('PRUEBA S5', 'persona', '3000000030', '76001', true, 'prueba',
     encode(extensions.digest(v_ptok, 'sha256'), 'hex'), true)
  returning id into v_prov;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo)
  values (v_prov, 'arreglos_ropa', 'normal');

  -- ---- El mensaje también pasa por el filtro --------------------------
  v_fallo := false;
  begin
    perform public.responder_servicio(v_sol, 'Escribeme al 3009999999', v_ptok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'El mensaje de respuesta aceptó un teléfono';

  perform public.responder_servicio(v_sol, 'Puedo mañana en la mañana.', v_ptok);

  -- ---- Una respuesta por par: la segunda actualiza, no duplica --------
  perform public.responder_servicio(v_sol, 'Corrijo: puedo hoy en la tarde.', v_ptok);
  select count(*) into v_n from public.respuestas_servicio
   where solicitud_id = v_sol and proveedor_id = v_prov;
  assert v_n = 1, 'El mismo proveedor dejó dos respuestas en la misma solicitud';

  -- ---- Lo que ve quien pidió, con su token -----------------------------
  v_leida := public.leer_solicitud_servicio(v_tok);
  assert v_leida is not null, 'El token no abrió la solicitud';
  assert jsonb_array_length(v_leida->'respuestas') = 1, 'No trajo la respuesta';
  assert v_leida->'respuestas'->0->>'telefono' = '3000000030',
    'La respuesta no trae el teléfono de quien ofreció';

  -- Un token cualquiera no abre nada.
  assert public.leer_solicitud_servicio('token-que-no-existe') is null,
    'Un token inventado abrió una solicitud';

  -- ---- Un proveedor suspendido desaparece de las respuestas -----------
  update public.proveedores set suspendido = true where id = v_prov;
  v_leida := public.leer_solicitud_servicio(v_tok);
  assert jsonb_array_length(v_leida->'respuestas') = 0,
    'La respuesta de un proveedor suspendido sigue mostrándose';
  update public.proveedores set suspendido = false where id = v_prov;

  -- ---- Renovar y cerrar -------------------------------------------------
  perform public.gestionar_solicitud_servicio(v_tok, 'resolver');
  select count(*) into v_n from public.solicitudes_servicio
   where id = v_sol and estado = 'resuelta';
  assert v_n = 1, 'No se marcó como resuelta';

  -- Cerrada, ya no se puede responder.
  v_fallo := false;
  begin
    perform public.responder_servicio(v_sol, 'Todavia puedo ayudarte', v_ptok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Se pudo responder una solicitud ya resuelta';

  -- Y ya no sale en el tablero público.
  select count(*) into v_n from public.solicitudes_servicio_publicas where id = v_sol;
  assert v_n = 0, 'Una solicitud resuelta sigue en el tablero';

  -- ---- Borrar deja la métrica anónima ------------------------------------
  perform public.gestionar_solicitud_servicio(v_tok, 'borrar');
  select count(*) into v_n from public.solicitudes_servicio where id = v_sol;
  assert v_n = 0, 'gestionar_solicitud_servicio no borró';
  select count(*) into v_n from public.metricas_servicio
   where es_prueba and oficio = 'arreglos_ropa' and hubo_confirmacion;
  assert v_n >= 1,
    'Borrar a mano no dejó la métrica: se perdería la estadística de lo que sí funcionó';

  -- Y la respuesta se fue en cascada.
  select count(*) into v_n from public.respuestas_servicio where solicitud_id = v_sol;
  assert v_n = 0, 'La respuesta sobrevivió al borrado de la solicitud';

  delete from public.proveedores where es_prueba;
  delete from public.solicitudes_servicio where es_prueba;
  delete from public.metricas_servicio where es_prueba;

  raise notice 'Pruebas de la fase S5: OK';
end;
$$;

-- =====================================================================
-- Fase S6 — códigos de servicio y reseñas
-- =====================================================================

do $$
declare
  v_ptok  text := 'token-de-prueba-s6-proveedor-no-usar-en-nada-real';
  v_prov  uuid;
  v_cod   text;
  v_cod2  text;
  v_res   uuid;
  v_datos jsonb;
  v_n     integer;
  v_fallo boolean;
begin
  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, acepto_publicacion,
     autorizacion_version, token_hash, es_prueba)
  values
    ('PRUEBA S6', 'persona', '3000000040', '76001', true, 'prueba',
     encode(extensions.digest(v_ptok, 'sha256'), 'hex'), true)
  returning id into v_prov;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo)
  values (v_prov, 'arreglos_ropa', 'normal');

  -- ---- Sin ficha no hay código --------------------------------------
  v_fallo := false;
  begin
    perform public.crear_codigo_servicio(null, 'token-que-no-existe');
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Se generó un código sin tener ficha';

  -- ---- Un oficio que no es suyo tampoco -----------------------------
  v_fallo := false;
  begin
    perform public.crear_codigo_servicio('cuidado_ninos', v_ptok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Se generó un código de un oficio que no está en su ficha';

  -- ---- Camino feliz ---------------------------------------------------
  v_cod := public.crear_codigo_servicio('arreglos_ropa', v_ptok);
  assert char_length(v_cod) = 8, 'El código no tiene ocho caracteres';
  assert v_cod !~ '[IO01]',
    'El código trae caracteres confundibles: se dicta por teléfono y se copia de un papel';

  -- El código NO queda guardado en claro.
  select count(*) into v_n from public.servicios_prestados s
   where s.proveedor_id = v_prov and s.codigo_hash = v_cod;
  assert v_n = 0, 'El código quedó guardado en claro';

  update public.servicios_prestados set es_prueba = true where proveedor_id = v_prov;

  -- ---- Un código inventado no confirma nada ---------------------------
  v_fallo := false;
  begin
    perform public.confirmar_y_resenar('ZZZZ9999', 3, 3, 3, null);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Un código inventado confirmó un servicio';

  -- ---- Regla 2: el comentario pasa por el filtro ----------------------
  v_fallo := false;
  begin
    perform public.confirmar_y_resenar(v_cod, 3, 3, 3, 'Excelente, llamalo al 3001234567');
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'El comentario de la reseña aceptó un teléfono';

  -- Y el fallo no dejó el código quemado.
  select count(*) into v_n from public.servicios_prestados s
   where s.proveedor_id = v_prov and s.confirmado_at is not null;
  assert v_n = 0, 'Un intento fallido dejó el código como usado';

  -- ---- Se acepta escrito distinto -------------------------------------
  v_datos := public.confirmar_y_resenar(
    lower(substr(v_cod, 1, 4) || ' - ' || substr(v_cod, 5, 4)), 3, 2, 3, 'Quedó muy bien.');
  assert v_datos->>'proveedor_nombre' = 'PRUEBA S6',
    'confirmar_y_resenar no devolvió de quién era el código';

  select count(*) into v_n from public.resenas r where r.proveedor_id = v_prov;
  assert v_n = 1, 'No quedó la reseña';

  -- ---- Regla T: el mismo código no sirve dos veces ---------------------
  v_fallo := false;
  begin
    perform public.confirmar_y_resenar(v_cod, 1, 1, 1, null);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Regla T rota: el mismo código calificó dos veces';

  -- ---- Un código vencido tampoco ---------------------------------------
  v_cod2 := public.crear_codigo_servicio(null, v_ptok);
  update public.servicios_prestados
     set expira_at = now() - interval '1 day', es_prueba = true
   where codigo_hash = encode(extensions.digest(v_cod2, 'sha256'), 'hex');
  v_fallo := false;
  begin
    perform public.confirmar_y_resenar(v_cod2, 3, 3, 3, null);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Un código vencido sirvió para calificar';

  -- ---- La ficha pública ya cuenta el servicio --------------------------
  select p.servicios_confirmados into v_n
  from public.proveedores_publicos p where p.id = v_prov;
  assert v_n = 1, 'La ficha no cuenta el servicio confirmado';

  -- ---- Derecho de réplica ----------------------------------------------
  select r.id into v_res from public.resenas r where r.proveedor_id = v_prov;

  v_fallo := false;
  begin
    perform public.responder_resena(v_res, 'Gracias, escribeme al 3001112222', v_ptok);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'La réplica aceptó un teléfono';

  perform public.responder_resena(v_res, 'Gracias por avisar, lo corrijo.', v_ptok);
  select count(*) into v_n from public.resenas r
   where r.id = v_res and r.replica is not null and r.replica_at is not null;
  assert v_n = 1, 'No quedó la réplica';

  -- Y nadie responde la reseña de otro.
  v_fallo := false;
  begin
    perform public.responder_resena(v_res, 'Yo tambien opino', 'token-que-no-existe');
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Alguien respondió una reseña que no es de su ficha';

  -- ---- Moderación es del administrador ----------------------------------
  v_fallo := false;
  begin
    perform public.ocultar_resena(v_res, true);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Un anónimo ocultó una reseña';

  v_fallo := false;
  begin
    perform public.borrar_resena(v_res);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Un anónimo borró una reseña';

  -- ---- Lo que ve el proveedor --------------------------------------------
  v_datos := public.mis_servicios(v_ptok);
  assert jsonb_array_length(v_datos->'resenas') = 1, 'mis_servicios no trajo la reseña';
  assert jsonb_array_length(v_datos->'codigos') = 2, 'mis_servicios no trajo los códigos';
  -- El código en claro ya no existe en ninguna parte.
  assert not (v_datos::text like '%' || v_cod || '%'),
    'mis_servicios devuelve el código en claro: solo debería existir su hash';

  delete from public.proveedores where es_prueba;

  raise notice 'Pruebas de la fase S6: OK';
end;
$$;

-- =====================================================================
-- Fase S7 — moderación y datos abiertos
-- =====================================================================

do $$
declare
  v_prov  uuid;
  v_serv  uuid;
  v_res   uuid;
  v_rep   uuid;
  v_n     integer;
  v_fallo boolean;
begin
  insert into public.proveedores
    (nombre_visible, tipo, telefono, municipio, acepto_publicacion,
     autorizacion_version, token_hash, es_prueba)
  values
    ('PRUEBA S7', 'persona', '3000000050', '76001', true, 'prueba',
     'hash-prueba-s7', true)
  returning id into v_prov;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo)
  values (v_prov, 'arreglos_ropa', 'normal');

  insert into public.servicios_prestados
    (proveedor_id, codigo_hash, confirmado_at, es_prueba)
  values (v_prov, 'hash-codigo-prueba-s7', now(), true)
  returning id into v_serv;

  insert into public.resenas
    (servicio_id, proveedor_id, cumplimiento, trato, puntualidad,
     comentario, es_prueba)
  values (v_serv, v_prov, 1, 1, 1, 'Comentario de la prueba', true)
  returning id into v_res;

  -- ---- Los dos objetos nuevos se pueden reportar ---------------------
  perform public.crear_reporte('proveedor', v_prov, 'estafa', null);
  perform public.crear_reporte('resena', v_res, 'extorsion_resena', null);
  select r.id into v_rep from public.reportes r
   where r.objeto_id = v_res and not r.atendido limit 1;
  assert v_rep is not null, 'No quedó el reporte sobre la calificación';

  -- ---- Y resolverlos exige ser administrador -------------------------
  v_fallo := false;
  begin
    perform public.resolver_reporte(v_rep, true);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Un anónimo resolvió un reporte';

  -- ---- El panel y las funciones de catálogo, también -----------------
  v_fallo := false;
  begin
    perform public.panel_admin_servicios();
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'panel_admin_servicios respondió sin ser administrador';

  v_fallo := false;
  begin
    perform public.guardar_zona('76001', 'Comuna inventada', 'comuna', 99);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Un anónimo sembró una zona';

  v_fallo := false;
  begin
    perform public.guardar_oficio('inventado', 'otros', 'Inventado', 'bajo', true, 0);
  exception when others then v_fallo := true;
  end;
  assert v_fallo, 'Un anónimo agregó un oficio al catálogo';

  select count(*) into v_n from public.zonas where nombre = 'Comuna inventada';
  assert v_n = 0, 'La zona se creó pese a que la llamada falló';
  select count(*) into v_n from public.catalogo_oficios where id = 'inventado';
  assert v_n = 0, 'El oficio se creó pese a que la llamada falló';

  -- ---- Los datos abiertos no traen nada identificable ----------------
  insert into public.metricas_servicio
    (municipio, oficio, grupo, hubo_respuesta, hubo_confirmacion, es_prueba)
  values ('76001', 'arreglos_ropa', 'confeccion', true, true, true);

  -- Con es_prueba no debe salir: es el mismo filtro que /datos.
  select count(*) into v_n from public.datos_servicios
   where oficio = 'arreglos_ropa' and municipio = '76001';
  assert v_n = 0, 'Una fila de prueba se coló en los datos abiertos';

  insert into public.metricas_servicio
    (municipio, oficio, grupo, hubo_respuesta, hubo_confirmacion, es_prueba)
  values ('76001', 'arreglos_ropa', 'confeccion', true, false, false);

  select count(*) into v_n from public.datos_servicios
   where oficio = 'arreglos_ropa' and municipio = '76001';
  assert v_n = 1, 'Los datos abiertos no agregan la fila real';

  assert has_table_privilege('anon', 'public.datos_servicios', 'select'),
    'anon no puede leer los datos abiertos: la página quedaría vacía';

  delete from public.metricas_servicio
   where oficio = 'arreglos_ropa' and municipio = '76001';
  delete from public.reportes where objeto_id in (v_prov, v_res);
  delete from public.proveedores where es_prueba;

  raise notice 'Pruebas de la fase S7: OK';
end;
$$;
