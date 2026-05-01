-- 1. Costos por tarea
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS estimated_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_cost numeric NOT NULL DEFAULT 0;

-- 2. Recalcular progreso del proyecto basado en tareas (solo nodos hoja: task / activity)
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
    COUNT(*) FILTER (WHERE node_type IN ('task','activity')),
    COUNT(*) FILTER (WHERE node_type IN ('task','activity') AND status = 'done')
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

-- 3. Trigger que dispara recálculo en cada cambio de tarea
CREATE OR REPLACE FUNCTION public.trigger_recalc_project_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_project_progress(OLD.project_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_project_progress(NEW.project_id);
    -- Si cambió de proyecto (raro pero posible) recalcula el anterior también
    IF TG_OP = 'UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id THEN
      PERFORM public.recalc_project_progress(OLD.project_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS tasks_recalc_progress ON public.tasks;
CREATE TRIGGER tasks_recalc_progress
AFTER INSERT OR UPDATE OF status, node_type, project_id OR DELETE
ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recalc_project_progress();

-- 4. Recalcular para todos los proyectos existentes (one-shot)
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT id FROM public.projects LOOP
    PERFORM public.recalc_project_progress(p.id);
  END LOOP;
END$$;