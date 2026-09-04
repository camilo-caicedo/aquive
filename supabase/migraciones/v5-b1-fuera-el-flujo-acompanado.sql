-- ---------------------------------------------------------------------
-- Se retira el flujo acompañado (ADR 0007)
-- y el aliado pasa a ser un centro de acopio (ADR 0008)
-- ---------------------------------------------------------------------
--
-- Se va el segundo recorrido del módulo de emergencia: hilos de tres,
-- identidades cifradas, coincidencias y entregas coordinadas. Ya no hay
-- fundaciones aliadas —AquíVe es de Nodo Social— y estaba muerto: al
-- decidirlo había 0 entregas, 0 identidades, 0 conversaciones, 0 mensajes.
--
-- ⚠ NO se toca el chat de servicios. `chats_servicio` y `mensajes_servicio`
-- son otra cosa: la regla de producto 2, el chat que se abre por un pedido
-- de servicio y muere con él. Es el error fácil de cometer aquí.

-- ---------------------------------------------------------------------
-- 1 · Las funciones que se van con él
-- ---------------------------------------------------------------------
--
-- Postgres no borra una función porque desaparezca la tabla que usa: se
-- queda ahí y falla el día que alguien la llame. Por eso van una por una.

drop function if exists public.mensajes_de(uuid);
drop function if exists public.rol_en_conversacion(uuid);
-- Con `cascade`: es la función de un trigger, y el trigger depende de ella.
-- Es el trigger que impedía escribir en un hilo sin aliado a cargo.
drop function if exists public.exigir_hilo_con_aliado() cascade;
drop function if exists public.enviar_mensaje(uuid, text);
drop function if exists public.enviar_mensaje_token(text, uuid, text);
drop function if exists public.mis_conversaciones_token(text);
drop function if exists public.coincidencias_para_aliado();
drop function if exists public.confirmar_recepcion(text, uuid);
drop function if exists public.asignar_aliado(uuid);
drop function if exists public.devolver_a_directo(uuid, text);
drop function if exists public.respuestas_por_coordinar();
drop function if exists public.destinatarios_conversacion(uuid, uuid, boolean);
drop function if exists public.solicitudes_de_mi_organizacion();
drop function if exists public.abrir_entrega_directa(uuid, text);
drop function if exists public.registrar_acceso_identidad(uuid, text, boolean);
drop function if exists public.puede_leer_identidad(uuid);
drop function if exists public.leer_identidad(uuid, text);
drop function if exists public.iniciar_conversacion(text, text);
drop function if exists public.moderar_mensaje(uuid, boolean);
drop function if exists public.registrar_entrega(uuid, jsonb);
drop function if exists public.exportar_planilla(uuid, text);
drop function if exists public.activar_acompanamiento(text, uuid, text, text, text);
drop function if exists public.aliados_del_municipio(text);
drop function if exists public.mis_hilos();
drop function if exists public.leer_conversacion(uuid);
drop function if exists public.invitar_a_conversacion(uuid, uuid, text);
drop function if exists public.destapar_contacto(uuid, text);

-- Las de solicitudes con token: sus escrituras subieron al contrato con el
-- ADR 0006, así que aquí solo se retira lo que quedó sin usar.
drop function if exists public.crear_solicitud(text, text, text, text, jsonb, text, boolean);
drop function if exists public.crear_solicitud_servicio(text, text, uuid, text, text, text, text, text);
drop function if exists public.leer_solicitud(text);
drop function if exists public.leer_solicitud_servicio(text);
drop function if exists public.gestionar_solicitud_servicio(text, text);
drop function if exists public.renovar_solicitud(text);
drop function if exists public.cerrar_solicitud(text, boolean);
drop function if exists public.marcar_item_cubierto(uuid, boolean, text);
drop function if exists public.agregar_contacto_solicitante(text, text, text, text, text);
drop function if exists public.mis_datos(text);
drop function if exists public.suprimir_mis_datos(text);
drop function if exists public.proveedor_del_llamante(text);
drop function if exists public.crear_proveedor_asistido(text, text, text, uuid, text, text[], text[], text);

-- ---------------------------------------------------------------------
-- 2 · Las que sobreviven, sin la parte muerta
-- ---------------------------------------------------------------------

