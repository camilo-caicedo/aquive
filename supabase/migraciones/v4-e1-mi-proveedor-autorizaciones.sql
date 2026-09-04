-- v4-e1 · `mi_proveedor` devuelve las autorizaciones que la persona dio.
--
-- La pantalla 25 del prototipo —«Privacidad y cuenta»— tiene un bloque
-- «Autorizaciones que diste» con nombre, versión y fecha. Es habeas data
-- puro: el artículo 9 de la Ley 1581 exige autorización previa e informada,
-- y el día que alguien pregunte QUÉ autorizó y CUÁNDO, la respuesta tiene que
-- ser la fila, no una constante del código.
--
-- Hoy la pantalla enseña la versión desde `AUTORIZACION_PROVEEDOR_VERSION` y
-- la fecha como «publicada desde el creado_at». Las dos son aproximaciones:
-- la constante es la versión de HOY, no la que esa persona aceptó, y la fecha
-- de creación no es la de la autorización.
--
-- `proveedores` está revocada entera para anon y authenticated, así que estas
-- cinco columnas no salen por ninguna otra puerta.
--
-- Idempotente: `create or replace` sobre la función que ya existe, añadiendo
-- cinco claves al objeto. Nada de lo que ya devolvía cambia.

create or replace function public.mi_proveedor(p_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.proveedor_del_llamante(p_token);
  v_out jsonb;
begin
  if v_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', p.id,
    'nombre_visible', p.nombre_visible,
    'tipo', p.tipo,
    'telefono', p.telefono,
    'telefono_verificado', p.telefono_verificado,
    'municipio', p.municipio,
    'zona_id', p.zona_id,
    'zona_texto', p.zona_texto,
    'modalidad', p.modalidad,
    'dias', p.dias,
    'franjas', p.franjas,
    'medios_pago', p.medios_pago,
    'descripcion', p.descripcion,
    'suspendido', p.suspendido,
    'alta_asistida', p.alta_asistida,
    'sin_cuenta', p.perfil_id is null,
    'creado_at', p.creado_at,
    -- Lo que se añade en v4-e1. La versión y la fecha son las que ESA persona
    -- aceptó, no las de hoy.
    'autorizacion_version', p.autorizacion_version,
    'autorizacion_at', p.autorizacion_at,
    'acepto_mapa', p.acepto_mapa,
    'mapa_version', p.mapa_version,
    'mapa_at', p.mapa_at,
    'oficios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'oficio_id', po.oficio_id,
               'nombre', c.nombre,
               'grupo', c.grupo,
               'riesgo', c.riesgo,
               'modo', po.modo,
               'precio_desde', po.precio_desde,
               'unidad', po.unidad,
               'publicado', (c.riesgo <> 'alto')
                 or (p.telefono_verificado and exists (
                       select 1 from public.referencias r
                        where r.proveedor_id = p.id and r.estado = 'confirmada'))
               ) order by c.orden)
      from public.proveedor_oficios po
      join public.catalogo_oficios c on c.id = po.oficio_id
      where po.proveedor_id = p.id), '[]'::jsonb),
    'referencias_confirmadas', (
      select count(*) from public.referencias r
       where r.proveedor_id = p.id and r.estado = 'confirmada'),
    'servicios_confirmados', (
      select count(*) from public.servicios_prestados s
       where s.proveedor_id = p.id and s.confirmado_at is not null)
  )
  into v_out
  from public.proveedores p
  where p.id = v_id;

  return v_out;
end;
$$;

grant execute on function public.mi_proveedor(text) to anon, authenticated;

comment on function public.mi_proveedor(text) is
  'La ficha propia, para quien tiene cuenta o token. Devuelve las autorizaciones con su versión y su fecha desde v4-e1: la pantalla de privacidad tiene que decir qué se aceptó y cuándo, no la versión de hoy.';
