// Stripe Checkout — Crea sesión de suscripción usando price_id reales
// Política: usuario autenticado, plan + billing válidos, customer reusado o creado
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getPriceConfig,
  type Billing,
  type PlanId,
} from "../_shared/stripe-catalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const extra = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[create-checkout] ${step}${extra}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log("started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY no configurada");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user?.email) {
      log("auth failed", { err: userErr?.message });
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email;
    log("authenticated", { userId, userEmail });

    const body = await req.json().catch(() => ({}));
    const plan = body.plan as PlanId;
    const billing = (body.billing ?? "monthly") as Billing;

    if (plan === "free" || !["starter", "pro", "business"].includes(plan)) {
      return new Response(JSON.stringify({ error: "Plan inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (billing !== "monthly" && billing !== "annual") {
      return new Response(JSON.stringify({ error: "Periodicidad inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priceCfg = getPriceConfig(plan as Exclude<PlanId, "free">, billing);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" as never });

    // Buscar customer existente
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: subRow } = await admin
      .from("account_subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("owner_id", userId)
      .maybeSingle();

    // Si ya tiene una suscripción activa, debería usar change-subscription-plan en lugar de checkout
    if (subRow?.stripe_subscription_id && (subRow.status === "active" || subRow.status === "trialing")) {
      return new Response(
        JSON.stringify({
          error: "Ya tienes una suscripción activa. Usa cambiar plan en lugar de crear una nueva.",
          code: "subscription_exists",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let customerId: string | null = subRow?.stripe_customer_id ?? null;
    if (!customerId) {
      const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const created = await stripe.customers.create({
          email: userEmail,
          metadata: { owner_id: userId },
        });
        customerId = created.id;
      }
      log("customer ready", { customerId });
    }

    const origin = req.headers.get("origin") ?? "https://scorpion-flow.com";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceCfg.priceId, quantity: 1 }],
      metadata: { owner_id: userId, plan, billing, price_id: priceCfg.priceId },
      subscription_data: {
        metadata: { owner_id: userId, plan, billing, price_id: priceCfg.priceId },
      },
      success_url: `${origin}/settings?tab=subscription&checkout=success`,
      cancel_url: `${origin}/settings?tab=subscription&checkout=cancelled`,
      allow_promotion_codes: true,
    });

    log("session created", { sessionId: session.id, plan, billing });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("[create-checkout] ERROR", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
