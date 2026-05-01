import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X, Check, Loader2, Lock } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePlan, getRequiredPlan, PLAN_LABELS, type PremiumFeature, type PlanId } from "@/hooks/usePlan";
import { humanizeError, humanizeFunctionError } from "@/lib/humanize-error";

interface UpsellDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: PremiumFeature;
  /** Forzar un plan específico a recomendar (override) */
  recommendedPlan?: PlanId;
  /** Razón mostrada en el header (ej: "Has alcanzado el límite de usuarios") */
  reason?: string;
}

const PLAN_BENEFITS: Record<Exclude<PlanId, "free">, string[]> = {
  starter: [
    "Hasta 10 usuarios en tu equipo",
    "Proyectos y clientes ilimitados",
    "Cotizaciones ilimitadas",
    "Calendario y vistas avanzadas",
  ],
  pro: [
    "Usuarios ilimitados",
    "💰 Ganancia real y margen por proyecto",
    "Inteligencia de costos automática",
    "Alertas inteligentes de pérdida",
    "Gestión avanzada de recursos",
  ],
  business: [
    "Todo lo de Pro",
    "Dashboard ejecutivo multi-proyecto",
    "Proyección financiera avanzada",
    "Reportes ejecutivos descargables",
    "Soporte prioritario",
  ],
};

const PLAN_PRICES: Record<Exclude<PlanId, "free">, { monthly: string; annual: string }> = {
  starter: { monthly: "S/45", annual: "S/432" },
  pro: { monthly: "S/101", annual: "S/970" },
  business: { monthly: "S/225", annual: "S/2,160" },
};

const FEATURE_HEADLINES: Record<PremiumFeature, string> = {
  advanced_reports: "Los informes avanzados requieren PRO",
  resources_management: "La gestión de recursos requiere PRO",
  cost_intelligence: "La inteligencia de costos requiere PRO",
  smart_alerts: "Las alertas inteligentes requieren PRO",
  executive_dashboard: "El dashboard ejecutivo requiere BUSINESS",
  financial_projection: "La proyección financiera requiere BUSINESS",
};

const FEATURE_PITCHES: Record<PremiumFeature, string> = {
  advanced_reports: "Mide rentabilidad real, márgenes y desempeño por proyecto.",
  resources_management: "Controla personal, maquinaria y costos por recurso.",
  cost_intelligence: "Calcula automáticamente ganancia, ROI y margen por proyecto.",
  smart_alerts: "Recibe avisos cuando un proyecto pierde dinero o entra en riesgo.",
  executive_dashboard: "Visión consolidada multi-proyecto con KPIs estratégicos.",
  financial_projection: "Proyecta ingresos, costos y rentabilidad a futuro.",
};

export function UpsellDialog({
  open,
  onOpenChange,
  feature,
  recommendedPlan,
  reason,
}: UpsellDialogProps) {
  const navigate = useNavigate();
  const { plan: currentPlan } = usePlan();
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);

  const targetPlan: Exclude<PlanId, "free"> =
    recommendedPlan && recommendedPlan !== "free"
      ? (recommendedPlan as Exclude<PlanId, "free">)
      : feature
        ? (getRequiredPlan(feature) as Exclude<PlanId, "free">)
        : currentPlan === "free"
          ? "starter"
          : currentPlan === "starter"
            ? "pro"
            : "business";

  const benefits = PLAN_BENEFITS[targetPlan];
  const price = PLAN_PRICES[targetPlan];

  const headline = feature
    ? FEATURE_HEADLINES[feature]
    : `Desbloquea ScorpionFlow ${PLAN_LABELS[targetPlan]}`;
  const pitch = feature
    ? FEATURE_PITCHES[feature]
    : "Lleva tu negocio al siguiente nivel con control financiero real.";

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan: targetPlan, billing },
      });
      if (error || (data && (data as any).error)) {
        toast.error("No pudimos abrir el pago", {
          description: humanizeFunctionError(
            error,
            data,
            "Intenta nuevamente en unos segundos.",
          ),
        });
        return;
      }
      if (data?.url) {
        window.open(data.url, "_blank");
        onOpenChange(false);
      } else {
        toast.error("No pudimos abrir el pago", {
          description: "Intenta nuevamente en unos segundos.",
        });
      }
    } catch (e) {
      toast.error("No pudimos abrir el pago", {
        description: humanizeError(e, "Intenta nuevamente en unos segundos."),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-primary/30">
        <div className="relative bg-gradient-to-br from-primary/15 via-background to-background p-6">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-sf"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Lock + sparkles */}
          <div className="relative w-14 h-14 mb-4">
            <div className="absolute inset-0 rounded-2xl scorpion-gradient flex items-center justify-center fire-glow shadow-lg">
              <Lock className="w-6 h-6 text-primary-foreground" />
            </div>
            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-primary animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3" />
            Plan {PLAN_LABELS[targetPlan]}
          </div>

          {reason && (
            <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-2">
              {reason}
            </div>
          )}

          <h2 className="text-xl font-bold text-foreground mb-1 leading-tight">
            {headline}
          </h2>
          <p className="text-[13px] text-muted-foreground mb-5">
            {pitch}
          </p>

          {/* Toggle mensual / anual */}
          <div className="inline-flex items-center gap-1 bg-secondary border border-border rounded-lg p-1 mb-5">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-3 h-7 rounded-md text-[11px] font-medium transition-sf ${
                billing === "monthly" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`px-3 h-7 rounded-md text-[11px] font-medium transition-sf flex items-center gap-1.5 ${
                billing === "annual" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Anual
              <span className="text-[9px] font-bold text-cost-positive bg-cost-positive/10 px-1.5 py-0.5 rounded">
                -20%
              </span>
            </button>
          </div>

          <div className="rounded-xl border border-primary/30 bg-card/60 p-4 mb-5">
            <div className="flex items-baseline gap-1 mb-3">
              <span className="font-mono-data text-3xl font-bold text-foreground">
                {billing === "monthly" ? price.monthly : price.annual}
              </span>
              <span className="text-[12px] text-muted-foreground">
                {billing === "monthly" ? "/ mes" : "/ año"}
              </span>
            </div>

            <ul className="space-y-1.5">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[12.5px] text-foreground/90">
                  <Check className="w-3.5 h-3.5 text-cost-positive shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-10"
              onClick={() => {
                onOpenChange(false);
                navigate("/settings?tab=subscription");
              }}
            >
              Ver planes
            </Button>
            <Button
              className="flex-1 fire-button border-0 text-white h-10 font-semibold"
              onClick={handleCheckout}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Actualizar ahora"
              )}
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-3">
            Pago seguro con Stripe · Cancela cuando quieras
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
