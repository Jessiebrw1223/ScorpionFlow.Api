import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, Filter, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/hooks/usePlan";
import { useMoney } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Recursos y Costos corporativos (Plan Business)
 * Muestra recursos consolidados de todos los proyectos, saturación y costo.
 */
export default function CorporateResourcesPage() {
  const { user } = useAuth();
  const PEN = useMoney();
  const { isBusiness, loading: planLoading } = usePlan();

  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");

  const { data: projects = [] } = useQuery({
    queryKey: ["corp-resources-projects"],
    enabled: !!user && isBusiness,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status");
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
        .select("id, name, role_or_type, kind, unit, unit_cost, quantity, total_cost, status, project_id")
        .eq("status", "active");
      if (error) throw error;
      return data as any[];
    },
  });

  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    projects.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [projects]);

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      if (projectFilter !== "all" && r.project_id !== projectFilter) return false;
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      return true;
    });
  }, [resources, projectFilter, kindFilter]);

  // Agregación por nombre+rol (un mismo recurso puede estar en varios proyectos)
  const aggregated = useMemo(() => {
    const m = new Map<string, {
      name: string;
      role: string;
      kind: string;
      totalQty: number;
      totalCost: number;
      projects: Set<string>;
    }>();
    filtered.forEach((r) => {
      const key = `${(r.name || "").toLowerCase()}::${(r.role_or_type || "").toLowerCase()}`;
      const cur = m.get(key) ?? {
        name: r.name,
        role: r.role_or_type || "—",
        kind: r.kind,
        totalQty: 0,
        totalCost: 0,
        projects: new Set<string>(),
      };
      cur.totalQty += Number(r.quantity) || 0;
      cur.totalCost += Number(r.total_cost) || 0;
      if (r.project_id) cur.projects.add(r.project_id);
      m.set(key, cur);
    });
    const arr = Array.from(m.values()).sort((a, b) => b.totalCost - a.totalCost);
    const maxQty = Math.max(1, ...arr.map((x) => x.totalQty));
    return arr.map((x) => ({
      ...x,
      saturation: Math.min(100, Math.round((x.totalQty / maxQty) * 100)),
    }));
  }, [filtered]);

  const totals = useMemo(() => {
    const totalCost = filtered.reduce((s, r) => s + (Number(r.total_cost) || 0), 0);
    const totalUnits = filtered.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    return { totalCost, totalUnits, count: filtered.length };
  }, [filtered]);

  if (!planLoading && !isBusiness) {
    return (
      <div className="surface-card p-10 text-center max-w-2xl mx-auto">
        <Lock className="w-10 h-10 text-primary mx-auto mb-4 fire-icon" />
        <h1 className="text-xl font-bold mb-2 fire-text">Recursos corporativos</h1>
        <p className="text-sm text-muted-foreground mb-6">
          La vista global de recursos y saturación del equipo está disponible solo en el plan <strong>Business</strong>.
        </p>
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-sf"
        >
          Actualizar a Business
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 fire-text">
            <Users className="w-5 h-5 text-primary fire-icon" />
            Recursos y Costos · Visión global
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Consolidado de recursos activos en todos los proyectos
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Proyecto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proyectos</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="personnel">Personal</SelectItem>
              <SelectItem value="machinery">Maquinaria</SelectItem>
              <SelectItem value="tech">Tecnología</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <KpiBlock label="Recursos activos" value={String(totals.count)} />
        <KpiBlock label="Unidades / horas totales" value={totals.totalUnits.toFixed(1)} />
        <KpiBlock label="Costo total consolidado" value={PEN.format(totals.totalCost)} tone="negative" />
      </div>

      <Card className="surface-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Saturación y costo por recurso</CardTitle>
        </CardHeader>
        <CardContent>
          {aggregated.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              Aún no hay recursos asignados. Agrégalos desde el módulo Recursos de cada proyecto.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="pb-2 pr-3">Recurso</th>
                    <th className="pb-2 pr-3">Rol / Tipo</th>
                    <th className="pb-2 pr-3 text-right">Horas / Uds</th>
                    <th className="pb-2 pr-3 text-right">Costo total</th>
                    <th className="pb-2 pr-3">Saturación</th>
                    <th className="pb-2 text-right">Proyectos</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregated.map((r, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-secondary/30 transition-sf">
                      <td className="py-2 pr-3 text-foreground">{r.name}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{r.role}</td>
                      <td className="py-2 pr-3 text-right font-mono-data">{r.totalQty.toFixed(1)}</td>
                      <td className="py-2 pr-3 text-right font-mono-data">{PEN.format(r.totalCost)}</td>
                      <td className="py-2 pr-3 w-[160px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                r.saturation >= 85 ? "bg-cost-negative" : r.saturation >= 60 ? "bg-amber-400" : "bg-cost-positive"
                              )}
                              style={{ width: `${r.saturation}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono-data text-muted-foreground w-8 text-right">
                            {r.saturation}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex flex-wrap gap-1 justify-end">
                          {Array.from(r.projects).slice(0, 2).map((pid) => (
                            <Link
                              key={pid}
                              to={`/projects/${pid}`}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground hover:text-primary truncate max-w-[100px]"
                            >
                              {projectMap.get(pid) || "—"}
                            </Link>
                          ))}
                          {r.projects.size > 2 && (
                            <span className="text-[10px] text-muted-foreground">+{r.projects.size - 2}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiBlock({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "negative" | "positive" }) {
  const toneClass = tone === "negative" ? "text-cost-negative" : tone === "positive" ? "text-cost-positive" : "text-foreground";
  return (
    <div className="surface-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-base font-bold font-mono-data", toneClass)}>{value}</div>
    </div>
  );
}
