-- Keep archived campaigns and their related rows; preserve the previous status
-- so restoring a campaign returns it to its prior lifecycle state.

ALTER TABLE public.campanas
  ADD COLUMN IF NOT EXISTS estatus_pre_archivado text;

ALTER TABLE public.campanas
  DROP CONSTRAINT IF EXISTS campanas_estatus_check;

ALTER TABLE public.campanas
  ADD CONSTRAINT campanas_estatus_check
  CHECK (estatus IN ('PLANIFICADA', 'ACTIVA', 'FINALIZADA', 'ARCHIVADA'));

ALTER TABLE public.campanas
  DROP CONSTRAINT IF EXISTS campanas_estatus_pre_archivado_check;

ALTER TABLE public.campanas
  ADD CONSTRAINT campanas_estatus_pre_archivado_check
  CHECK (estatus_pre_archivado IS NULL OR estatus_pre_archivado IN ('PLANIFICADA', 'ACTIVA', 'FINALIZADA'));
