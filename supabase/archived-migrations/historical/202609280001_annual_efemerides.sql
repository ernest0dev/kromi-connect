-- Annual, campaign-independent commemorative dates.
CREATE TABLE IF NOT EXISTS public.efemerides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  anio integer NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT efemerides_nombre_not_blank CHECK (length(btrim(nombre)) > 0),
  CONSTRAINT efemerides_anio_valid CHECK (anio BETWEEN 1 AND 9999),
  CONSTRAINT efemerides_dates_ordered CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT efemerides_dates_match_year CHECK (
    extract(year FROM fecha_inicio)::integer = anio
    AND extract(year FROM fecha_fin)::integer = anio
  )
);

CREATE INDEX IF NOT EXISTS idx_efemerides_anio_fecha
  ON public.efemerides (anio, fecha_inicio, fecha_fin);

ALTER TABLE public.efemerides ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.efemerides TO authenticated, service_role;

DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.efemerides;
CREATE POLICY "Permitir todo a usuarios autenticados"
  ON public.efemerides
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
