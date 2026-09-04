-- =====================================================================
-- v6 · Fase F · 6 — `push_avisos` vuelve a ser `push_ofertadores`
--
-- No es un cambio de diseño: es deshacer un renombrado que nunca debió
-- pasar, y dejarlo escrito para que se pueda repetir.
--
-- Qué se encontró, el 3 de septiembre de 2026:
--
--   · En la base de PRUEBAS la tabla se llama `push_avisos`.
--   · En PRODUCCIÓN se llama `push_ofertadores` — comprobado.
--   · El repositorio entero dice `push_ofertadores`, empezando por
--     `src/server/avisos/push.ts`.
--   · Ninguna migración de esta carpeta la renombra. Y en pruebas, la
--     llave foránea y el `unique` **siguen llamándose**
--     `push_ofertadores_perfil_id_fkey` y
--     `push_ofertadores_perfil_id_endpoint_key`.
--
-- Esa última pista es la que cierra el caso: `ALTER TABLE ... RENAME`
-- cambia el nombre de la tabla y deja los de sus restricciones intactos.
-- Alguien lo corrió a mano contra pruebas y no lo guardó en ninguna parte.
--
-- La consecuencia era que la aplicación **entera** no arrancaba contra
-- pruebas: `push.ts` cuelga de `hilo.ts`, que cuelga del `Encabezado`, que
-- vive en el layout raíz. Un nombre de tabla distinto y no responde ni la
-- portada.
--
-- ⚠ Se corrige la BASE, no el código. El código coincide con producción, y
-- renombrar al revés —tocar `push.ts` para que dijera `push_avisos`— habría
-- arreglado pruebas rompiendo lo que funciona.
--
-- Y el nombre, para cuando alguien lo lea sin este contexto: la tabla
-- guarda suscripciones de Web Push de TODA la cuenta, no solo de quien
-- ofrecía insumos. El nombre engaña —por eso alguien intentó cambiarlo— y
-- el ADR 0016 estuvo a punto de borrarla creyendo que era del módulo
-- retirado. Renombrarla bien es una tarea legítima; lo que no vale es
-- hacerlo en una base y no en las otras dos.
--
-- Idempotente: si ya se llama como debe, no hace nada.
-- =====================================================================

do $$
begin
  if exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'push_avisos'
  ) and not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'push_ofertadores'
  ) then
    alter table public.push_avisos rename to push_ofertadores;
  end if;
end
$$;
