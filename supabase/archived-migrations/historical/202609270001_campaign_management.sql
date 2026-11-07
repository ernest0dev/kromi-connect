-- Align the campaigns table with the campaign management UI.
-- Existing rows are preserved; legacy rows receive a default category/status.

ALTER TABLE public.campanas
  ADD COLUMN IF NOT EXISTS tipo_campana public.tipo_campana_enum NOT NULL DEFAULT 'TEMPORADA',
  ADD COLUMN IF NOT EXISTS descripcion text,
  ADD COLUMN IF NOT EXISTS presupuesto numeric(12, 2),
  ADD COLUMN IF NOT EXISTS estatus text NOT NULL DEFAULT 'PLANIFICADA';

UPDATE public.campanas
SET estatus = CASE
  WHEN estatus NOT IN ('PLANIFICADA', 'ACTIVA', 'FINALIZADA') THEN
    CASE WHEN activo IS FALSE THEN 'FINALIZADA' ELSE 'PLANIFICADA' END
  ELSE estatus
END;

UPDATE public.campanas
SET activo = estatus <> 'FINALIZADA'
WHERE activo IS DISTINCT FROM (estatus <> 'FINALIZADA');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.campanas'::regclass
      AND conname = 'campanas_estatus_check'
  ) THEN
    ALTER TABLE public.campanas
      ADD CONSTRAINT campanas_estatus_check
      CHECK (estatus IN ('PLANIFICADA', 'ACTIVA', 'FINALIZADA'));
  END IF;
END;
$$;

ALTER TABLE public.campanas
  ALTER COLUMN presupuesto SET DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_publicaciones_campana_fecha
  ON public.publicaciones (campana_id, fecha_publicacion);

CREATE INDEX IF NOT EXISTS idx_campana_evaluaciones_latest
  ON public.campana_evaluaciones (campana_id, created_at DESC);
