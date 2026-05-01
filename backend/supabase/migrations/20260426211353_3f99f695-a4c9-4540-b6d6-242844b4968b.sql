
-- Función helper is_superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'superadmin'::app_role
  );
$$;

-- Tabla audit logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid NOT NULL,
  target_user_id uuid,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmins view audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (public.is_superadmin(auth.uid()));

CREATE POLICY "superadmins insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  WITH CHECK (public.is_superadmin(auth.uid()) AND admin_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON public.admin_audit_logs(target_user_id);

-- Profiles
CREATE POLICY "superadmins view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_superadmin(auth.uid()));

-- Account subscriptions
CREATE POLICY "superadmins view all subscriptions"
  ON public.account_subscriptions FOR SELECT
  USING (public.is_superadmin(auth.uid()));

CREATE POLICY "superadmins update all subscriptions"
  ON public.account_subscriptions FOR UPDATE
  USING (public.is_superadmin(auth.uid()));

-- Subscription events
CREATE POLICY "superadmins view all subscription events"
  ON public.subscription_events FOR SELECT
  USING (public.is_superadmin(auth.uid()));

CREATE POLICY "superadmins insert subscription events"
  ON public.subscription_events FOR INSERT
  WITH CHECK (public.is_superadmin(auth.uid()));

-- User roles
CREATE POLICY "superadmins view all user roles"
  ON public.user_roles FOR SELECT
  USING (public.is_superadmin(auth.uid()));
