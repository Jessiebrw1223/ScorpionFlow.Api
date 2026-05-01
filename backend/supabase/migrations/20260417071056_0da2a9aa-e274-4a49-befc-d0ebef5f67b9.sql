-- 1. Ampliar enum client_type
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'industrial';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'tech';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'retail';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'healthcare';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'education';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'government';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'manufacturing';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'logistics';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE public.client_type ADD VALUE IF NOT EXISTS 'international';

-- 2. Enum estado comercial
DO $$ BEGIN
  CREATE TYPE public.commercial_status AS ENUM ('active', 'pending', 'no_followup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Ampliar tabla clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS commercial_status public.commercial_status NOT NULL DEFAULT 'pending';

-- 4. Ampliar tabla quotations
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS close_probability INTEGER NOT NULL DEFAULT 50 CHECK (close_probability >= 0 AND close_probability <= 100);

-- 5. Tipos de alerta
DO $$ BEGIN
  CREATE TYPE public.alert_type AS ENUM ('task_blocked', 'project_risk', 'client_no_followup', 'cost_overrun', 'resource_overload', 'quotation_stale', 'general');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.alert_severity AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Tabla notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  alert_type public.alert_type NOT NULL DEFAULT 'general',
  severity public.alert_severity NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  related_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

-- 7. Trigger para actualizar status_changed_at en quotations
CREATE OR REPLACE FUNCTION public.track_quotation_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_quotation_status_change ON public.quotations;
CREATE TRIGGER trg_quotation_status_change
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.track_quotation_status_change();