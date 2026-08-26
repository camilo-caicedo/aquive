-- ---------------------------------------------------------------------
-- «Hecho en el barrio»: contacto y filtros
-- ---------------------------------------------------------------------
--
-- La lista de productos ya existía, pero solo se podía mirar: no decía a
-- quién escribirle ni dejaba acotar por nada. Dos añadidos a la vista.
--
-- 1 · `telefono` y `telefono_verificado`. NO es publicar un dato nuevo: el
--     teléfono ya sale en la ficha de esa misma persona, que es quien lo
--     publicó y firmó su autorización. Aquí se lee del mismo sitio —de
--     `proveedores_publicos`— para que las dos reglas que esa vista aplica
--     sigan aplicando sin copiarlas: la suspensión y el consentimiento. Si
--     el filtro se duplicara en cada consulta, un día una copia se olvida.
--
-- 2 · `grupos`, para poder acotar la lista por familia de oficio: quien
--     busca comida no quiere ver herramientas. Sale también de la ficha,
--     que es donde están declarados.
--
-- El orden es por fecha descendente en la aplicación, no aquí: la vista no
-- ordena para que quien la consulte elija.

create or replace view public.productos_publicos as
select
  p.id, p.proveedor_id, pp.nombre_visible as proveedor_nombre,
  pp.municipio, pp.zona_nombre,
  p.nombre, p.detalle, p.modo, p.precio_desde, p.unidad, p.creado_at,
  (select i.ruta from public.imagenes i
    where i.objeto_tipo = 'producto' and i.objeto_id = p.id and i.estado = 'aprobada'
    order by i.subida_at limit 1) as imagen,
  -- ⚠ Al FINAL y no donde quedarían bonitas: `create or replace view` sabe
  -- añadir columnas al final, pero no insertarlas en medio ni renombrarlas.
  -- Meterlas arriba obligaría a un `drop view ... cascade`, y de esta vista
  -- cuelgan otras.
  pp.telefono, pp.telefono_verificado, pp.grupos
from public.productos p
join public.proveedores_publicos pp on pp.id = p.proveedor_id
where p.disponible;

grant select on public.productos_publicos to anon, authenticated;

comment on view public.productos_publicos is
  'Hecho en el barrio. Cuelga de `proveedores_publicos`, así que hereda de ella la suspensión y el consentimiento: quien no aparece en el directorio no aparece aquí. El teléfono es el mismo de su ficha, no uno nuevo.';