-- El encabezado. La quinta celda tenía dos públicos —el equipo de una
-- fundación y quien ofreció ayuda en una solicitud acompañada—; ahora solo
-- queda el primero, que es el equipo de un centro de acopio.
create or replace function public.estado_encabezado()
returns jsonb
language sql stable security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'coordinacion', case when public.soy_aliado() then 'organizacion' end,
    'avisos_sin_ver', (
      select count(*)
        from jsonb_array_elements(public.mis_avisos()) a
       where (a->>'fecha')::timestamptz >
             coalesce((select p.avisos_vistos_at from public.perfiles p
                        where p.id = auth.uid()),
                      '-infinity'::timestamptz)
    )
  );
$$;

-- Los avisos. Se van los de hilos acompañados; se quedan los del módulo de
-- servicios y los de respuestas a solicitudes.
create or replace function public.mis_avisos()
returns jsonb
language sql stable security definer
set search_path to ''
as $$
  select coalesce(jsonb_agg(x order by (x->>'fecha') desc), '[]'::jsonb)
    from (
      -- Quien respondió a una solicitud mía de insumos.
      select jsonb_build_object(
               'tipo',  'respuesta',
               'texto', 'Alguien respondió a ' || s.codigo,
               'fecha', r.creada_at,
               'href',  '/mis-solicitudes'
             ) as x
        from public.respuestas r
        join public.solicitudes s on s.id = r.solicitud_id
       where s.perfil_id = auth.uid()

      union all

      -- Quien respondió a un pedido de servicio mío.
      select jsonb_build_object(
               'tipo',  'respuesta',
               'texto', 'Alguien respondió a ' || ss.codigo,
               'fecha', rs.creada_at,
               'href',  '/mis-solicitudes'
             )
        from public.respuestas_servicio rs
        join public.solicitudes_servicio ss on ss.id = rs.solicitud_id
       where ss.perfil_id = auth.uid()
    ) t;
$$;

-- Mis respuestas: sin `flujo` ni `tiene_hilo`, que eran del acompañamiento.
create or replace function public.mis_respuestas()
returns jsonb
language sql stable security definer
set search_path to ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',           r.id,
           'mensaje',      r.mensaje,
           'creada_at',    r.creada_at,
           'codigo',       s.codigo,
           'municipio',    m.nombre,
           'barrio',       s.barrio,
           'categoria',    s.categoria,
           'expira_at',    s.expira_at,
           'num_respuestas', (select count(*) from public.respuestas rr
                               where rr.solicitud_id = s.id)
         ) order by r.creada_at desc), '[]'::jsonb)
    from public.respuestas r
    join public.solicitudes s on s.id = r.solicitud_id
    join public.municipios m  on m.codigo_dane = s.municipio
   where r.autor_id = auth.uid();
$$;

-- El push de una solicitud: se identificaba por token, y ya no hay token.
drop function if exists public.guardar_push(text, text, text, text);

