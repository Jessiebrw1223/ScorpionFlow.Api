import { useNavigate } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SubscriptionPlan } from "@/hooks/useTeam";
import { PLAN_LABELS } from "@/hooks/useTeam";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: SubscriptionPlan;
  used: number;
  limit: number;
}

export function UpgradePlanDialog({ open, onOpenChange, currentPlan, used, limit }: Props) {
  const navigate = useNavigate();
  const nextPlan: SubscriptionPlan = currentPlan === "free" ? "starter" : "pro";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-primary/30">
        <div className="relative bg-gradient-to-br from-primary/15 via-background to-background p-6">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-12 h-12 rounded-xl scorpion-gradient flex items-center justify-center fire-glow mb-4">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold mb-2">
            Has alcanzado el límite de tu plan {PLAN_LABELS[currentPlan]}
          </h2>
          <p className="text-sm text-muted-foreground mb-1">
            Estás usando <span className="text-foreground font-semibold">{used} / {limit}</span> usuarios.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Actualiza para seguir colaborando sin restricciones y desbloquear más visibilidad para tu equipo.
          </p>

          <div className="rounded-xl border border-primary/30 bg-card/60 p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">
                Próximo paso
              </span>
              <span className="text-xs text-muted-foreground">Recomendado</span>
            </div>
            <div className="text-base font-semibold mb-1">Plan {PLAN_LABELS[nextPlan]}</div>
            <div className="text-xs text-muted-foreground">
              {nextPlan === "starter"
                ? "Hasta 10 usuarios y proyectos ilimitados."
                : "Usuarios ilimitados + control financiero completo."}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Más tarde
            </Button>
            <Button
              className="flex-1 scorpion-gradient text-primary-foreground border-0"
              onClick={() => {
                onOpenChange(false);
                navigate("/settings?tab=subscription");
              }}
            >
              Ver planes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
