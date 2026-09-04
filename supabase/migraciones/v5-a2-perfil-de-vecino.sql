-- ---------------------------------------------------------------------
-- Un perfil que no publica nada (ADR 0006)
-- ---------------------------------------------------------------------
--
-- `perfiles` se escribió para quien OFRECE, y se le nota: exige
-- `contacto_publico` y sus tipos son 'ofertador', 'servidor' y 'aliado'.
--
-- Con cuenta para todo aparece un cuarto papel que antes no existía porque
-- no hacía falta: quien solo PIDE. Esa persona necesita cuenta para ser
-- dueña de su solicitud, pero **no publica nada** — ni nombre, ni teléfono,
-- ni ficha. Obligarla a dar un contacto público sería cambiar el precio de
-- pedir ayuda, y eso el ADR 0006 no lo decidió.
--
-- Así que entra 'vecino', y el contacto público pasa a ser opcional para él
-- igual que ya lo era para 'aliado'.

alter table public.perfiles
  drop constraint if exists perfiles_tipo_check;

alter table public.perfiles
  add constraint perfiles_tipo_check
  check (tipo in ('vecino', 'ofertador', 'servidor', 'aliado'));

alter table public.perfiles
  drop constraint if exists perfiles_contacto_publico_check;

-- Quien ofrece sigue obligado a dar un contacto: es lo que hace que se le
-- pueda responder. Quien no ofrece, no.
alter table public.perfiles
  add constraint perfiles_contacto_publico_check
  check (
    case
      when tipo in ('vecino', 'aliado')
        then contacto_publico is null
          or char_length(contacto_publico) between 7 and 40
      else char_length(contacto_publico) between 7 and 40
    end
  );

comment on column public.perfiles.tipo is
  'vecino = solo pide, no publica nada. ofertador y servidor = ofrece, y por eso su contacto es obligatorio. aliado = lleva un centro de acopio (ADR 0008).';