create or replace function public.guardar_push(
  p_solicitud_id uuid, p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer
set search_path to ''
as $$
begin
  -- El dueño, comprobado aquí: sin esto cualquiera podría suscribirse a
  -- los avisos de la solicitud de otro sabiendo su id.
  if not exists (select 1 from public.solicitudes s
                  where s.id = p_solicitud_id and s.perfil_id = auth.uid()) then
    raise exception 'Esa solicitud no es tuya';
  end if;

  insert into public.push_suscripciones (solicitud_id, endpoint, p256dh, auth_key)
  values (p_solicitud_id, p_endpoint, p_p256dh, p_auth)
  on conflict (solicitud_id, endpoint) do nothing;
end;
$$;

grant execute on function public.guardar_push(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3 · Las tablas
-- ---------------------------------------------------------------------
--
-- `entregas` sobrevive y cambia de dueño conceptual: era la entrega
-- coordinada de una conversación, pasa a ser lo que entra y sale de un
-- centro de acopio (ADR 0008).

alter table public.entregas drop column if exists conversacion_id;

-- De dónde vino lo que llegó. Sin llave foránea y a propósito, por lo mismo
-- que `solicitud_codigo` va en texto: la publicación se borra y la entrega
-- tiene que sobrevivirla sin arrastrar datos personales.
alter table public.entregas
  add column if not exists origen_tipo text
    check (origen_tipo in ('muro', 'producto', 'directo'));

comment on column public.entregas.origen_tipo is
  'De dónde salió lo que llegó al acopio. Sin FK: la publicación se borra y esta fila la sobrevive, igual que `solicitud_codigo` (regla de producto 3).';

-- Dos vistas dependen de las columnas del acompañamiento y hay que
-- rehacerlas antes de quitarlas. `solicitudes_publicas` además contaba las
-- conversaciones como respuestas: sin hilos, las respuestas son las
-- respuestas.
drop view if exists public.v_cruces cascade;
drop view if exists public.solicitudes_publicas cascade;

create view public.solicitudes_publicas as
select
  s.id, s.codigo, s.municipio,
  m.nombre || ', ' || m.departamento as municipio_nombre,
  s.barrio, s.categoria, s.nota, s.creada_at, s.confirmada_at, s.expira_at,
  extract(epoch from now() - s.confirmada_at) / 3600::numeric as horas_sin_confirmar,
  (select count(*) from public.respuestas r where r.solicitud_id = s.id) as num_respuestas,
  (select coalesce(jsonb_agg(jsonb_build_object(
            'nombre', coalesce(c.nombre, sg.nombre_propuesto),
            'cantidad', si.cantidad,
            'unidad', coalesce(c.unidad, sg.unidad_sugerida, 'unidad'),
            'por_confirmar', si.sugerencia_id is not null)
          order by coalesce(c.orden, 9999)), '[]'::jsonb)
     from public.solicitud_items si
     left join public.catalogo_items c on c.id = si.item_id
     left join public.sugerencias_item sg on sg.id = si.sugerencia_id
    where si.solicitud_id = s.id) as items,
  (select coalesce(array_agg(si.item_id) filter (where si.item_id is not null), '{}'::text[])
     from public.solicitud_items si where si.solicitud_id = s.id) as item_ids,
  (select coalesce(array_agg(si.sugerencia_id) filter (where si.sugerencia_id is not null), '{}'::uuid[])
     from public.solicitud_items si where si.solicitud_id = s.id) as sugerencia_ids,
  s.nota_admin
from public.solicitudes s
join public.municipios m on m.codigo_dane = s.municipio
where public.estado_activo(s.estado) and s.expira_at > now();

grant select on public.solicitudes_publicas to anon, authenticated;

create view public.v_cruces as
select
  s.id as solicitud_id, s.codigo, s.municipio,
  o.id as ofertador_id,
  count(*) as items_coincidentes,
  jsonb_agg(jsonb_build_object(
    'nombre', coalesce(c.nombre, sg.nombre_propuesto),
    'cantidad', si.cantidad,
    'unidad', coalesce(c.unidad, sg.unidad_sugerida, 'unidad'))
    order by coalesce(c.orden, 9999)) as detalle
from public.solicitud_items si
join public.solicitudes s on s.id = si.solicitud_id
join public.ofrecimientos ofr
  on (ofr.item_id is not null and ofr.item_id = si.item_id)
  or (ofr.sugerencia_id is not null and ofr.sugerencia_id = si.sugerencia_id)
join public.perfiles o on o.id = ofr.perfil_id
left join public.catalogo_items c on c.id = si.item_id
left join public.sugerencias_item sg on sg.id = si.sugerencia_id
where si.cubierto = false and ofr.disponible = true
  and public.estado_activo(s.estado) and s.expira_at > now()
  and s.municipio = any (o.municipios) and public.puede_ofrecer(o.id)
group by s.id, s.codigo, s.municipio, o.id;

-- El acompañamiento en `solicitudes`.
alter table public.solicitudes drop column if exists flujo;
alter table public.solicitudes drop column if exists acompanamiento_at;
alter table public.solicitudes drop column if exists organizacion_id;

drop table if exists public.accesos_identidad;
drop table if exists public.identidades;
drop table if exists public.mensajes;
drop table if exists public.conversaciones cascade;

-- ---------------------------------------------------------------------
-- 4 · El centro de acopio (ADR 0008)
-- ---------------------------------------------------------------------
--
-- `organizaciones` ya tenía `direccion_acopio` y `horario_acopio` desde que
-- se escribió: la tabla estaba pensada para esto. Le faltan el teléfono y
-- el punto del mapa.
--
-- ⚠ Sin casilla de consentimiento, a diferencia de un prestador (ADR 0004):
-- la dirección de una bodega no es el domicilio de una persona, así que no
-- hay una segunda finalidad que autorizar.

alter table public.organizaciones
  add column if not exists telefono text
    check (telefono is null or char_length(telefono) between 7 and 20);

alter table public.organizaciones
  add column if not exists latitud  numeric(9, 6);
alter table public.organizaciones
  add column if not exists longitud numeric(9, 6);

alter table public.organizaciones
  drop constraint if exists organizaciones_punto_completo;
alter table public.organizaciones
  add constraint organizaciones_punto_completo
  check (num_nonnulls(latitud, longitud) <> 1);

comment on constraint organizaciones_punto_completo on public.organizaciones is
  'Media coordenada no es un punto: o van las dos o no va ninguna.';

comment on table public.organizaciones is
  'Centros de acopio (ADR 0008). LAS CREA UN ADMIN, jamás se auto-registran: si la fila existe, alguien ya miró el certificado del RUES y el NIT.';

-- Una donación puede indicar dónde se entrega, en vez de acordar una
-- dirección por chat. Así quien dona no da la suya.
alter table public.publicaciones_muro
  add column if not exists acopio_id uuid
    references public.organizaciones(id) on delete set null;

comment on column public.publicaciones_muro.acopio_id is
  'Punto de entrega elegido. `SET NULL` y no CASCADE: que un centro cierre no puede borrar la donación de nadie.';

-- La lista pública de centros. Igual que el resto: la interfaz lee de la
-- vista, nunca de la tabla, y el filtro vive en un solo sitio.
create or replace view public.acopios_publicos as
select
  o.id, o.nombre, o.tipo, o.slug, o.municipios,
  o.direccion_acopio, o.horario_acopio, o.telefono,
  o.latitud, o.longitud
from public.organizaciones o
where o.activa;

grant select on public.acopios_publicos to anon, authenticated;

comment on view public.acopios_publicos is
  'Los centros de acopio que se pueden enseñar. El filtro de `activa` vive aquí y no en cada consulta: duplicado, un día una copia se olvida.';

-- El punto de entrega, en la vista del muro. Va al final por lo mismo que
-- las otras: `create or replace view` sabe añadir columnas ahí, pero no
-- insertarlas en medio.
create or replace view public.muro_publico as
select
  m.id, m.cara, m.categoria, m.titulo, m.detalle,
  m.municipio, mu.nombre as municipio_nombre,
  m.zona_id, z.nombre as zona_nombre,
  m.autor_nombre, m.creada_at,
  (select i.ruta from public.imagenes i
    where i.objeto_tipo = 'muro' and i.objeto_id = m.id and i.estado = 'aprobada'
    order by i.subida_at limit 1) as imagen,
  pp.id as proveedor_id,
  pp.telefono,
  coalesce(pp.telefono_verificado, false) as telefono_verificado,
  ac.nombre as acopio_nombre,
  ac.direccion_acopio as acopio_direccion
from public.publicaciones_muro m
join public.municipios mu on mu.codigo_dane = m.municipio
left join public.zonas z on z.id = m.zona_id
left join public.proveedores pr on pr.perfil_id = m.perfil_id
left join public.proveedores_publicos pp on pp.id = pr.id
left join public.acopios_publicos ac on ac.id = m.acopio_id
where m.estado = 'abierta'
  and (m.expira_at is null or m.expira_at > now());

grant select on public.muro_publico to anon, authenticated;

-- La bitácora, sin la mitad que se fue. `accesos_referencia` sigue vivo y
-- es mínimo legal 4: ese rastro sobrevive al dato.
create or replace function public.bitacora_accesos()
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  return coalesce((
    select jsonb_agg(x order by x->>'cuando' desc)
    from (
      select jsonb_build_object(
        'tipo',   'referencia',
        'rol',    a.rol_lector,
        'lector', left(a.lector_ref, 8),
        'organizacion', (
          select o.nombre
            from public.miembros_organizacion mo
            join public.organizaciones o on o.id = mo.organizacion_id
           where mo.perfil_id = a.leida_por
           limit 1),
        'motivo', a.motivo,
        'cuando', a.leida_at,
        'huerfano', a.referencia_id is null
      ) as x
      from public.accesos_referencia a
      order by a.leida_at desc
      limit 100
    ) s
  ), '[]'::jsonb);
end;
$$;
