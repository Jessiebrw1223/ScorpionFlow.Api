import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PlanId = "free" | "starter" | "pro" | "business";
export type BillingCycle = "monthly" | "annual";

export type PremiumFeature =
  | "advanced_reports"
  | "resources_management"
  | "cost_intelligence"
  | "executive_dashboard"
  | "financial_projection"
  | "smart_alerts";

export interface PlanInfo {
  plan: PlanId;
  status: string;
  billingCycle: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  pendingDowngradePlan: PlanId | null;
  pendingDowngradeBillingCycle: string | null;
  stripePriceId: string | null;
  loading: boolean;
  // Helpers
  isPro: boolean;
  isBusiness: boolean;
  isPaid: boolean;
  hasActiveStripeSub: boolean;
  canAccess: (feature: PremiumFeature) => boolean;
  refresh: () => Promise<void>;
}

export const PLAN_LABELS: Record<PlanId, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

// Mapeo de features → plan mínimo requerido
const FEATURE_REQUIREMENTS: Record<PremiumFeature, PlanId> = {
  advanced_reports: "pro",
  resources_management: "pro",
  cost_intelligence: "pro",
  smart_alerts: "pro",
  executive_dashboard: "business",
  financial_projection: "business",
};

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
};

export function usePlan(): PlanInfo {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanId>("free");
  const [status, setStatus] = useState<string>("active");
  const [billingCycle, setBillingCycle] = useState<string>("monthly");
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [pendingDowngradePlan, setPendingDowngradePlan] = useState<PlanId | null>(null);
  const [pendingDowngradeBillingCycle, setPendingDowngradeBillingCycle] = useState<string | null>(null);
  const [stripePriceId, setStripePriceId] = useState<string | null>(null);
  const [hasStripeSub, setHasStripeSub] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("account_subscriptions")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (data) {
      setPlan((data.plan as PlanId) ?? "free");
      setStatus(data.status ?? "active");
      setBillingCycle(data.billing_cycle ?? "monthly");
      setCancelAtPeriodEnd((data as any).cancel_at_period_end ?? false);
      setCurrentPeriodEnd((data as any).current_period_end ?? null);
      setPendingDowngradePlan(((data as any).pending_downgrade_plan as PlanId | null) ?? null);
      setPendingDowngradeBillingCycle((data as any).pending_downgrade_billing_cycle ?? null);
      setStripePriceId((data as any).stripe_price_id ?? null);
      setHasStripeSub(Boolean((data as any).stripe_subscription_id));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: suscribirse a cambios en mi suscripción.
  useEffect(() => {
    if (!user) return;
    const channelName = `subscription-${user.id}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "account_subscriptions",
        filter: `owner_id=eq.${user.id}`,
      },
      () => {
        refresh();
      }
    );
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return useMemo<PlanInfo>(() => {
    const rank = PLAN_RANK[plan];
    const isActive = status === "active" || status === "trialing";
    return {
      plan,
      status,
      billingCycle,
      cancelAtPeriodEnd,
      currentPeriodEnd,
      pendingDowngradePlan,
      pendingDowngradeBillingCycle,
      stripePriceId,
      loading,
      isPro: rank >= PLAN_RANK.pro && isActive,
      isBusiness: rank >= PLAN_RANK.business && isActive,
      isPaid: rank >= PLAN_RANK.starter && isActive,
      hasActiveStripeSub: hasStripeSub && isActive,
      canAccess: (feature: PremiumFeature) => {
        if (!isActive) return false;
        return rank >= PLAN_RANK[FEATURE_REQUIREMENTS[feature]];
      },
      refresh,
    };
  }, [plan, status, billingCycle, cancelAtPeriodEnd, currentPeriodEnd, pendingDowngradePlan, pendingDowngradeBillingCycle, stripePriceId, hasStripeSub, loading, refresh]);
}

export function getRequiredPlan(feature: PremiumFeature): PlanId {
  return FEATURE_REQUIREMENTS[feature];
}
