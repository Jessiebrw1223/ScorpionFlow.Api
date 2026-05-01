// Reactivar una suscripción que está programada para cancelarse pero aún dentro del período pagado.
// Pone cancel_at_period_end = false.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  console.log(`[reactivate-subscription] ${step}${details ? ` ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: subRow } = await admin
      .from("account_subscriptions")
      .select("plan, stripe_subscription_id, status, cancel_at_period_end")
      .eq("owner_id", userId)
      .maybeSingle();

    if (!subRow?.stripe_subscription_id) {
      return new Response(
        JSON.stringify({ error: "No tienes una suscripción que reactivar.", code: "no_subscription" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!subRow.cancel_at_period_end) {
      return new Response(
        JSON.stringify({ error: "Tu suscripción no está cancelada.", code: "not_canceled" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (subRow.status !== "active" && subRow.status !== "trialing") {
      return new Response(
        JSON.stringify({
          error: "El período pagado expiró. Crea una nueva suscripción.",
          code: "period_expired",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" as never });
    await stripe.subscriptions.update(subRow.stripe_subscription_id, {
      cancel_at_period_end: false,
      metadata: { reactivated_at: new Date().toISOString() },
    });

    await admin
      .from("account_subscriptions")
      .update({
        cancel_at_period_end: false,
        canceled_at: null,
      })
      .eq("owner_id", userId);

    await admin.from("subscription_events").insert({
      owner_id: userId,
      event_type: "reactivated",
      from_plan: subRow.plan,
      to_plan: subRow.plan,
      stripe_subscription_id: subRow.stripe_subscription_id,
    });

    log("reactivated");
    return new Response(
      JSON.stringify({ success: true, message: "Suscripción reactivada." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("[reactivate-subscription] ERROR", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
