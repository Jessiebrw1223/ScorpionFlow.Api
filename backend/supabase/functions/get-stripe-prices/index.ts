// get-stripe-prices — Devuelve los precios reales de Stripe para los planes activos
// Fuente única de verdad: catálogo central + verificación contra Stripe
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { STRIPE_PRICES, type Billing, type PlanId } from "../_shared/stripe-catalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PriceEntry {
  plan: Exclude<PlanId, "free">;
  billing: Billing;
  priceId: string;
  amountCents: number;
  amountUsd: number;
  currency: string;
  interval: string;
  productName: string;
  available: boolean;
  error?: string;
}

// Cache simple en memoria (5 min) para evitar pegar Stripe en cada page load
let cache: { ts: number; data: PriceEntry[] } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
      return new Response(JSON.stringify({ prices: cache.data, cached: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      // Devolver el catálogo sin verificar Stripe
      const fallback = buildFallback();
      return new Response(JSON.stringify({ prices: fallback, cached: false, fallback: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" as never });
    const entries: PriceEntry[] = [];

    for (const plan of ["starter", "pro", "business"] as const) {
      for (const billing of ["monthly", "annual"] as const) {
        const cfg = STRIPE_PRICES[plan][billing];
        try {
          const price = await stripe.prices.retrieve(cfg.priceId);
          if (!price.active) {
            entries.push({
              plan, billing, priceId: cfg.priceId,
              amountCents: cfg.amountCents,
              amountUsd: cfg.amountCents / 100,
              currency: price.currency ?? "usd",
              interval: price.recurring?.interval ?? (billing === "annual" ? "year" : "month"),
              productName: cfg.productName,
              available: false,
              error: "price_inactive",
            });
            continue;
          }
          entries.push({
            plan, billing, priceId: cfg.priceId,
            amountCents: price.unit_amount ?? cfg.amountCents,
            amountUsd: (price.unit_amount ?? cfg.amountCents) / 100,
            currency: price.currency ?? "usd",
            interval: price.recurring?.interval ?? (billing === "annual" ? "year" : "month"),
            productName: cfg.productName,
            available: true,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          entries.push({
            plan, billing, priceId: cfg.priceId,
            amountCents: cfg.amountCents,
            amountUsd: cfg.amountCents / 100,
            currency: "usd",
            interval: billing === "annual" ? "year" : "month",
            productName: cfg.productName,
            available: false,
            error: msg.includes("No such price") ? "price_not_found" : "stripe_error",
          });
        }
      }
    }

    cache = { ts: Date.now(), data: entries };

    return new Response(JSON.stringify({ prices: entries, cached: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    console.error("[get-stripe-prices] ERROR", msg);
    // Fallback elegante: devolver catálogo aunque falle Stripe
    return new Response(JSON.stringify({ prices: buildFallback(), error: msg, fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildFallback(): PriceEntry[] {
  const out: PriceEntry[] = [];
  for (const plan of ["starter", "pro", "business"] as const) {
    for (const billing of ["monthly", "annual"] as const) {
      const cfg = STRIPE_PRICES[plan][billing];
      out.push({
        plan, billing, priceId: cfg.priceId,
        amountCents: cfg.amountCents,
        amountUsd: cfg.amountCents / 100,
        currency: "usd",
        interval: billing === "annual" ? "year" : "month",
        productName: cfg.productName,
        available: true,
      });
    }
  }
  return out;
}
