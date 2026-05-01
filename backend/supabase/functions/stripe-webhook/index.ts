// Stripe Webhook — Sincroniza eventos de suscripción con la base de datos
// Política:
//   - subscription.created/updated → upsert con plan/billing/price_id real, period_end seguro
//   - subscription.deleted → vuelta automática a Free, ended_at registrado
//   - invoice.payment_failed → past_due
//   - Auditoría: cada evento se registra en subscription_events
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { lookupPlanFromPriceId, type PlanId } from "../_shared/stripe-catalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

function safeIso(unix: unknown): string | null {
  if (typeof unix === "number" && Number.isFinite(unix) && unix > 0) {
    try {
      return new Date(unix * 1000).toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

function inferFromAmount(amountCents: number, interval: string): PlanId {
  if (interval === "year") {
    if (amountCents <= 12000) return "starter";
    if (amountCents <= 30000) return "pro";
    return "business";
  }
  if (amountCents <= 1500) return "starter";
  if (amountCents <= 3500) return "pro";
  return "business";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey) return new Response("STRIPE_SECRET_KEY missing", { status: 500 });
  if (!webhookSecret) {
    console.warn("[stripe-webhook] STRIPE_WEBHOOK_SECRET no configurado");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20.acacia" });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] firma inválida", msg);
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  console.log(`[stripe-webhook] event ${event.type} id=${event.id}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const ownerId = session.metadata?.owner_id;
        const plan = (session.metadata?.plan as PlanId) ?? "starter";
        const billing = session.metadata?.billing ?? "monthly";
        const priceId = session.metadata?.price_id ?? null;

        if (ownerId && session.customer && session.subscription) {
          await admin.from("account_subscriptions").upsert(
            {
              owner_id: ownerId,
              plan,
              billing_cycle: billing,
              status: "active",
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              stripe_price_id: priceId,
              cancel_at_period_end: false,
              started_at: new Date().toISOString(),
              canceled_at: null,
              ended_at: null,
              pending_downgrade_plan: null,
              pending_downgrade_billing_cycle: null,
            },
            { onConflict: "owner_id" },
          );

          await admin.from("subscription_events").insert({
            owner_id: ownerId,
            event_type: "checkout_completed",
            to_plan: plan,
            billing_cycle: billing,
            stripe_event_id: event.id,
            stripe_subscription_id: session.subscription as string,
            metadata: { price_id: priceId },
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const ownerId = sub.metadata?.owner_id;
        const item = sub.items.data[0];
        const priceId = item?.price?.id ?? null;
        const amount = item?.price?.unit_amount ?? 0;
        const interval = item?.price?.recurring?.interval ?? "month";

        // Resolver plan/billing primero por price_id (autoritativo), luego metadata, luego inferencia
        let plan: PlanId;
        let billing: string;
        const lookup = priceId ? lookupPlanFromPriceId(priceId) : null;
        if (lookup) {
          plan = lookup.plan;
          billing = lookup.billing;
        } else if (sub.metadata?.plan) {
          plan = sub.metadata.plan as PlanId;
          billing = sub.metadata.billing ?? (interval === "year" ? "annual" : "monthly");
        } else {
          plan = inferFromAmount(amount, interval);
          billing = interval === "year" ? "annual" : "monthly";
        }

        const status =
          sub.status === "active" || sub.status === "trialing" ? "active" : sub.status;

        const periodEndUnix =
          (sub as any).current_period_end ?? item?.current_period_end ?? null;
        const periodEndIso = safeIso(periodEndUnix);
        const startedAtIso = safeIso((sub as any).start_date);

        // Buscar fila existente por owner_id (preferido) o por stripe_customer_id (fallback)
        let existingOwnerId: string | null = ownerId ?? null;
        if (!existingOwnerId) {
          const { data: row } = await admin
            .from("account_subscriptions")
            .select("owner_id, plan")
            .eq("stripe_customer_id", sub.customer as string)
            .maybeSingle();
          existingOwnerId = row?.owner_id ?? null;
        }

        const fromPlanRow = existingOwnerId
          ? await admin
              .from("account_subscriptions")
              .select("plan")
              .eq("owner_id", existingOwnerId)
              .maybeSingle()
          : null;
        const fromPlan = (fromPlanRow?.data?.plan as PlanId) ?? null;

        const updatePayload: Record<string, unknown> = {
          plan: status === "active" ? plan : "free",
          billing_cycle: billing,
          status,
          stripe_customer_id: sub.customer as string,
          stripe_subscription_id: sub.id,
          stripe_price_id: priceId,
          current_period_end: periodEndIso,
          cancel_at_period_end: sub.cancel_at_period_end,
        };
        if (startedAtIso) updatePayload.started_at = startedAtIso;
        if (sub.cancel_at_period_end) {
          updatePayload.canceled_at = updatePayload.canceled_at ?? new Date().toISOString();
        } else {
          updatePayload.canceled_at = null;
        }

        if (existingOwnerId) {
          updatePayload.owner_id = existingOwnerId;
          await admin
            .from("account_subscriptions")
            .upsert(updatePayload, { onConflict: "owner_id" });

          await admin.from("subscription_events").insert({
            owner_id: existingOwnerId,
            event_type: event.type === "customer.subscription.created" ? "subscription_created" : "subscription_updated",
            from_plan: fromPlan,
            to_plan: plan,
            billing_cycle: billing,
            stripe_event_id: event.id,
            stripe_subscription_id: sub.id,
            metadata: { price_id: priceId, period_end: periodEndIso, cancel_at_period_end: sub.cancel_at_period_end },
          });
        } else {
          // Sin owner conocido: solo update por customer_id
          delete updatePayload.owner_id;
          await admin
            .from("account_subscriptions")
            .update(updatePayload)
            .eq("stripe_customer_id", sub.customer as string);
        }

        console.log(`[stripe-webhook] sub.${event.type.split(".").pop()} owner=${existingOwnerId} plan=${plan} period_end=${periodEndIso}`);
        break;
      }

      case "customer.subscription.deleted": {
        // Final del período: vuelta automática a Free
        const sub = event.data.object as Stripe.Subscription;

        const { data: row } = await admin
          .from("account_subscriptions")
          .select("owner_id, plan")
          .eq("stripe_customer_id", sub.customer as string)
          .maybeSingle();

        await admin
          .from("account_subscriptions")
          .update({
            plan: "free",
            status: "cancelled",
            stripe_subscription_id: null,
            stripe_price_id: null,
            cancel_at_period_end: false,
            ended_at: new Date().toISOString(),
            pending_downgrade_plan: null,
            pending_downgrade_billing_cycle: null,
          })
          .eq("stripe_customer_id", sub.customer as string);

        if (row?.owner_id) {
          await admin.from("subscription_events").insert({
            owner_id: row.owner_id,
            event_type: "subscription_ended",
            from_plan: (row.plan ?? null) as PlanId | null,
            to_plan: "free",
            stripe_event_id: event.id,
            stripe_subscription_id: sub.id,
            metadata: { reason: "period_ended_or_canceled" },
          });
        }

        console.log(`[stripe-webhook] subscription ended → free (customer ${sub.customer})`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          const { data: row } = await admin
            .from("account_subscriptions")
            .select("owner_id, plan")
            .eq("stripe_customer_id", invoice.customer as string)
            .maybeSingle();

          await admin
            .from("account_subscriptions")
            .update({ status: "past_due" })
            .eq("stripe_customer_id", invoice.customer as string);

          if (row?.owner_id) {
            await admin.from("subscription_events").insert({
              owner_id: row.owner_id,
              event_type: "payment_failed",
              from_plan: row.plan as PlanId,
              to_plan: row.plan as PlanId,
              stripe_event_id: event.id,
              metadata: { invoice_id: invoice.id, attempt: invoice.attempt_count },
            });
            // Notificación in-app: pago fallido
            await admin.from("notifications").insert({
              user_id: row.owner_id,
              alert_type: "general",
              severity: "warning",
              title: "Tu pago no se pudo procesar",
              message: "Stripe no pudo cobrar tu suscripción. Actualiza tu método de pago para mantener tu plan activo.",
              link: "/settings?tab=subscription",
            });
          }
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        // Útil para detectar renovaciones y restaurar status si venía de past_due
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          const { data: row } = await admin
            .from("account_subscriptions")
            .select("owner_id, plan, status")
            .eq("stripe_customer_id", invoice.customer as string)
            .maybeSingle();

          // Si estaba past_due y se cobró, volver a active
          if (row?.status === "past_due") {
            await admin
              .from("account_subscriptions")
              .update({ status: "active" })
              .eq("stripe_customer_id", invoice.customer as string);
          }

          if (row?.owner_id && invoice.billing_reason === "subscription_cycle") {
            await admin.from("subscription_events").insert({
              owner_id: row.owner_id,
              event_type: "renewal_succeeded",
              from_plan: row.plan as PlanId,
              to_plan: row.plan as PlanId,
              stripe_event_id: event.id,
              metadata: { invoice_id: invoice.id, amount_paid: invoice.amount_paid },
            });
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[stripe-webhook] error procesando ${event.type}`, msg);
    return new Response(`Handler error: ${msg}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
