-- ============================================
-- Tabla: projects (proyectos reales)
-- ============================================
CREATE TYPE public.project_status AS ENUM ('on_track', 'at_risk', 'over_budget', 'completed', 'cancelled');
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'in_review', 'done', 'blocked');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  status public.project_status NOT NULL DEFAULT 'on_track',
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  budget numeric NOT NULL DEFAULT 0,
  actual_cost numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PEN',
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view projects" ON public.projects FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "owners insert projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update projects" ON public.projects FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owners delete projects" ON public.projects FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_projects_owner ON public.projects(owner_id);
CREATE INDEX idx_projects_client ON public.projects(client_id);
CREATE INDEX idx_projects_quotation ON public.projects(quotation_id);

-- ============================================
-- Tabla: tasks (tareas vinculadas a proyectos)
-- ============================================
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  assignee_id uuid,
  assignee_name text,
  due_date date,
  blocks_project boolean NOT NULL DEFAULT false,
  blocked_since timestamptz,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view tasks" ON public.tasks FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "owners insert tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update tasks" ON public.tasks FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owners delete tasks" ON public.tasks FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: si una tarea pasa a 'blocked', registrar el momento
CREATE OR REPLACE FUNCTION public.track_task_blocked_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'blocked' AND (OLD.status IS DISTINCT FROM 'blocked' OR OLD.blocked_since IS NULL) THEN
    NEW.blocked_since = now();
  ELSIF NEW.status <> 'blocked' THEN
    NEW.blocked_since = NULL;
    NEW.blocks_project = false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER track_tasks_blocked
  BEFORE INSERT OR UPDATE OF status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.track_task_blocked_at();

CREATE INDEX idx_tasks_owner ON public.tasks(owner_id);
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);

-- ============================================
-- Tabla: client_interactions (historial CRM)
-- ============================================
CREATE TYPE public.interaction_type AS ENUM ('call', 'meeting', 'email', 'whatsapp', 'note', 'proposal_sent');

CREATE TABLE public.client_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  interaction_type public.interaction_type NOT NULL DEFAULT 'note',
  summary text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view interactions" ON public.client_interactions FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "owners insert interactions" ON public.client_interactions FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update interactions" ON public.client_interactions FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owners delete interactions" ON public.client_interactions FOR DELETE USING (auth.uid() = owner_id);

CREATE INDEX idx_interactions_client ON public.client_interactions(client_id);
CREATE INDEX idx_interactions_owner ON public.client_interactions(owner_id);

-- ============================================
-- Trigger: al insertar interacción, actualizar last_contact_at del cliente
-- ============================================
CREATE OR REPLACE FUNCTION public.update_client_last_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.clients
  SET last_contact_at = NEW.occurred_at,
      commercial_status = CASE
        WHEN commercial_status = 'no_followup' THEN 'pending'::commercial_status
        ELSE commercial_status
      END
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_interaction_update_client
  AFTER INSERT ON public.client_interactions
  FOR EACH ROW EXECUTE FUNCTION public.update_client_last_contact();