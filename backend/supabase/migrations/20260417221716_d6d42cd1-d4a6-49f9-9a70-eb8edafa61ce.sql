-- Enum para tipo de nodo en jerarquía de planificación
CREATE TYPE public.task_node_type AS ENUM (
  'epic',         -- Ágil: Épica
  'story',        -- Ágil: Historia de Usuario
  'task',         -- Ágil: Tarea (default — compatible con datos existentes)
  'phase',        -- Tradicional: Fase
  'subphase',     -- Tradicional: Subfase
  'activity'      -- Tradicional: Actividad
);

-- Enum para modo de planificación del proyecto
CREATE TYPE public.planning_mode AS ENUM ('agile', 'traditional');

-- Agregar campos a tasks
ALTER TABLE public.tasks
  ADD COLUMN node_type public.task_node_type NOT NULL DEFAULT 'task',
  ADD COLUMN parent_id uuid NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  ADD COLUMN start_date date NULL;

CREATE INDEX idx_tasks_parent_id ON public.tasks(parent_id);
CREATE INDEX idx_tasks_project_node ON public.tasks(project_id, node_type);
CREATE INDEX idx_tasks_dates ON public.tasks(project_id, start_date, due_date);

-- Agregar modo de planificación a projects
ALTER TABLE public.projects
  ADD COLUMN planning_mode public.planning_mode NOT NULL DEFAULT 'agile';