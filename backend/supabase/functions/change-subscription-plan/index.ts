// Cambio de plan en suscripción existente.
// Política:
//   - Upgrade  → inmediato, con prorrateo (create_prorations) y cobro inmediato (always_invoice)
//   - Downgrade → al final del período (no se modifica Stripe ahora; se guarda pending_downgrade_*)
//   - Mismo plan → 400
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getPriceConfig,
  isDowngrade,
  isUpgrade,
  lookupPlanFromPriceId,
  type Billing,
  type PlanId,
} from "../_shared/stripe-catalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const extra = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[change-plan] ${step}${extra}`);
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

    const body = await req.json().catch(() => ({}));
    const targetPlan = body.plan as PlanId;
    const targetBilling = (body.billing ?? "monthly") as Billing;

    if (targetPlan === "free" || !["starter", "pro", "business"].includes(targetPlan)) {
      return new Response(JSON.stringify({ error: "Plan inválido (usa cancel-subscription para volver a Free)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["monthly", "annual"].includes(targetBilling)) {
      return new Response(JSON.stringify({ error: "Periodicidad inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: subRow } = await admin
      .from("account_subscriptions")
      .select("plan, billing_cycle, stripe_subscription_id, status")
      .eq("owner_id", userId)
      .maybeSingle();

    if (!subRow?.stripe_subscription_id) {
      return new Response(
        JSON.stringify({ error: "No tienes una suscripción activa. Crea una primero.", code: "no_subscription" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (subRow.status !== "active" && subRow.status !== "trialing") {
      return new Response(
        JSON.stringify({ error: `Suscripción en estado ${subRow.status}, no se puede cambiar.`, code: "not_active" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const currentPlan = (subRow.plan ?? "free") as PlanId;
    const currentBilling = (subRow.billing_cycle ?? "monthly") as Billing;

    if (currentPlan === targetPlan && currentBilling === targetBilling) {
      return new Response(
        JSON.stringify({ error: "Ya estás en este plan y ciclo.", code: "no_change" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const priceCfg = getPriceConfig(targetPlan as Exclude<PlanId, "free">, targetBilling);
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" as never });

    // Verificar el price actual real en Stripe (puede estar huérfano/inactivo si fue creado
    // antes de migrar el catálogo). Si lo está, forzamos un upgrade limpio al nuevo price.
    const liveSub = await stripe.subscriptions.retrieve(subRow.stripe_subscription_id);
    const currentItem = liveSub.items.data[0];
    const currentPriceId = currentItem?.price?.id ?? null;
    const currentPriceInCatalog = currentPriceId ? lookupPlanFromPriceId(currentPriceId) : null;
    const orphanPrice = currentPriceId !== null && !currentPriceInCatalog;

    if (orphanPrice) {
      log("orphan price detected — forcing clean upgrade", { currentPriceId, targetPriceId: priceCfg.priceId });
    }

    const upgrade =
      orphanPrice ||
      isUpgrade(currentPlan, targetPlan) ||
      (currentPlan === targetPlan && currentBilling !== targetBilling);
    const downgrade = !orphanPrice && isDowngrade(currentPlan, targetPlan);

    if (upgrade) {
      // Upgrade (o limpieza de price huérfano): aplicar inmediatamente con prorrateo y facturar
      const itemId = currentItem?.id;
      if (!itemId) {
        return new Response(
          JSON.stringify({
            error: "No encontramos el producto activo en tu suscripción. Abre el portal y vuelve a intentarlo.",
            code: "subscription_item_missing",
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Si existe un schedule colgado de un downgrade previo, liberarlo antes del upgrade
      if (liveSub.schedule) {
        const scheduleId = typeof liveSub.schedule === "string" ? liveSub.schedule : liveSub.schedule.id;
        try {
          await stripe.subscriptionSchedules.release(scheduleId);
          log("schedule released before upgrade", { scheduleId });
        } catch (err) {
          log("schedule release failed (non-fatal)", { err: err instanceof Error ? err.message : String(err) });
        }
      }

      const updated = await stripe.subscriptions.update(subRow.stripe_subscription_id, {
        items: [{ id: itemId, price: priceCfg.priceId }],
        proration_behavior: orphanPrice ? "create_prorations" : "always_invoice",
        metadata: {
          owner_id: userId,
          plan: targetPlan,
          billing: targetBilling,
          price_id: priceCfg.priceId,
        },
        cancel_at_period_end: false,
      });

      // Limpiar pending_downgrade si lo había (el upgrade lo invalida)
      await admin
        .from("account_subscriptions")
        .update({
          pending_downgrade_plan: null,
          pending_downgrade_billing_cycle: null,
        })
        .eq("owner_id", userId);

      await admin.from("subscription_events").insert({
        owner_id: userId,
        event_type: orphanPrice ? "price_remediated" : "upgraded",
        from_plan: currentPlan,
        to_plan: targetPlan,
        billing_cycle: targetBilling,
        stripe_subscription_id: updated.id,
        metadata: {
          price_id: priceCfg.priceId,
          previous_price_id: currentPriceId,
          orphan_remediated: orphanPrice,
        },
      });

      log("upgraded", { from: currentPlan, to: targetPlan, orphan: orphanPrice });
      return new Response(
        JSON.stringify({
          success: true,
          mode: "upgrade",
          message: orphanPrice
            ? "Plan actualizado. Tu suscripción ahora usa el catálogo vigente."
            : "Plan actualizado inmediatamente. Recibirás una factura prorrateada.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (downgrade) {
      // Downgrade: programar el cambio para el final del período actual con Subscription Schedule.
      const sub = liveSub;
      const itemId = sub.items.data[0]?.id;
      if (!itemId) {
        return new Response(
          JSON.stringify({
            error: "No encontramos el producto activo en tu suscripción.",
            code: "subscription_item_missing",
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      let scheduleId: string;
      if (sub.schedule) {
        scheduleId = typeof sub.schedule === "string" ? sub.schedule : sub.schedule.id;
      } else {
        const schedule = await stripe.subscriptionSchedules.create({
          from_subscription: sub.id,
        });
        scheduleId = schedule.id;
      }

      const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
      const currentPhase = schedule.phases[schedule.phases.length - 1];

      await stripe.subscriptionSchedules.update(scheduleId, {
        end_behavior: "release",
        phases: [
          {
            items: currentPhase.items.map((i: any) => ({
              price: typeof i.price === "string" ? i.price : i.price.id,
              quantity: i.quantity ?? 1,
            })),
            start_date: currentPhase.start_date,
            end_date: currentPhase.end_date,
            proration_behavior: "none",
          },
          {
            items: [{ price: priceCfg.priceId, quantity: 1 }],
            iterations: 1,
            proration_behavior: "none",
            metadata: {
              owner_id: userId,
              plan: targetPlan,
              billing: targetBilling,
              price_id: priceCfg.priceId,
              scheduled_downgrade: "true",
            },
          },
        ],
      });

      const periodEndIso = currentPhase.end_date
        ? new Date(currentPhase.end_date * 1000).toISOString()
        : null;

      await admin
        .from("account_subscriptions")
        .update({
          pending_downgrade_plan: targetPlan,
          pending_downgrade_billing_cycle: targetBilling,
        })
        .eq("owner_id", userId);

      await admin.from("subscription_events").insert({
        owner_id: userId,
        event_type: "downgrade_scheduled",
        from_plan: currentPlan,
        to_plan: targetPlan,
        billing_cycle: targetBilling,
        stripe_subscription_id: sub.id,
        metadata: { price_id: priceCfg.priceId, schedule_id: scheduleId, effective_at: periodEndIso },
      });

      log("downgrade scheduled", { from: currentPlan, to: targetPlan, effective_at: periodEndIso });
      return new Response(
        JSON.stringify({
          success: true,
          mode: "downgrade_scheduled",
          effective_at: periodEndIso,
          message: "Tu cambio se aplicará al cierre del período actual. Hasta entonces conservas tu plan vigente.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }



    return new Response(JSON.stringify({ error: "Cambio no soportado" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("[change-plan] ERROR", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
