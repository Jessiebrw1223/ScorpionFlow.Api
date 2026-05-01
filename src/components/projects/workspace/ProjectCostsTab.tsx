import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Pencil, Loader2, Users, Cpu, Wrench, Sparkles, Target, Clock, HandCoins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";
import ProjectContributionsSection from "./ProjectContributionsSection";
import { formatSafeMargin, formatROI, getFinancialHealth } from "@/lib/business-intelligence";
import { useMoney } from "@/lib/format-money";
import { useUserSettings } from "@/hooks/useUserSettings";

interface Props {
  project: any;
}

function timeAgo(ts: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 5) return "ahora mismo";
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

export default function ProjectCostsTab({ project }: Props) {
  const qc = useQueryClient();
  const PEN = useMoney();
  const { settings } = useUserSettings();
  const [open, setOpen] = useState(false);
  const [budget, setBudget] = useState(Number(project.budget));
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [, force] = useState(0);

  // Refresca el "hace X seg" cada 5s
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  // Tareas reales: para impacto cost + sumatoria de costos por tarea
  const { data: tasks = [] } = useQuery({
    queryKey: ["project-tasks-cost", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, impact, estimated_cost, actual_cost, node_type")
        .eq("project_id", project.id);
      if (error) throw error;
      return data as any[];
    },
  });

  // Recursos: FUENTE ÚNICA DE VERDAD para el desglose por categoría
  const { data: resources = [] } = useQuery({
    queryKey: ["project-resources", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_resources" as any)
        .select("kind, total_cost, status")
        .eq("project_id", project.id);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Aportes adicionales del propietario (no afectan actual_cost; sí ganancia real)
  const { data: contributions = [] } = useQuery({
    queryKey: ["project-contributions", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_contributions")
        .select("amount")
        .eq("project_id", project.id);
      if (error) throw error;
      return data;
    },
  });
  const totalContributions = contributions.reduce((s, c: any) => s + Number(c.amount || 0), 0);

  // === Desglose REAL desde project_resources (sin valores mágicos) ===
  const breakdown = useMemo(() => {
    const sum = (kind: string) =>
      resources
        .filter((r: any) => r.kind === kind && r.status === "active")
        .reduce((s: number, r: any) => s + Number(r.total_cost || 0), 0);
    return {
      personnel: sum("human"),
      tech: sum("tech"),
      operations: sum("asset"),
    };
  }, [resources]);

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projects")
        .update({ budget })
        .eq("id", project.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setLastUpdate(Date.now());
      toast.success("Presupuesto actualizado");
      setOpen(false);
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  // Live data desde el proyecto en BD (actual_cost = recursos + tasks vía trigger)
  const liveTotal = Number(project.actual_cost);
  const liveProfit = Number(project.budget) - liveTotal;
  const liveMargin = Number(project.budget) > 0 ? (liveProfit / Number(project.budget)) * 100 : 0;
  const liveLosing = liveProfit < 0;
  const usedPct = Number(project.budget) > 0 ? Math.min(100, (liveTotal / Number(project.budget)) * 100) : 0;

  // ROI con cap visual humanizado
  const roi = formatROI(Number(project.budget), liveTotal);

  // Live financials con aportes
  const liveProfitWithContrib = liveProfit - totalContributions;
  const liveMarginWithContrib = Number(project.budget) > 0 ? (liveProfitWithContrib / Number(project.budget)) * 100 : 0;
  const realLosing = liveProfitWithContrib < 0;
  const safeMargin = formatSafeMargin(liveMarginWithContrib);

  // Salud financiera (estado dual)
  const financialHealth = getFinancialHealth({
    budget: Number(project.budget),
    actualCost: liveTotal,
    contributions: totalContributions,
  });

  // Suma de costos por tarea (diferencial)
  const taskEstimated = tasks.reduce((s, t) => s + Number(t.estimated_cost || 0), 0);
  const taskActual = tasks.reduce((s, t) => s + Number(t.actual_cost || 0), 0);
  const topCostTasks = [...tasks]
    .filter((t) => Number(t.actual_cost) > 0 || Number(t.estimated_cost) > 0)
    .sort((a, b) => Number(b.actual_cost || b.estimated_cost) - Number(a.actual_cost || a.estimated_cost))
    .slice(0, 5);

  // Proyección final
  const progress = Number(project.progress) || 0;
  const projectedTotal = progress > 0 ? (liveTotal / progress) * 100 : liveTotal;
  const projectedProfit = Number(project.budget) - projectedTotal;
  const projectedMargin = Number(project.budget) > 0 ? (projectedProfit / Number(project.budget)) * 100 : 0;
  const safeProjMargin = formatSafeMargin(projectedMargin);
  const projectionTone = projectedProfit < 0 ? "bad" : projectedMargin >= 20 ? "good" : "warn";

  const costImpactTasks = tasks.filter((t) => t.impact === "cost").length;

  // Preview en dialog
  const previewProfit = budget - liveTotal;
  const previewMargin = budget > 0 ? (previewProfit / budget) * 100 : 0;
  const previewSafe = formatSafeMargin(previewMargin);
  const previewLosing = previewProfit < 0;

  const categories = useMemo(() => [
    {
      key: "personnel" as const,
      icon: Users,
      label: "Personal",
      description: "Personas asignadas a tareas",
      value: breakdown.personnel,
      color: "border-status-progress",
      iconBg: "bg-status-progress/15 text-status-progress",
      emptyHint: "Asigna responsables y costos en Recursos",
    },
    {
      key: "tech" as const,
      icon: Cpu,
      label: "Tecnología",
      description: "Software, licencias, hosting",
      value: breakdown.tech,
      color: "border-primary",
      iconBg: "bg-primary/15 text-primary",
      emptyHint: "No has configurado recursos tecnológicos",
    },
    {
      key: "operations" as const,
      icon: Wrench,
      label: "Activos / Operativos",
      description: "Equipos, materiales, logística",
      value: breakdown.operations,
      color: "border-cost-warning",
      iconBg: "bg-cost-warning/15 text-cost-warning",
      emptyHint: "No has registrado activos ni operativos",
    },
  ], [breakdown]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Finanzas del proyecto</h2>
          <p className="text-[12px] text-muted-foreground inline-flex items-center gap-2">
            <Clock className="w-3 h-3" /> Actualizado {timeAgo(lastUpdate)} · datos sincronizados
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => {
          setOpen(v);
          if (v) setBudget(Number(project.budget));
        }}>
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Pencil className="w-3.5 h-3.5" /> Editar presupuesto
          </Button>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar presupuesto del cliente</DialogTitle>
              <p className="text-[12px] text-muted-foreground">
                Solo el monto que cobraste al cliente. Los costos se calculan automáticamente desde Recursos y tareas.
              </p>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Presupuesto (lo que cobré)</Label>
                <CurrencyInput value={budget} onValueChange={setBudget} />
              </div>
              <div className={cn("surface-card p-3", previewLosing ? "border-cost-negative/40 bg-cost-negative/5" : "border-cost-positive/40 bg-cost-positive/5")}>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Ganancia con el nuevo presupuesto</div>
                <div className={cn("text-xl font-bold font-mono-data", previewLosing ? "text-cost-negative" : "text-cost-positive")}>
                  {previewProfit >= 0 ? "+" : ""}{PEN.format(previewProfit)} ({previewSafe.text})
                </div>
                {previewSafe.isExtreme && (
                  <p className="text-[11px] text-cost-negative mt-1">{previewSafe.text}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => update.mutate()} disabled={update.isPending} className="fire-button">
                {update.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* === Banner sugerencia aporte cuando gasto > presupuesto === */}
      {liveLosing && totalContributions === 0 && Number(project.budget) > 0 && (
        <div className="surface-card border border-primary/40 bg-primary/5 p-4 flex items-start gap-3">
          <HandCoins className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-foreground text-sm">Este proyecto está excediendo el presupuesto</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Llevas {PEN.format(Math.abs(liveProfit))} por encima. Si pusiste dinero propio para continuar, regístralo como aporte para reflejar tu ganancia real.
            </p>
          </div>
        </div>
      )}

      {/* === SIN DATOS: estado resiliente cuando no hay presupuesto NI costos === */}
      {Number(project.budget) === 0 && liveTotal === 0 ? (
        <div className="surface-card p-6 border-l-4 border-muted/40 bg-muted/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Sin datos financieros configurados</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Define el presupuesto que cobraste al cliente y registra recursos en la pestaña <span className="text-foreground font-medium">Recursos</span> para ver tu ganancia real aquí.
              </p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(true)}>
                <Pencil className="w-3.5 h-3.5" /> Configurar presupuesto
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* === Big number: GANANCIA REAL con badge de salud financiera === */
        <div className={cn("surface-card p-6 border-l-4", financialHealth.border)}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Ganancia real (hoy){totalContributions > 0 && " · descontando tu aporte"}
                </span>
                <span className={cn("text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded inline-flex items-center gap-1", financialHealth.bg, financialHealth.color)}>
                  {financialHealth.emoji} {financialHealth.label}
                </span>
              </div>
              <div className={cn("text-4xl font-bold font-mono-data", realLosing ? "text-cost-negative" : "text-cost-positive")}>
                {liveProfitWithContrib >= 0 ? "+" : ""}{PEN.format(liveProfitWithContrib)}
              </div>
              <div className="text-[13px] text-muted-foreground mt-1">
                {safeMargin.isExtreme ? (
                  <span className="text-cost-negative font-medium">{safeMargin.text}</span>
                ) : (
                  <>
                    Margen real: <span className={cn("font-mono-data font-semibold", liveMarginWithContrib >= 20 ? "text-cost-positive" : liveMarginWithContrib >= 0 ? "text-cost-warning" : "text-cost-negative")}>
                      {safeMargin.text}
                    </span>
                    {" · "}
                    {financialHealth.description}
                  </>
                )}
              </div>
              {totalContributions > 0 && (
                <div className="text-[11px] text-primary mt-1 inline-flex items-center gap-1">
                  <HandCoins className="w-3 h-3" /> Incluye {PEN.format(totalContributions)} de aporte propio descontado
                </div>
              )}
            </div>
            {realLosing ? (
              <TrendingDown className="w-12 h-12 text-cost-negative" />
            ) : (
              <TrendingUp className="w-12 h-12 text-cost-positive fire-icon" />
            )}
          </div>
        </div>
      )}

      {/* === Tarjetas simplificadas: ROI + Proyección final === */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={cn(
          "surface-card p-4 border-l-4",
          roi.tone === "good" ? "border-cost-positive" : roi.tone === "bad" ? "border-cost-negative" : roi.tone === "warn" ? "border-cost-warning" : "border-status-progress"
        )}>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5 text-status-progress" /> Retorno sobre tu inversión
          </div>
          <div className={cn(
            "text-lg font-bold font-mono-data mt-1",
            roi.tone === "bad" ? "text-cost-negative" : roi.tone === "good" ? "text-cost-positive" : "text-foreground"
          )}>{roi.text}</div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {roi.tone === "good" && "Buena rentabilidad por cada sol invertido."}
            {roi.tone === "warn" && "Recuperas la inversión, pero el margen es ajustado."}
            {roi.tone === "bad" && "Estás perdiendo dinero por cada sol invertido."}
            {roi.tone === "neutral" && "Cuando registres gastos verás tu ROI aquí."}
          </p>
        </div>

        <div className={cn(
          "surface-card p-4 border-l-4",
          projectionTone === "bad" ? "border-cost-negative" : projectionTone === "warn" ? "border-cost-warning" : "border-cost-positive"
        )}>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            <Target className="w-3.5 h-3.5" /> Si todo sigue así, terminarás con:
          </div>
          {progress === 0 ? (
            <div className="text-[13px] text-muted-foreground mt-2">
              Avanza el proyecto para ver la proyección final.
            </div>
          ) : (
            <>
              <div className={cn(
                "text-xl font-bold font-mono-data mt-1",
                projectionTone === "bad" ? "text-cost-negative" : projectionTone === "warn" ? "text-cost-warning" : "text-cost-positive"
              )}>
                {safeProjMargin.isExtreme ? (
                  <span className="text-base">{safeProjMargin.text}</span>
                ) : (
                  <>{projectedProfit >= 0 ? "+" : ""}{PEN.format(projectedProfit)} ({safeProjMargin.text})</>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Basado en tu avance actual ({progress}%). Costo proyectado: {PEN.format(projectedTotal)}.
              </p>
            </>
          )}
        </div>
      </div>

      {/* === Clasificación de costos (derivada de Recursos) === */}
      <div>
        <h3 className="section-header mb-2 inline-flex items-center gap-1.5">
          Costos por categoría
          <span className="text-[10px] font-normal text-muted-foreground normal-case tracking-normal">
            · viene de Recursos
          </span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {categories.map((c) => {
            const pct = liveTotal > 0 ? (c.value / liveTotal) * 100 : 0;
            const Icon = c.icon;
            const empty = c.value === 0;
            return (
              <div key={c.key} className={cn("surface-card p-4 border-l-4", empty ? "border-border" : c.color)}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", c.iconBg)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold">{c.label}</div>
                    <div className="text-[10px] text-muted-foreground">{c.description}</div>
                  </div>
                </div>
                {empty ? (
                  <div className="text-[12px] text-muted-foreground italic">{c.emptyHint}</div>
                ) : (
                  <>
                    <div className="text-xl font-bold font-mono-data">{PEN.format(c.value)}</div>
                    <div className="text-[11px] text-muted-foreground font-mono-data mt-0.5">
                      {pct.toFixed(0)}% del gasto total
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {taskActual > 0 && (
          <p className="text-[11px] text-muted-foreground mt-2">
            + {PEN.format(taskActual)} de costos directos registrados en tareas individuales.
          </p>
        )}
      </div>

      {/* === Resumen presupuesto: 4 conceptos clave === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="surface-card p-4 border-l-4 border-status-progress">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Presupuesto cliente</div>
          {Number(project.budget) > 0 ? (
            <>
              <div className="text-lg font-bold font-mono-data">{PEN.format(Number(project.budget))}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Lo que cobraste</div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-muted-foreground italic mt-0.5">No definido</div>
              <button onClick={() => setOpen(true)} className="text-[10px] text-primary hover:underline mt-0.5">
                Configurar →
              </button>
            </>
          )}
        </div>
        <div className="surface-card p-4 border-l-4 border-cost-warning">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total gastado</div>
          {liveTotal > 0 ? (
            <>
              <div className={cn("text-lg font-bold font-mono-data", liveLosing && "text-cost-negative")}>
                {PEN.format(liveTotal)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {Number(project.budget) > 0 ? `${usedPct.toFixed(0)}% del presupuesto` : "Sin presupuesto de referencia"}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-muted-foreground italic mt-0.5">Sin recursos</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Configura recursos primero</div>
            </>
          )}
        </div>
        <div className={cn("surface-card p-4 border-l-4", totalContributions > 0 ? "border-primary bg-primary/5" : "border-border")}>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
            <HandCoins className="w-3 h-3" /> Aporte adicional
          </div>
          <div className={cn("text-lg font-bold font-mono-data", totalContributions > 0 ? "text-primary" : "text-muted-foreground")}>
            {PEN.format(totalContributions)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {totalContributions > 0 ? "Inversión tuya" : "Sin aportes"}
          </div>
        </div>
        <div className={cn("surface-card p-4 border-l-4", realLosing ? "border-cost-negative" : "border-cost-positive")}>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Ganancia real</div>
          <div className={cn("text-lg font-bold font-mono-data", realLosing ? "text-cost-negative" : "text-cost-positive")}>
            {liveProfitWithContrib >= 0 ? "+" : ""}{PEN.format(liveProfitWithContrib)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Tu ganancia neta</div>
        </div>
      </div>

      {/* === Sección de aportes adicionales === */}
      <ProjectContributionsSection
        projectId={project.id}
        budget={Number(project.budget)}
        actualCost={liveTotal}
      />

      {/* === Progress bar === */}
      <div className="surface-card p-4">
        <div className="flex items-center justify-between text-[12px] mb-2">
          <span className="text-muted-foreground">
            Gastado <span className="font-mono-data text-foreground">{PEN.format(liveTotal)}</span> de{" "}
            <span className="font-mono-data text-foreground">{PEN.format(Number(project.budget))}</span>
          </span>
          <span className={cn("font-mono-data font-semibold", liveLosing ? "text-cost-negative" : "text-muted-foreground")}>
            {usedPct.toFixed(0)}%
          </span>
        </div>
        <Progress value={usedPct} className={cn("h-3", liveLosing && "[&>div]:bg-cost-negative")} />
        {costImpactTasks > 0 && (
          <p className="text-[11px] text-muted-foreground mt-2">
            💰 {costImpactTasks} tarea(s) marcadas con impacto en costo — vigila su ejecución.
          </p>
        )}
      </div>

      {/* === DIFERENCIAL: costos por tarea === */}
      {(taskEstimated > 0 || taskActual > 0) && (
        <div className="surface-card p-4">
          <h3 className="section-header mb-3 inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Costo por tarea
            <span className="ml-2 text-[10px] font-normal text-muted-foreground normal-case tracking-normal">
              Estimado: {PEN.format(taskEstimated)} · Real: {PEN.format(taskActual)}
            </span>
          </h3>
          {topCostTasks.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">
              Asigna costos en las tareas (panel lateral) para ver dónde se va el dinero.
            </p>
          ) : (
            <div className="space-y-1.5">
              {topCostTasks.map((t) => {
                const overrun = Number(t.actual_cost) > Number(t.estimated_cost) && Number(t.estimated_cost) > 0;
                return (
                  <div key={t.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0 text-[12px]">
                    <span className="truncate flex-1">{t.title}</span>
                    <span className="font-mono-data text-muted-foreground">est. {PEN.format(Number(t.estimated_cost) || 0)}</span>
                    <span className={cn("font-mono-data font-semibold", overrun ? "text-cost-negative" : "text-foreground")}>
                      {PEN.format(Number(t.actual_cost) || 0)}
                    </span>
                    {overrun && <AlertTriangle className="w-3 h-3 text-cost-negative shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {liveLosing && (
        <div className="surface-card border border-cost-negative/40 bg-cost-negative/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-cost-negative shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-foreground text-sm">Has gastado más de lo cobrado</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Estás {PEN.format(Math.abs(liveProfit))} por debajo. Revisa qué categoría se disparó y ajusta partidas o renegocia el alcance.
            </p>
          </div>
        </div>
      )}
      {!liveLosing && liveMargin < 15 && Number(project.budget) > 0 && (
        <div className="surface-card border border-cost-warning/40 bg-cost-warning/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-cost-warning shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-foreground text-sm">Margen por debajo del 15%</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Tu rentabilidad está apretada. Cuida los costos restantes para no entrar en pérdida.
            </p>
          </div>
        </div>
      )}
      {!liveLosing && liveMargin >= 30 && (
        <div className="surface-card border border-cost-positive/40 bg-cost-positive/5 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-cost-positive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-foreground text-sm">Excelente margen ({liveMargin.toFixed(0)}%)</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Este proyecto está dejando muy buena rentabilidad. Buen modelo a replicar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
