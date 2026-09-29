-- Many-to-many links between EFEMERIDE campaigns and annual occurrences.
CREATE TABLE IF NOT EXISTS public.campana_efemerides (
  campana_id uuid NOT NULL REFERENCES public.campanas(id) ON DELETE CASCADE,
  efemeride_id uuid NOT NULL REFERENCES public.efemerides(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campana_id, efemeride_id)
);

CREATE INDEX IF NOT EXISTS idx_campana_efemerides_efemeride
  ON public.campana_efemerides (efemeride_id, campana_id);

ALTER TABLE public.campana_efemerides ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campana_efemerides TO authenticated, service_role;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.campana_efemerides;
CREATE POLICY "Permitir todo a usuarios autenticados"
  ON public.campana_efemerides
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.validate_campaign_efemeride_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  campaign public.campanas%ROWTYPE;
  efemeride public.efemerides%ROWTYPE;
BEGIN
  SELECT * INTO campaign FROM public.campanas WHERE id = NEW.campana_id;
  SELECT * INTO efemeride FROM public.efemerides WHERE id = NEW.efemeride_id;
  IF campaign.id IS NULL OR efemeride.id IS NULL THEN
    RAISE EXCEPTION 'La campaña o la efeméride indicada no existe.';
  END IF;
  IF campaign.tipo_campana <> 'EFEMERIDE' THEN
    RAISE EXCEPTION 'Solo las campañas de tipo EFEMERIDE pueden vincular efemérides.';
  END IF;
  IF efemeride.anio < extract(year FROM campaign.fecha_inicio)::integer
     OR efemeride.anio > extract(year FROM campaign.fecha_fin)::integer THEN
    RAISE EXCEPTION 'La efeméride debe pertenecer a uno de los años que abarca la campaña.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_campaign_efemeride_link ON public.campana_efemerides;
CREATE TRIGGER trg_validate_campaign_efemeride_link
BEFORE INSERT OR UPDATE ON public.campana_efemerides
FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_efemeride_link();

CREATE OR REPLACE FUNCTION public.validate_campaign_efemeride_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.campana_efemerides link
    JOIN public.efemerides e ON e.id = link.efemeride_id
    WHERE link.campana_id = NEW.id
      AND (
        NEW.tipo_campana <> 'EFEMERIDE'
        OR e.anio < extract(year FROM NEW.fecha_inicio)::integer
        OR e.anio > extract(year FROM NEW.fecha_fin)::integer
      )
  ) THEN
    RAISE EXCEPTION 'Resuelve los vínculos de efemérides incompatibles antes de cambiar categoría o fechas.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_campaign_efemeride_change ON public.campanas;
CREATE TRIGGER trg_validate_campaign_efemeride_change
BEFORE UPDATE OF tipo_campana, fecha_inicio, fecha_fin ON public.campanas
FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_efemeride_change();

CREATE OR REPLACE FUNCTION public.validate_efemeride_year_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.anio IS DISTINCT FROM OLD.anio AND EXISTS (
    SELECT 1
    FROM public.campana_efemerides link
    JOIN public.campanas c ON c.id = link.campana_id
    WHERE link.efemeride_id = OLD.id
      AND (NEW.anio < extract(year FROM c.fecha_inicio)::integer
           OR NEW.anio > extract(year FROM c.fecha_fin)::integer)
  ) THEN
    RAISE EXCEPTION 'No se puede cambiar el año: la efeméride está vinculada a campañas que no abarcan ese año.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_efemeride_year_change ON public.efemerides;
CREATE TRIGGER trg_validate_efemeride_year_change
BEFORE UPDATE OF anio ON public.efemerides
FOR EACH ROW EXECUTE FUNCTION public.validate_efemeride_year_change();

CREATE OR REPLACE FUNCTION public.save_campaign_with_efemerides(
  p_campana_id uuid,
  p_nombre text,
  p_descripcion text,
  p_tipo_campana public.tipo_campana_enum,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_presupuesto numeric,
  p_efemeride_ids uuid[],
  p_confirmar_desvinculacion boolean
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  saved_id uuid;
  requested_ids uuid[] := COALESCE(p_efemeride_ids, ARRAY[]::uuid[]);
  requested_count integer;
  matching_count integer;
BEGIN
  IF p_tipo_campana <> 'EFEMERIDE' AND cardinality(requested_ids) > 0 THEN
    RAISE EXCEPTION 'Solo las campañas de tipo EFEMERIDE pueden vincular efemérides.';
  END IF;
  IF p_tipo_campana = 'EFEMERIDE' AND cardinality(requested_ids) > 0 THEN
    SELECT count(DISTINCT requested.efemeride_id) INTO requested_count
    FROM unnest(requested_ids) AS requested(efemeride_id);
    SELECT count(*) INTO matching_count
    FROM public.efemerides e
    WHERE e.id = ANY(requested_ids)
      AND e.anio BETWEEN extract(year FROM p_fecha_inicio)::integer
                     AND extract(year FROM p_fecha_fin)::integer;
    IF requested_count <> cardinality(requested_ids) OR matching_count <> requested_count THEN
      RAISE EXCEPTION 'Hay efemérides duplicadas, inexistentes o fuera de los años de la campaña.';
    END IF;
  END IF;

  IF p_campana_id IS NULL THEN
    INSERT INTO public.campanas (nombre, descripcion, tipo_campana, fecha_inicio, fecha_fin, presupuesto, estatus, activo)
    VALUES (btrim(p_nombre), NULLIF(btrim(COALESCE(p_descripcion, '')), ''), p_tipo_campana,
            p_fecha_inicio, p_fecha_fin, p_presupuesto, 'PLANIFICADA', true)
    RETURNING id INTO saved_id;
  ELSE
    IF p_tipo_campana <> 'EFEMERIDE'
       AND NOT COALESCE(p_confirmar_desvinculacion, false)
       AND EXISTS (SELECT 1 FROM public.campana_efemerides WHERE campana_id = p_campana_id) THEN
      RAISE EXCEPTION 'Confirma que deseas cambiar la categoría y desvincular sus efemérides.';
    END IF;
    DELETE FROM public.campana_efemerides WHERE campana_id = p_campana_id;
    UPDATE public.campanas
    SET nombre = btrim(p_nombre),
        descripcion = NULLIF(btrim(COALESCE(p_descripcion, '')), ''),
        tipo_campana = p_tipo_campana,
        fecha_inicio = p_fecha_inicio,
        fecha_fin = p_fecha_fin,
        presupuesto = p_presupuesto
    WHERE id = p_campana_id
    RETURNING id INTO saved_id;
    IF saved_id IS NULL THEN
      RAISE EXCEPTION 'No se encontró la campaña que se intenta editar.';
    END IF;
  END IF;

  INSERT INTO public.campana_efemerides (campana_id, efemeride_id)
  SELECT saved_id, e.id
  FROM public.efemerides e
  WHERE e.id = ANY(requested_ids);

  RETURN saved_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_campaign_with_efemerides(uuid, text, text, public.tipo_campana_enum, date, date, numeric, uuid[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_campaign_with_efemerides(uuid, text, text, public.tipo_campana_enum, date, date, numeric, uuid[], boolean) TO service_role;

NOTIFY pgrst, 'reload schema';
