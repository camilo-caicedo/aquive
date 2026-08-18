-- Paridad TS <-> SQL del filtro de PII/contacto.
--
-- Mismo corpus que `src/lib/validacion.corpus.ts`. Comprueba que
-- `public.contiene_pii` y `public.contiene_contacto` dan el veredicto
-- esperado —el mismo que asegura `validacion.test.ts` del lado de TS—.
-- Si algún caso diverge, `raise exception` y la ejecución falla.
--
-- No vive en CI: no hay base en CI a propósito (regla 4, borrado duro, sin
-- PITR). Se corre a mano contra la base con:  psql -f pii-paridad.sql
--
-- Al agregar un caso aquí, replícalo idéntico en validacion.corpus.ts.

do $$
declare
  caso record;
  v_pii boolean;
  v_contacto boolean;
begin
  for caso in
    select * from (values
      -- texto, pii esperado, contacto esperado
      ('JUAN@GMAIL.COM',                          true,  true),
      ('mi correo es ana@x.co',                   true,  true),
      ('+57 300 123 4567',                        true,  true),
      ('300 123 4567',                            true,  true),
      ('placa 1234567',                           true,  true),
      ('cedula 1.234.567.890',                    true,  true),
      ('tallas 38, 40, 42',                       false, false),
      ('Necesito cobijas y agua para 3 personas', false, false),
      ('referencia 123456',                       false, false),
      ('wa.me/juan',                              false, true),
      ('escribeme por t.me/carlos',               false, true),
      ('instagram.com/ayuda',                     false, true),
      ('mi usuario es @x aqui',                   false, true),
      ('llamame tres uno cero dos',               false, true)
    ) as c(texto, pii, contacto)
  loop
    v_pii := public.contiene_pii(caso.texto);
    v_contacto := public.contiene_contacto(caso.texto);

    if v_pii is distinct from caso.pii then
      raise exception 'contiene_pii(%) dio % pero se esperaba %',
        caso.texto, v_pii, caso.pii;
    end if;

    if v_contacto is distinct from caso.contacto then
      raise exception 'contiene_contacto(%) dio % pero se esperaba %',
        caso.texto, v_contacto, caso.contacto;
    end if;
  end loop;

  raise notice 'Paridad OK: los 14 casos coinciden con validacion.corpus.ts';
end $$;
