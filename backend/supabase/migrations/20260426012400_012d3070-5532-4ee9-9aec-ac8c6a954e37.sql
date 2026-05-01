
-- Recalcular el progreso del proyecto excluyendo canceladas
-- y contando bloqueadas como pendientes (no como done).
CREATE OR REPLACE FUNCTION public.recalc_project_progress(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count int;
  done_count int;
  new_progress int;
BEGIN
  SELECT
    COUNT(*) FILTER (
      WHERE node_type IN ('task','activity')
        AND status::text <> 'cancelled'
    ),
    COUNT(*) FILTER (
      WHERE node_type IN ('task','activity')
        AND status::text = 'done'
    )
  INTO total_count, done_count
  FROM public.tasks
  WHERE project_id = _project_id;

  IF total_count = 0 THEN
    new_progress := 0;
  ELSE
    new_progress := ROUND((done_count::numeric / total_count::numeric) * 100);
  END IF;

  UPDATE public.projects
  SET progress = new_progress,
      updated_at = now()
  WHERE id = _project_id;
END;
$$;

-- Recalcular para todos los proyectos existentes (one-shot)
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT id FROM public.projects LOOP
    PERFORM public.recalc_project_progress(p.id);
  END LOOP;
END$$;
