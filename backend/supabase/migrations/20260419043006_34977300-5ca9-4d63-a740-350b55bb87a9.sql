-- Lifecycle columns en account_subscriptions
ALTER TABLE public.account_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_downgrade_plan public.subscription_plan,
  ADD COLUMN IF NOT EXISTS pending_downgrade_billing_cycle text;

CREATE INDEX IF NOT EXISTS idx_account_subscriptions_stripe_customer
  ON public.account_subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_account_subscriptions_stripe_subscription
  ON public.account_subscriptions (stripe_subscription_id);

-- Tabla de auditoría de eventos
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  event_type text NOT NULL,
  from_plan public.subscription_plan,
  to_plan public.subscription_plan,
  billing_cycle text,
  stripe_event_id text,
  stripe_subscription_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_owner
  ON public.subscription_events (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_stripe_event
  ON public.subscription_events (stripe_event_id);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners view own subscription events" ON public.subscription_events;
CREATE POLICY "owners view own subscription events"
  ON public.subscription_events
  FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "service role manages subscription events" ON public.subscription_events;
CREATE POLICY "service role manages subscription events"
  ON public.subscription_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');