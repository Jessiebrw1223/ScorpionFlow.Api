import { useNavigate } from "react-router-dom";
import {
  Phone,
  AlertTriangle,
  Users,
  DollarSign,
  ListChecks,
  Sparkles,
  ArrowRight,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecommendedAction } from "@/lib/business-intelligence";

const ICON_MAP = {
  phone: Phone,
  alert: AlertTriangle,
  users: Users,
  money: DollarSign,
  task: ListChecks,
  spark: Sparkles,
};

const PRIORITY_META = {
  critical: { label: "Crítico", color: "text-cost-negative", bg: "bg-cost-negative/15", border: "border-cost-negative", dot: "bg-cost-negative" },
  high: { label: "Alta", color: "text-primary", bg: "bg-primary/15", border: "border-primary", dot: "bg-primary" },
  medium: { label: "Media", color: "text-cost-warning", bg: "bg-cost-warning/15", border: "border-cost-warning", dot: "bg-cost-warning" },
  low: { label: "Baja", color: "text-muted-foreground", bg: "bg-muted/30", border: "border-muted", dot: "bg-muted-foreground" },
};

export function RecommendedActionsPanel({ actions }: { actions: RecommendedAction[] }) {
  const navigate = useNavigate();

  return (
    <section className="surface-card fire-border p-4 space-y-3 relative overflow-hidden">
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none animate-fire-flicker" />

      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg scorpion-gradient flex items-center justify-center fire-glow">
            <Brain className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-base font-bold fire-text">Acciones recomendadas</h2>
            <p className="text-[11px] text-muted-foreground">El sistema te dice qué hacer ahora</p>
          </div>
        </div>
        <span className="text-[11px] font-mono-data text-muted-foreground px-2 py-1 rounded bg-secondary/50">
          {actions.length} acciones
        </span>
      </div>

      {actions.length === 0 ? (
        <div className="py-8 text-center space-y-2 relative">
          <div className="text-4xl">✨</div>
          <p className="text-sm font-medium text-cost-positive">Todo bajo control</p>
          <p className="text-[12px] text-muted-foreground">No hay acciones urgentes pendientes.</p>
        </div>
      ) : (
        <div className="space-y-2 relative max-h-[420px] overflow-y-auto pr-1">
          {actions.map((a) => {
            const Icon = ICON_MAP[a.icon];
            const meta = PRIORITY_META[a.priority];
            return (
              <div
                key={a.id}
                className={cn(
                  "group flex items-start gap-3 p-3 rounded-lg border-l-4 bg-secondary/30 hover:bg-secondary/60 transition-sf cursor-pointer",
                  meta.border
                )}
                onClick={() => navigate(a.link)}
              >
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", meta.bg)}>
                  <Icon className={cn("w-4 h-4", meta.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
                    <span className={cn("text-[10px] uppercase tracking-wider font-bold", meta.color)}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-[13px] font-semibold text-foreground mt-0.5 truncate">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{a.description}</p>
                </div>
                <button
                  className={cn(
                    "shrink-0 px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 transition-sf",
                    "fire-button"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(a.link);
                  }}
                >
                  {a.actionLabel}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
