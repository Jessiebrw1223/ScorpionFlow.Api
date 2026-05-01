import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, CheckCircle2, Flame, DollarSign, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BusinessSnapshot } from "@/lib/business-intelligence";

interface Props {
  snapshot: BusinessSnapshot;
}

interface StatCard {
  label: string;
  count: number;
  icon: typeof AlertTriangle;
  color: string;
  bg: string;
  border: string;
  dot: string;
  link: string;
  cta: string;
}

export function BusinessStatusBlock({ snapshot }: Props) {
  const navigate = useNavigate();

  const cards: StatCard[] = [
    {
      label: "Proyectos en riesgo",
      count: snapshot.projectsAtRisk,
      icon: AlertTriangle,
      color: "text-cost-negative",
      bg: "bg-cost-negative/10",
      border: "border-cost-negative/40",
      dot: "🔴",
      link: "/projects",
      cta: "Ver",
    },
    {
      label: "Tareas bloqueadas",
      count: snapshot.blockedTasks,
      icon: Clock,
      color: "text-cost-warning",
      bg: "bg-cost-warning/10",
      border: "border-cost-warning/40",
      dot: "🟡",
      link: "/tasks",
      cta: "Desbloquear",
    },
    {
      label: "Proyectos en tiempo",
      count: snapshot.projectsOnTime,
      icon: CheckCircle2,
      color: "text-cost-positive",
      bg: "bg-cost-positive/10",
      border: "border-cost-positive/40",
      dot: "🟢",
      link: "/projects",
      cta: "Ver",
    },
    {
      label: "Recursos sobrecargados",
      count: snapshot.overloadedResources,
      icon: Flame,
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/40",
      dot: "🔥",
      link: "/resources",
      cta: "Reasignar",
    },
    {
      label: "Proyectos con sobrecosto",
      count: snapshot.projectsOverBudget,
      icon: DollarSign,
      color: "text-cost-negative",
      bg: "bg-cost-negative/10",
      border: "border-cost-negative/40",
      dot: "💰",
      link: "/costs",
      cta: "Analizar",
    },
  ];

  const healthMeta =
    snapshot.healthLevel === "control"
      ? { label: "🟢 En control", color: "text-cost-positive", border: "border-cost-positive/40", bg: "from-cost-positive/15 to-transparent" }
      : snapshot.healthLevel === "risk"
      ? { label: "🟡 Riesgo", color: "text-cost-warning", border: "border-cost-warning/40", bg: "from-cost-warning/15 to-transparent" }
      : { label: "🔴 Crítico", color: "text-cost-negative", border: "border-cost-negative/40", bg: "from-cost-negative/20 to-transparent" };

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-base font-bold fire-text flex items-center gap-2">
            <Flame className="w-4 h-4 text-primary fire-icon" /> Estado General del Negocio
          </h2>
          <p className="text-[12px] text-muted-foreground">Todo lo que importa, en un vistazo</p>
        </div>
        <div className={cn("text-right px-3 py-2 rounded-lg border bg-gradient-to-r", healthMeta.border, healthMeta.bg)}>
          <div className={cn("text-sm font-bold", healthMeta.color)}>{healthMeta.label}</div>
          <div className="text-[10px] text-muted-foreground max-w-[260px] truncate" title={snapshot.healthReason}>
            {snapshot.healthReason}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => navigate(c.link)}
            className={cn(
              "surface-card surface-card-hover fire-glow-hover p-4 text-left relative overflow-hidden border-l-4 transition-sf group",
              c.border
            )}
          >
            <div className={cn("absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl", c.bg)} />
            <div className="relative space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xl">{c.dot}</span>
                <c.icon className={cn("w-4 h-4", c.color)} />
              </div>
              <div className={cn("text-3xl font-bold font-mono-data", c.color)}>{c.count}</div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold leading-tight">
                {c.label}
              </div>
              <div className={cn("inline-flex items-center gap-1 text-[11px] font-semibold pt-1", c.color)}>
                {c.cta} <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
