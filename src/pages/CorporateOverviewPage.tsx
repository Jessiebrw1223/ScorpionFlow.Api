import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  AlertTriangle,
  Briefcase,
  Wallet,
  Filter,
  Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/hooks/usePlan";
import { useMoney } from "@/lib/format-money";
import { useUserSettings } from "@/hooks/useUserSettings";
import { cn } from "@/lib/utils";
import {
  getExecutionStatus,
  getFinancialHealth,
  getProjectHealth,
} from "@/lib/business-intelligence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UpsellDialog } from "@/components/billing/UpsellDialog";
import { ExecutiveAnalytics } from "@/components/corporate/ExecutiveAnalytics";

/**
 * Centro Financiero Corporativo (Plan Business)
 * Vista global del negocio: resumen ejecutivo, rentabilidad por proyecto,
 * forecast de cobros y alertas críticas. NO entra a un proyecto individual.
 */
export default function CorporateOverviewPage() {
  const { user } = useAuth();
  const PEN = useMoney();
  const { settings } = useUserSettings();
  const { isBusiness, loading: planLoading } = usePlan();

  const [clientFilter, setClientFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  // === Data fetching ===
  const { data: projects = [] } = useQuery({
    queryKey: ["corp-projects"],
    enabled: !!user && isBusiness,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, name, status, progress, budget, actual_cost, currency, start_date, end_date, client_id, clients(name), created_at"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ["corp-quotations"],
    enabled: !!user && isBusiness,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select("id, title, status, total, status_changed_at, close_probability, client_id, clients(name)");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["corp-tasks"],
    enabled: !!user && isBusiness,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, project_id, blocks_project");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: resources = [] } = useQuery({
    queryKey: ["corp-resources"],
    enabled: !!user && isBusiness,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_resources")
        .select("id, project_id, kind, name, role_or_type, quantity, unit_cost, total_cost, status");
      if (error) throw error;
      return data as any[];
    },
  });

  // === Filters ===
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (clientFilter !== "all" && p.client_id !== clientFilter) return false;
      if (monthFilter !== "all" && p.created_at) {
        const m = new Date(p.created_at).toISOString().slice(0, 7);
        if (m !== monthFilter) return false;
      }
      return true;
    });
  }, [projects, clientFilter, monthFilter]);

  const clientsList = useMemo(() => {
    const m = new Map<string, string>();
    projects.forEach((p) => {
      if (p.client_id && p.clients?.name) m.set(p.client_id, p.clients.name);
    });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [projects]);

  const monthsList = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.created_at) set.add(new Date(p.created_at).toISOString().slice(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [projects]);

  // === Executive Summary metrics ===
  const summary = useMemo(() => {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const next30 = now.getTime() + 30 * 86400000;

    let income = 0;
    let costs = 0;
    let activeProjects = 0;
    let expectedFlow = 0;

    filteredProjects.forEach((p) => {
      const budget = Number(p.budget) || 0;
      const cost = Number(p.actual_cost) || 0;
      const created = p.created_at ? new Date(p.created_at).getTime() : 0;
      if (created >= startMonth) {
        income += budget;
        costs += cost;
      }
      if (p.status === "on_track" || p.status === "at_risk" || p.status === "over_budget") {
        activeProjects++;
        // Forecast: presupuesto pendiente de cobrar (lo no facturado aún)
        const pending = Math.max(0, budget - cost);
        if (p.end_date) {
          const end = new Date(p.end_date).getTime();
          if (end <= next30) expectedFlow += pending;
        }
      }
    });

    const profit = income - costs;
    const margin = income > 0 ? (profit / income) * 100 : 0;
    return { income, costs, profit, margin, activeProjects, expectedFlow };
  }, [filteredProjects]);

  // === Profitability table ===
  const profitability = useMemo(() => {
    return filteredProjects
      .map((p) => {
        const billed = Number(p.budget) || 0;
        const cost = Number(p.actual_cost) || 0;
        const profit = billed - cost;
        const marginPct = billed > 0 ? (profit / billed) * 100 : 0;
        const exec = getExecutionStatus({
          status: p.status,
          startDate: p.start_date,
          endDate: p.end_date,
          progress: Number(p.progress) || 0,
          inferSchedule: settings.auto_behavior.inferSchedule,
        });
        const fin = getFinancialHealth({
          budget: billed,
          actualCost: cost,
          targetMargin: settings.target_margin,
        });
        const health = getProjectHealth({ execution: exec, financial: fin });
        return {
          id: p.id,
          name: p.name,
          client: p.clients?.name || "Sin cliente",
          billed,
          cost,
          profit,
          marginPct,
          health,
        };
      })
      .sort((a, b) => a.profit - b.profit); // peores primero
  }, [filteredProjects, settings]);

  // === Forecast ===
  const forecast = useMemo(() => {
    const pendingCharges = filteredProjects
      .filter((p) => Number(p.budget) > Number(p.actual_cost) && p.status !== "completed")
      .reduce((s, p) => s + (Number(p.budget) - Number(p.actual_cost)), 0);

    const probableQuotes = quotations.filter(
      (q) => ["pending", "in_contact", "quoted"].includes(q.status) && (q.close_probability ?? 50) >= 60
    );
    const probableIncome = probableQuotes.reduce(
      (s, q) => s + Number(q.total) * ((q.close_probability ?? 50) / 100),
      0
    );

    return {
      pendingCharges,
      probableIncome,
      probableQuotes,
    };
  }, [filteredProjects, quotations]);

  // === Critical alerts ===
  const alerts = useMemo(() => {
    const list: { type: string; label: string; severity: "high" | "medium"; projectId?: string; projectName?: string }[] = [];
    profitability.forEach((p) => {
      if (p.profit < 0) {
        list.push({
          type: "loss",
          label: `${p.name}: pérdida de ${PEN.format(Math.abs(p.profit))}`,
          severity: "high",
          projectId: p.id,
          projectName: p.name,
        });
      } else if (p.marginPct > 0 && p.marginPct < 10) {
        list.push({
          type: "low_margin",
          label: `${p.name}: margen crítico ${p.marginPct.toFixed(0)}%`,
          severity: "medium",
          projectId: p.id,
          projectName: p.name,
        });
      }
    });
    // Tareas bloqueantes activas
    const blockingByProject = new Map<string, number>();
    tasks.forEach((t) => {
      if (t.blocks_project && t.status === "blocked") {
        blockingByProject.set(t.project_id, (blockingByProject.get(t.project_id) ?? 0) + 1);
      }
    });
    blockingByProject.forEach((count, pid) => {
      const proj = filteredProjects.find((p) => p.id === pid);
      if (proj) {
        list.push({
          type: "blocked",
          label: `${proj.name}: ${count} tarea(s) bloqueante(s)`,
          severity: "medium",
          projectId: pid,
          projectName: proj.name,
        });
      }
    });
    return list.slice(0, 8);
  }, [profitability, tasks, filteredProjects, PEN]);

  // === Plan gate ===
  if (!planLoading && !isBusiness) {
    return (
      <div className="space-y-6">
        <div className="surface-card p-10 text-center max-w-2xl mx-auto">
          <Lock className="w-10 h-10 text-primary mx-auto mb-4 fire-icon" />
          <h1 className="text-xl font-bold mb-2 fire-text">Centro Financiero Corporativo</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Esta vista global de negocio (rentabilidad por proyecto, forecast de cobros, alertas críticas y reportes ejecutivos) está disponible solo en el plan <strong>Business</strong>.
          </p>
          <UpsellDialog open={false} onOpenChange={() => {}} feature="executive_dashboard" />
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-sf"
          >
            Actualizar a Business
          </Link>
        </div>
      </div>
    );
  }

  const profitPositive = summary.profit >= 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 fire-text">
            <Building2 className="w-5 h-5 text-primary fire-icon" />
            Centro Financiero Corporativo
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Visión global del negocio · Decisiones rápidas · Plan Business
          </p>
        </div>

        {/* Filtros globales */}
        <div className="flex items-center gap-2 text-[12px]">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clientsList.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Mes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el periodo</SelectItem>
              {monthsList.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* === Resumen Ejecutivo === */}
      <div>
        <h2 className="section-header mb-2">Resumen ejecutivo</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <ExecKpi
            icon={<TrendingUp className="w-4 h-4" />}
            label="Ingresos del mes"
            value={PEN.format(summary.income)}
            tone="neutral"
          />
          <ExecKpi
            icon={<Wallet className="w-4 h-4" />}
            label="Costos del mes"
            value={PEN.format(summary.costs)}
            tone="neutral"
          />
          <ExecKpi
            icon={profitPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            label="Ganancia neta"
            value={PEN.format(summary.profit)}
            tone={profitPositive ? "positive" : "negative"}
          />
          <ExecKpi
            icon={<Activity className="w-4 h-4" />}
            label="Margen"
            value={`${summary.margin.toFixed(1)}%`}
            tone={summary.margin >= 20 ? "positive" : summary.margin >= 10 ? "neutral" : "negative"}
          />
          <ExecKpi
            icon={<Briefcase className="w-4 h-4" />}
            label="Proyectos activos"
            value={String(summary.activeProjects)}
            tone="neutral"
          />
          <ExecKpi
            icon={<DollarSign className="w-4 h-4" />}
            label="Flujo esperado 30 días"
            value={PEN.format(summary.expectedFlow)}
            tone="neutral"
          />
        </div>
      </div>

      {/* === Rentabilidad por proyecto === */}
      <Card className="surface-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Rentabilidad por proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          {profitability.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No hay proyectos para los filtros aplicados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="pb-2 pr-3">Proyecto</th>
                    <th className="pb-2 pr-3">Cliente</th>
                    <th className="pb-2 pr-3 text-right">Facturado</th>
                    <th className="pb-2 pr-3 text-right">Costado</th>
                    <th className="pb-2 pr-3 text-right">Ganancia</th>
                    <th className="pb-2 pr-3 text-right">Margen</th>
                    <th className="pb-2 text-right">Riesgo</th>
                  </tr>
                </thead>
                <tbody>
                  {profitability.map((p) => (
                    <tr key={p.id} className="border-b border-border/40 hover:bg-secondary/30 transition-sf">
                      <td className="py-2 pr-3">
                        <Link to={`/projects/${p.id}`} className="hover:underline text-foreground">
                          {p.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground truncate max-w-[160px]">{p.client}</td>
                      <td className="py-2 pr-3 text-right font-mono-data">{PEN.format(p.billed)}</td>
                      <td className="py-2 pr-3 text-right font-mono-data">{PEN.format(p.cost)}</td>
                      <td className={cn(
                        "py-2 pr-3 text-right font-mono-data font-semibold",
                        p.profit >= 0 ? "text-cost-positive" : "text-cost-negative"
                      )}>
                        {p.profit >= 0 ? "+" : ""}{PEN.format(p.profit)}
                      </td>
                      <td className={cn(
                        "py-2 pr-3 text-right font-mono-data",
                        p.marginPct >= 20 ? "text-cost-positive" : p.marginPct >= 0 ? "text-amber-400" : "text-cost-negative"
                      )}>
                        {p.marginPct.toFixed(0)}%
                      </td>
                      <td className="py-2 text-right">
                        <span className={cn("text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded", p.health.bg, p.health.color)}>
                          {p.health.emoji} {p.health.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* === Forecast === */}
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Forecast comercial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40">
              <span className="text-xs text-muted-foreground">Cobros pendientes (proyectos)</span>
              <span className="text-sm font-semibold font-mono-data text-foreground">
                {PEN.format(forecast.pendingCharges)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40">
              <span className="text-xs text-muted-foreground">Ingresos probables (cotizaciones &gt;60%)</span>
              <span className="text-sm font-semibold font-mono-data text-cost-positive">
                {PEN.format(forecast.probableIncome)}
              </span>
            </div>
            <div className="pt-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Cotizaciones con alta probabilidad
              </div>
              {forecast.probableQuotes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Aún no hay oportunidades calientes.</p>
              ) : (
                <div className="space-y-1">
                  {forecast.probableQuotes.slice(0, 5).map((q) => (
                    <Link
                      key={q.id}
                      to="/cotizaciones"
                      className="flex items-center justify-between p-2 rounded hover:bg-secondary/40 transition-sf"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-foreground truncate">{q.title}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {q.clients?.name || "Sin cliente"} · {q.close_probability ?? 50}% prob.
                        </div>
                      </div>
                      <span className="text-xs font-mono-data text-foreground">{PEN.format(q.total)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* === Alertas críticas === */}
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Alertas críticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Sin alertas críticas. Todo bajo control.
              </p>
            ) : (
              <div className="space-y-1.5">
                {alerts.map((a, i) => (
                  <Link
                    key={i}
                    to={a.projectId ? `/projects/${a.projectId}` : "/projects"}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded text-xs transition-sf hover:bg-secondary/40",
                      a.severity === "high" ? "border-l-2 border-cost-negative" : "border-l-2 border-amber-400"
                    )}
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] uppercase tracking-wider px-1.5 py-0",
                        a.severity === "high" ? "border-cost-negative text-cost-negative" : "border-amber-400 text-amber-400"
                      )}
                    >
                      {a.type === "loss" ? "Pérdida" : a.type === "low_margin" ? "Margen" : "Bloqueo"}
                    </Badge>
                    <span className="text-foreground/90 truncate">{a.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* === Analítica visual ejecutiva === */}
      <ExecutiveAnalytics
        projects={filteredProjects as any}
        resources={resources as any}
        quotations={quotations as any}
      />

      <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground pt-1">
        <Link to="/reports" className="hover:text-primary hover:underline">Ver informes ejecutivos →</Link>
        <span>·</span>
        <Link to="/resources" className="hover:text-primary hover:underline">Ver recursos y costos →</Link>
      </div>
    </div>
  );
}

function ExecKpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive" ? "text-cost-positive" : tone === "negative" ? "text-cost-negative" : "text-foreground";
  return (
    <div className="surface-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        <span className={toneClass}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className={cn("text-base font-bold font-mono-data leading-tight", toneClass)}>{value}</div>
    </div>
  );
}
