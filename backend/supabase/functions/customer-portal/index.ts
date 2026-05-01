// Stripe Customer Portal — Permite al usuario gestionar su suscripción
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const extra = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[customer-portal] ${step}${extra}`);
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
      log("auth failed", { err: userErr?.message });
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email;
    log("authenticated", { userId, userEmail });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: subRow } = await admin
      .from("account_subscriptions")
      .select("stripe_customer_id")
      .eq("owner_id", userId)
      .maybeSingle();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" as never });
    let customerId = subRow?.stripe_customer_id ?? null;

    if (!customerId) {
      // Buscar por email en Stripe
      const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
        log("customer found by email", { customerId });
      } else {
        // Crear el customer (no romper la experiencia: el portal podrá mostrarse vacío)
        const created = await stripe.customers.create({
          email: userEmail,
          metadata: { owner_id: userId },
        });
        customerId = created.id;
        log("customer created", { customerId });
      }
      // Persistir el customer_id en nuestra DB
      await admin
        .from("account_subscriptions")
        .upsert(
          { owner_id: userId, stripe_customer_id: customerId },
          { onConflict: "owner_id" },
        );
    }

    const origin = req.headers.get("origin") ?? "https://scorpion-flow.com";
    let portal;
    try {
      portal = await stripe.billingPortal.sessions.create({
        customer: customerId!,
        return_url: `${origin}/settings?tab=subscription`,
      });
    } catch (stripeErr) {
      const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
      log("billingPortal error", { msg });
      // Mensaje específico si el portal no está configurado
      if (/configuration|portal/i.test(msg)) {
        return new Response(
          JSON.stringify({
            error: "Portal de Stripe no configurado. El administrador debe activar el Customer Portal en el dashboard de Stripe.",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw stripeErr;
    }

    log("portal session created", { url: portal.url });
    return new Response(JSON.stringify({ url: portal.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    console.error("[customer-portal] ERROR", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
