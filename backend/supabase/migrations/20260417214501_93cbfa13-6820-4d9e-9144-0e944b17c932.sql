-- Tipo enum para el "Impacto" de la tarea en el negocio
DO $$ BEGIN
  CREATE TYPE public.task_impact AS ENUM ('time', 'cost', 'delivery');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Añadir columna impact a tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS impact public.task_impact NOT NULL DEFAULT 'delivery';
