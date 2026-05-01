-- Tabla de configuración de negocio por usuario
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'PEN',
  cost_model TEXT NOT NULL DEFAULT 'mixed',
  target_margin NUMERIC NOT NULL DEFAULT 20,
  auto_alerts JSONB NOT NULL DEFAULT '{"budgetOver80": true, "marginBelow15": true, "projectInLoss": true}'::jsonb,
  auto_behavior JSONB NOT NULL DEFAULT '{"autoCostFromResources": true, "autoProgressFromTasks": true, "inferSchedule": false}'::jsonb,
  alerts JSONB NOT NULL DEFAULT '{"losingMoney": true, "criticalDelays": true, "budgetExceeded": true, "blockingTask": true}'::jsonb,
  channel TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_settings"
  ON public.user_settings FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();