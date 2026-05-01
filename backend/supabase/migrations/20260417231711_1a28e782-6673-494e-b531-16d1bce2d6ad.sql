-- Tipo de recurso asignado
CREATE TYPE public.resource_kind AS ENUM ('human', 'tech', 'asset');
CREATE TYPE public.resource_unit AS ENUM ('hour', 'month', 'use', 'fixed');

CREATE TABLE public.project_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  kind public.resource_kind NOT NULL,
  name TEXT NOT NULL,
  role_or_type TEXT,
  unit public.resource_unit NOT NULL DEFAULT 'fixed',
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  quantity NUMERIC NOT NULL DEFAULT 1,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_resources_project ON public.project_resources(project_id);
CREATE INDEX idx_project_resources_kind ON public.project_resources(kind);

ALTER TABLE public.project_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view project resources"
ON public.project_resources FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "owners insert project resources"
ON public.project_resources FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owners update project resources"
ON public.project_resources FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "owners delete project resources"
ON public.project_resources FOR DELETE
USING (auth.uid() = owner_id);

-- Auto: total_cost = unit_cost * quantity
CREATE OR REPLACE FUNCTION public.compute_resource_total_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.total_cost := COALESCE(NEW.unit_cost, 0) * COALESCE(NEW.quantity, 0);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER project_resources_compute_total
BEFORE INSERT OR UPDATE OF unit_cost, quantity ON public.project_resources
FOR EACH ROW
EXECUTE FUNCTION public.compute_resource_total_cost();

-- Recalcular actual_cost del proyecto = suma de total_cost de recursos
CREATE OR REPLACE FUNCTION public.recalc_project_actual_cost(_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  resource_total NUMERIC;
  task_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(total_cost), 0) INTO resource_total
  FROM public.project_resources
  WHERE project_id = _project_id AND status = 'active';

  SELECT COALESCE(SUM(actual_cost), 0) INTO task_total
  FROM public.tasks
  WHERE project_id = _project_id;

  UPDATE public.projects
  SET actual_cost = resource_total + task_total,
      updated_at = now()
  WHERE id = _project_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_recalc_project_actual_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_project_actual_cost(OLD.project_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_project_actual_cost(NEW.project_id);
    IF TG_OP = 'UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id THEN
      PERFORM public.recalc_project_actual_cost(OLD.project_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER project_resources_recalc_actual
AFTER INSERT OR UPDATE OR DELETE ON public.project_resources
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recalc_project_actual_cost();

-- También recalcular actual_cost cuando cambian costos reales en tareas
CREATE OR REPLACE FUNCTION public.trigger_tasks_recalc_actual_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_project_actual_cost(OLD.project_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_project_actual_cost(NEW.project_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER tasks_recalc_actual_cost
AFTER INSERT OR UPDATE OF actual_cost OR DELETE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.trigger_tasks_recalc_actual_cost();