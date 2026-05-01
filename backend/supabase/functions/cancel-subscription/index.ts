// Cancelación de suscripción
// Política: cancel_at_period_end = true. El usuario conserva acceso hasta current_period_end.
// El webhook (customer.subscription.deleted) procesará el cambio a Free cuando expire.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  console.log(`[cancel-subscription] ${step}${details ? ` ${JSON.stringify(details)}` : ""}`);
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
        JSON.stringify({ error: "No tienes una suscripción activa.", code: "no_subscription" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (subRow.cancel_at_period_end) {
      return new Response(
        JSON.stringify({ error: "La suscripción ya está programada para cancelarse.", code: "already_canceled" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" as never });
    const updated = await stripe.subscriptions.update(subRow.stripe_subscription_id, {
      cancel_at_period_end: true,
      metadata: { canceled_by: "user", canceled_at: new Date().toISOString() },
    });

    // Reflejar inmediatamente en DB (el webhook también lo hará, pero esto da feedback instantáneo)
    const periodEndUnix = (updated as any).current_period_end ?? updated.items.data[0]?.current_period_end ?? null;
    const periodEndIso =
      typeof periodEndUnix === "number" && Number.isFinite(periodEndUnix)
        ? new Date(periodEndUnix * 1000).toISOString()
        : null;

    await admin
      .from("account_subscriptions")
      .update({
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString(),
        current_period_end: periodEndIso,
      })
      .eq("owner_id", userId);

    await admin.from("subscription_events").insert({
      owner_id: userId,
      event_type: "cancellation_scheduled",
      from_plan: subRow.plan,
      to_plan: "free",
      stripe_subscription_id: updated.id,
      metadata: { effective_at: periodEndIso },
    });

    log("scheduled", { effectiveAt: periodEndIso });
    return new Response(
      JSON.stringify({
        success: true,
        message: "Cancelación programada. Conservas acceso hasta el final del período.",
        effective_at: periodEndIso,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("[cancel-subscription] ERROR", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
