
-- Enum para rol del miembro
CREATE TYPE public.team_role AS ENUM ('admin', 'collaborator', 'viewer');

-- Enum para estado de invitación
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'expired');

-- Enum para plan de suscripción
CREATE TYPE public.subscription_plan AS ENUM ('free', 'starter', 'pro', 'business');

-- Tabla de suscripciones (1 por usuario dueño)
CREATE TABLE public.account_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL UNIQUE,
  plan public.subscription_plan NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.account_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view own subscription"
ON public.account_subscriptions FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "owners insert own subscription"
ON public.account_subscriptions FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owners update own subscription"
ON public.account_subscriptions FOR UPDATE
USING (auth.uid() = owner_id);

CREATE TRIGGER trg_account_subscriptions_updated
BEFORE UPDATE ON public.account_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla de miembros del equipo
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  role public.team_role NOT NULL DEFAULT 'collaborator',
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view team members"
ON public.team_members FOR SELECT
USING (auth.uid() = owner_id OR auth.uid() = user_id);

CREATE POLICY "owners insert team members"
ON public.team_members FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owners update team members"
ON public.team_members FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "owners delete team members"
ON public.team_members FOR DELETE
USING (auth.uid() = owner_id);

CREATE TRIGGER trg_team_members_updated
BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla de invitaciones
CREATE TABLE public.team_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  email TEXT NOT NULL,
  role public.team_role NOT NULL DEFAULT 'collaborator',
  status public.invitation_status NOT NULL DEFAULT 'pending',
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by_name TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view own invitations"
ON public.team_invitations FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "invited users view own invitations"
ON public.team_invitations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() AND lower(u.email) = lower(team_invitations.email)
  )
);

CREATE POLICY "owners insert invitations"
ON public.team_invitations FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owners update invitations"
ON public.team_invitations FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "invited users update own invitations"
ON public.team_invitations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() AND lower(u.email) = lower(team_invitations.email)
  )
);

CREATE POLICY "owners delete invitations"
ON public.team_invitations FOR DELETE
USING (auth.uid() = owner_id);

CREATE TRIGGER trg_team_invitations_updated
BEFORE UPDATE ON public.team_invitations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_team_invitations_email ON public.team_invitations (lower(email));
CREATE INDEX idx_team_members_owner ON public.team_members (owner_id);
CREATE INDEX idx_team_members_user ON public.team_members (user_id);

-- Función: límite por plan
CREATE OR REPLACE FUNCTION public.get_plan_user_limit(_plan public.subscription_plan)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE _plan
    WHEN 'free' THEN 5
    WHEN 'starter' THEN 10
    WHEN 'pro' THEN 999999
    WHEN 'business' THEN 999999
  END;
$$;

-- Función: contar usuarios usados (owner + miembros activos + invitaciones pendientes)
CREATE OR REPLACE FUNCTION public.count_team_usage(_owner_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  members_count INTEGER;
  pending_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO members_count
  FROM public.team_members
  WHERE owner_id = _owner_id AND is_active = true;

  SELECT COUNT(*) INTO pending_count
  FROM public.team_invitations
  WHERE owner_id = _owner_id AND status = 'pending' AND expires_at > now();

  -- +1 por el dueño
  RETURN 1 + COALESCE(members_count, 0) + COALESCE(pending_count, 0);
END;
$$;

-- Auto-crear suscripción Free al crear usuario
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.account_subscriptions (owner_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (owner_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- Backfill: crear subscripción Free para usuarios existentes
INSERT INTO public.account_subscriptions (owner_id, plan, status)
SELECT id, 'free', 'active' FROM auth.users
ON CONFLICT (owner_id) DO NOTHING;
