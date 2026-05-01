import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlan, getRequiredPlan, type PremiumFeature, PLAN_LABELS } from "@/hooks/usePlan";
import { UpsellDialog } from "@/components/billing/UpsellDialog";

interface PremiumGateProps {
  feature: PremiumFeature;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Si true, muestra preview borroso del contenido */
  blur?: boolean;
}

const FEATURE_TITLES: Record<PremiumFeature, string> = {
  advanced_reports: "Reportes ejecutivos",
  resources_management: "Gestión avanzada de recursos",
  cost_intelligence: "Inteligencia de costos",
  smart_alerts: "Alertas inteligentes de riesgo",
  executive_dashboard: "Dashboard ejecutivo",
  financial_projection: "Proyección financiera",
};

const FEATURE_DESCRIPTIONS: Record<PremiumFeature, string> = {
  advanced_reports: "Informes detallados de rentabilidad, márgenes y desempeño por proyecto.",
  resources_management: "Controla personal, maquinaria y costos por recurso con totalizadores en vivo.",
  cost_intelligence: "Calcula automáticamente ganancia real, ROI y margen por proyecto.",
  smart_alerts: "Recibe avisos cuando un proyecto pierde dinero o entra en riesgo.",
  executive_dashboard: "Visión consolidada multi-proyecto con KPIs estratégicos.",
  financial_projection: "Proyecta ingresos, costos y rentabilidad a futuro.",
};

export function PremiumGate({
  feature,
  title,
  description,
  children,
  className,
  blur = true,
}: PremiumGateProps) {
  const { canAccess, loading } = usePlan();
  const [showUpsell, setShowUpsell] = useState(false);
  const navigate = useNavigate();

  if (loading) {
    return <div className={cn("animate-pulse bg-muted/30 rounded-lg h-40", className)} />;
  }

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  const requiredPlan = getRequiredPlan(feature);
  const displayTitle = title ?? FEATURE_TITLES[feature];
  const displayDesc = description ?? FEATURE_DESCRIPTIONS[feature];

  return (
    <>
      <div className={cn("relative rounded-xl overflow-hidden", className)}>
        {blur && (
          <div className="pointer-events-none select-none opacity-30 blur-sm">
            {children}
          </div>
        )}

        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center p-6",
            "bg-gradient-to-br from-background/95 via-background/90 to-primary/10",
            "backdrop-blur-md"
          )}
        >
          <div className="max-w-md text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl scorpion-gradient fire-glow shadow-lg">
              <Lock className="w-6 h-6 text-white" />
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                Plan {PLAN_LABELS[requiredPlan]}
              </div>
              <h3 className="text-lg font-bold text-foreground mt-2">{displayTitle}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{displayDesc}</p>
            </div>

            <div className="flex gap-2 justify-center pt-2">
              <Button
                onClick={() => setShowUpsell(true)}
                className="fire-button border-0 text-white gap-1.5 h-9 text-[13px] font-semibold"
              >
                Desbloquear con {PLAN_LABELS[requiredPlan]}
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/settings?tab=subscription")}
                className="h-9 text-[13px]"
              >
                Ver planes
              </Button>
            </div>
          </div>
        </div>
      </div>

      <UpsellDialog
        open={showUpsell}
        onOpenChange={setShowUpsell}
        feature={feature}
      />
    </>
  );
}
