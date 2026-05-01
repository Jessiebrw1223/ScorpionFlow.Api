/**
 * PremiumBlur — Overlay elegante para KPIs/secciones premium en planes Free.
 *
 * Filosofía F7 (Experiencia Premium):
 *  - No romper el flujo: el usuario ve el contenedor con preview borroso.
 *  - Lock icon + texto persuasivo + CTA "Desbloquear PRO".
 *  - Pensado para tarjetas/KPIs pequeños. Para secciones grandes usa <PremiumGate>.
 */
import { useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlan, getRequiredPlan, type PremiumFeature, PLAN_LABELS } from "@/hooks/usePlan";
import { UpsellDialog } from "@/components/billing/UpsellDialog";

interface PremiumBlurProps {
  feature: PremiumFeature;
  /** Texto persuasivo corto. Default: "Controla dinero real con PRO" */
  message?: string;
  /** Contenido borroso por debajo del overlay */
  children?: React.ReactNode;
  /** Tamaño visual del overlay */
  size?: "sm" | "md";
  className?: string;
}

export function PremiumBlur({
  feature,
  message = "Controla dinero real con PRO",
  children,
  size = "md",
  className,
}: PremiumBlurProps) {
  const { canAccess, loading } = usePlan();
  const [open, setOpen] = useState(false);

  if (loading) {
    return <div className={cn("animate-pulse bg-muted/30 rounded-lg h-24", className)} />;
  }

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  const requiredPlan = getRequiredPlan(feature);

  return (
    <>
      <div
        className={cn(
          "relative rounded-xl overflow-hidden surface-card border-primary/30",
          size === "sm" ? "min-h-[80px]" : "min-h-[120px]",
          className
        )}
      >
        {children && (
          <div
            aria-hidden
            className="pointer-events-none select-none opacity-25 blur-md absolute inset-0"
          >
            {children}
          </div>
        )}

        <div
          className={cn(
            "relative z-10 flex items-center gap-3 p-3",
            "bg-gradient-to-br from-background/80 via-background/70 to-primary/10",
            "backdrop-blur-sm h-full"
          )}
        >
          <div
            className={cn(
              "rounded-lg scorpion-gradient flex items-center justify-center fire-glow shrink-0",
              size === "sm" ? "w-8 h-8" : "w-10 h-10"
            )}
          >
            <Lock
              className={cn(
                "text-primary-foreground",
                size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary font-bold">
              <Sparkles className="w-3 h-3" />
              Plan {PLAN_LABELS[requiredPlan]}
            </div>
            <p
              className={cn(
                "text-foreground/90 font-semibold leading-tight mt-0.5",
                size === "sm" ? "text-[12px]" : "text-[13px]"
              )}
            >
              {message}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="fire-button border-0 text-white h-8 text-[11px] font-semibold shrink-0"
          >
            Desbloquear {PLAN_LABELS[requiredPlan]}
          </Button>
        </div>
      </div>

      <UpsellDialog open={open} onOpenChange={setOpen} feature={feature} />
    </>
  );
}
