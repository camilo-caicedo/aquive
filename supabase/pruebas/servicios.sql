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
