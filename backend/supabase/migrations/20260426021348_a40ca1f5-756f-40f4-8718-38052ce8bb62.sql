-- Refactor de métrica de avance: pesos (story points) + ponderación real
-- Solo nodos hoja contables (task/activity), canceladas excluidas.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS weight integer NOT NULL DEFAULT 1
    CHECK (weight >= 1 AND weight <= 100);

COMMENT ON COLUMN public.tasks.weight IS
  'Peso/Story points de la tarea para el cálculo de avance ponderado. Default 1.';

-- Backfill por prioridad para tareas existentes con weight = 1
UPDATE public.tasks
SET weight = CASE priority::text
  WHEN 'low' THEN 1
  WHEN 'medium' THEN 3
  WHEN 'high' THEN 8
  WHEN 'critical' THEN 13
  ELSE 1
END
WHERE weight = 1
  AND node_type::text IN ('task','activity');

-- Refactorizar recalc_project_progress para usar pesos
CREATE OR REPLACE FUNCTION public.recalc_project_progress(_project_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_weight numeric;
  done_weight numeric;
  new_progress int;
BEGIN
  -- Solo hojas reales (task/activity), excluyendo canceladas.
  -- Contenedores (epic/story/phase/subphase) NO cuentan: son agrupadores.
  SELECT
    COALESCE(SUM(weight) FILTER (
      WHERE node_type::text IN ('task','activity')
        AND status::text <> 'cancelled'
    ), 0),
    COALESCE(SUM(weight) FILTER (
      WHERE node_type::text IN ('task','activity')
        AND status::text = 'done'
    ), 0)
  INTO total_weight, done_weight
  FROM public.tasks
  WHERE project_id = _project_id;

  IF total_weight = 0 THEN
    new_progress := 0;
  ELSE
    new_progress := ROUND((done_weight / total_weight) * 100);
  END IF;

  UPDATE public.projects
  SET progress = new_progress,
      updated_at = now()
  WHERE id = _project_id;
END;
$function$;

-- Recalcular todos los proyectos con la nueva fórmula ponderada
DO $$
DECLARE
  pid uuid;
BEGIN
  FOR pid IN SELECT id FROM public.projects LOOP
    PERFORM public.recalc_project_progress(pid);
  END LOOP;
END $$;