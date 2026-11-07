-- Add the new internal task categories while keeping historic categories readable.
-- New UI options are IMPRESION, SONIDO_INTERNO, REPARACION and OTRO.
begin;

alter table public.pendientes_tienda
  drop constraint if exists pendientes_tienda_tipo_check;

alter table public.pendientes_tienda
  add constraint pendientes_tienda_tipo_check
  check (tipo in ('IMPRESION', 'SONIDO_INTERNO', 'REPARACION', 'OTRO', 'INSUMO', 'NECESIDAD'));

comment on column public.pendientes_tienda.enlace_referencia is
  'Legacy reference URL; new briefs and reference files are managed in the Google Drive brief folder.';

commit;
