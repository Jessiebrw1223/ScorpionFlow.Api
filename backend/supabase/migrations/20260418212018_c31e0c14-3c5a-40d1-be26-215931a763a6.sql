-- Agregar columnas Stripe a account_subscriptions para sincronizar suscripciones
ALTER TABLE public.account_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS account_subscriptions_owner_id_unique
  ON public.account_subscriptions(owner_id);

CREATE INDEX IF NOT EXISTS account_subscriptions_stripe_customer_idx
  ON public.account_subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS account_subscriptions_stripe_subscription_idx
  ON public.account_subscriptions(stripe_subscription_id);

-- Permitir al service role gestionar suscripciones desde el webhook
CREATE POLICY "service role manages subscriptions"
  ON public.account_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');