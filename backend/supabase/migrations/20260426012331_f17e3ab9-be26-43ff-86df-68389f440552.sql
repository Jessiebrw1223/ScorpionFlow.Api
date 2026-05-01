
-- 1) Agregar 'cancelled' al enum task_status (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'cancelled'
      AND enumtypid = 'public.task_status'::regtype
  ) THEN
    ALTER TYPE public.task_status ADD VALUE 'cancelled';
  END IF;
END$$;

-- 2) Columna blocked_reason (catálogo libre validado en app)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS blocked_reason text;
