import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlanId = "free" | "starter" | "pro" | "business";
export type Billing = "monthly" | "annual";

export interface StripePrice {
  plan: Exclude<PlanId, "free">;
  billing: Billing;
  priceId: string;
  amountUsd: number;
  amountCents: number;
  currency: string;
  interval: string;
  available: boolean;
  error?: string;
}

interface State {
  prices: StripePrice[];
  loading: boolean;
  error: string | null;
}

// Cache global por sesión (evita refetch entre páginas)
let cachedPrices: StripePrice[] | null = null;

export function useStripePrices(): State & {
  getPrice: (plan: PlanId, billing: Billing) => StripePrice | null;
} {
  const [prices, setPrices] = useState<StripePrice[]>(cachedPrices ?? []);
  const [loading, setLoading] = useState(!cachedPrices);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedPrices) return;
    let mounted = true;
    (async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("get-stripe-prices", {
          body: {},
        });
        if (fnErr) throw fnErr;
        const list = (data?.prices as StripePrice[]) ?? [];
        if (mounted) {
          cachedPrices = list;
          setPrices(list);
          setLoading(false);
        }
      } catch (e: any) {
        if (mounted) {
          setError(e?.message ?? "No pudimos cargar los precios");
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const getPrice = (plan: PlanId, billing: Billing): StripePrice | null => {
    if (plan === "free") return null;
    return prices.find((p) => p.plan === plan && p.billing === billing) ?? null;
  };

  return { prices, loading, error, getPrice };
}
