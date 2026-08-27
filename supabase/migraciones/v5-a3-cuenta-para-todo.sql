-- ---------------------------------------------------------------------
-- Cuenta para todo (ADR 0006)
-- ---------------------------------------------------------------------
--
-- Una sola manera de ser dueño de algo: `perfil_id`. Desaparecen los
-- tokens portadores de las tres tablas donde se publicaba sin cuenta, y el
-- de las fichas de prestador.
--
-- ⚠ ANTES de correr esto hay que haber migrado los prestadores que tenían
-- token, con `scripts/migrar-proveedores-a-cuentas.mjs`. Si no, la última
-- parte falla — y falla bien: son personas de verdad con su ficha
-- publicada, y la alternativa a migrarlas sería borrarlas.
--
-- ⚠ `pqr` NO se toca. Es el canal de habeas data (Ley 1581, arts. 14 y 15)
-- y condicionarlo a tener cuenta lo haría inejercible: parte de quien
-- reclama lo hace justamente porque quiere dejar de estar aquí.

-- ---------------------------------------------------------------------
-- 1 · Solicitudes de servicio
-- ---------------------------------------------------------------------

alter table public.solicitudes_servicio
  add column if not exists perfil_id uuid references public.perfiles(id) on delete cascade;

-- Las que quedaron sin dueño se van. Decisión del responsable: no hay a
-- quién asociarlas, porque esas personas no dieron un solo dato — que era
-- justamente el punto del modelo anterior.
delete from public.solicitudes_servicio where perfil_id is null;

alter table public.solicitudes_servicio alter column perfil_id set not null;
alter table public.solicitudes_servicio drop column if exists token_hash;

create index if not exists idx_solicitudes_servicio_perfil
  on public.solicitudes_servicio(perfil_id);

-- ---------------------------------------------------------------------
-- 2 · El muro
-- ---------------------------------------------------------------------

delete from public.publicaciones_muro where perfil_id is null;

alter table public.publicaciones_muro alter column perfil_id set not null;
alter table public.publicaciones_muro drop column if exists token_hash;

-- El CHECK que sostenía la asimetría de las dos caras ya no aplica: las
-- dos tienen dueño y las dos son una cuenta.
alter table public.publicaciones_muro
  drop constraint if exists publicaciones_muro_ofrece_con_nombre;
alter table public.publicaciones_muro
  drop constraint if exists publicaciones_muro_necesita_con_token;

create index if not exists idx_muro_perfil on public.publicaciones_muro(perfil_id);

-- ---------------------------------------------------------------------
-- 3 · Solicitudes de insumos
-- ---------------------------------------------------------------------

alter table public.solicitudes
  add column if not exists perfil_id uuid references public.perfiles(id) on delete cascade;

delete from public.solicitudes where perfil_id is null;

alter table public.solicitudes alter column perfil_id set not null;
alter table public.solicitudes drop column if exists token_hash;

create index if not exists idx_solicitudes_perfil on public.solicitudes(perfil_id);

-- ---------------------------------------------------------------------
-- 4 · Las fichas de prestador
-- ---------------------------------------------------------------------
--
-- El `check (num_nonnulls(perfil_id, token_hash) = 1)` existía para que una
-- ficha no tuviera dos dueños ni ninguno. Con una sola manera de ser dueño,
-- lo que hace falta es más simple: que `perfil_id` esté.

alter table public.proveedores drop constraint if exists proveedores_tiene_dueno;
alter table public.proveedores alter column perfil_id set not null;
alter table public.proveedores drop column if exists token_hash;

comment on column public.proveedores.perfil_id is
  'El dueño de la ficha, y el único (ADR 0006). Quien no tiene cuenta de Google recibe la suya de un admin: ver `codigos_acceso`.';
