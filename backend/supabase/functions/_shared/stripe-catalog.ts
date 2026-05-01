// Catálogo central de planes y price_id de Stripe.
// Editar SOLO aquí cuando cambien precios.

export type PlanId = "free" | "starter" | "pro" | "business";
export type Billing = "monthly" | "annual";

export interface PlanPrice {
  priceId: string;
  amountCents: number;
  productName: string;
}

// Price IDs reales creados en Stripe (FASE 2)
export const STRIPE_PRICES: Record<Exclude<PlanId, "free">, Record<Billing, PlanPrice>> = {
  starter: {
    monthly: {
      priceId: "price_1TNmiUAgawnoBjL9panymS3w",
      amountCents: 1200,
      productName: "ScorpionFlow Starter (Mensual)",
    },
    annual: {
      priceId: "price_1TNmisAgawnoBjL9xMT6McSP",
      amountCents: 10800,
      productName: "ScorpionFlow Starter (Anual)",
    },
  },
  pro: {
    monthly: {
      priceId: "price_1TNmqcAgawnoBjL9QaotYo9K",
      amountCents: 2700,
      productName: "ScorpionFlow Pro (Mensual)",
    },
    annual: {
      priceId: "price_1TNmuNAgawnoBjL9wWNwrnOX",
      amountCents: 25200,
      productName: "ScorpionFlow Pro (Anual)",
    },
  },
  business: {
    monthly: {
      priceId: "price_1TNmxxAgawnoBjL93eWzC2xQ",
      amountCents: 6000,
      productName: "ScorpionFlow Business (Mensual)",
    },
    annual: {
      priceId: "price_1TNmzMAgawnoBjL9R8te7CLk",
      amountCents: 57600,
      productName: "ScorpionFlow Business (Anual)",
    },
  },
};

export const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
};

// Mapa inverso para resolver plan/billing desde un price_id (usado por webhook)
export function lookupPlanFromPriceId(priceId: string): { plan: PlanId; billing: Billing } | null {
  for (const plan of ["starter", "pro", "business"] as const) {
    for (const billing of ["monthly", "annual"] as const) {
      if (STRIPE_PRICES[plan][billing].priceId === priceId) {
        return { plan, billing };
      }
    }
  }
  return null;
}

export function getPriceConfig(plan: Exclude<PlanId, "free">, billing: Billing): PlanPrice {
  return STRIPE_PRICES[plan][billing];
}

export function isUpgrade(currentPlan: PlanId, targetPlan: PlanId): boolean {
  return PLAN_RANK[targetPlan] > PLAN_RANK[currentPlan];
}

export function isDowngrade(currentPlan: PlanId, targetPlan: PlanId): boolean {
  return PLAN_RANK[targetPlan] < PLAN_RANK[currentPlan];
}
