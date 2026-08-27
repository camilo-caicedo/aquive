-- ---------------------------------------------------------------------
-- El muro: por dónde se contacta a quien ofrece
-- ---------------------------------------------------------------------
--
-- Una donación se podía leer y nada más. La pantalla decía «se acuerda por
-- chat» y ese chat no existe para el muro —el chat vive y muere con un
-- pedido de servicio, regla de producto 2—, así que no había ninguna
-- manera de responder a nadie.
--
-- Se añade el enlace a la ficha de quien ofrece, cuando la tiene, y su
-- teléfono. Tres cosas que conviene tener claras:
--
-- 1 · Solo la cara que OFRECE. Quien pide no tiene perfil ni nombre en la
--     tabla —regla de producto 4— y aquí sale en NULL sin que haya que
--     acordarse de filtrarlo.
--
-- 2 · El teléfono NO es un dato nuevo: es el de su ficha de prestador, que
--     esa persona publicó. Sale de `proveedores_publicos`, así que hereda
--     su suspensión y su consentimiento: si no aparece en el directorio,
--     tampoco aquí.
--
-- 3 · Quien ofrece en el muro y NO tiene ficha se queda sin teléfono, y
--     eso es correcto: su autorización del muro cubre el nombre, no el
--     contacto. La pantalla lo dice en vez de dejar un botón muerto.
--
-- ⚠ Las columnas van al final. `create or replace view` sabe añadirlas ahí,
-- pero no insertarlas en medio ni renombrar las que ya están.

create or replace view public.muro_publico as
select
  m.id, m.cara, m.categoria, m.titulo, m.detalle,
  m.municipio, mu.nombre as municipio_nombre,
  m.zona_id, z.nombre as zona_nombre,
  -- Solo la cara que ofrece tiene nombre. La otra no lo tiene ni en la tabla.
  m.autor_nombre, m.creada_at,
  (select i.ruta from public.imagenes i
    where i.objeto_tipo = 'muro' and i.objeto_id = m.id and i.estado = 'aprobada'
    order by i.subida_at limit 1) as imagen,
  pp.id as proveedor_id,
  pp.telefono,
  coalesce(pp.telefono_verificado, false) as telefono_verificado
from public.publicaciones_muro m
join public.municipios mu on mu.codigo_dane = m.municipio
left join public.zonas z on z.id = m.zona_id
left join public.proveedores pr on pr.perfil_id = m.perfil_id
left join public.proveedores_publicos pp on pp.id = pr.id
where m.estado = 'abierta'
  and (m.expira_at is null or m.expira_at > now());

grant select on public.muro_publico to anon, authenticated;

comment on view public.muro_publico is
  'El muro, las dos caras. El contacto solo aparece para quien OFRECE y solo si tiene ficha de prestador: sale de `proveedores_publicos`, que es donde vive el consentimiento del teléfono. Quien pide no tiene ni nombre.';
