import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileBarChart2, Download, Filter, Lock, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/hooks/usePlan";
import { useMoney } from "@/lib/format-money";
import { useUserSettings } from "@/hooks/useUserSettings";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getExecutionStatus,
  getFinancialHealth,
  getProjectHealth,
} from "@/lib/business-intelligence";
import { toast } from "sonner";

/**
 * Informes ejecutivos corporativos (Plan Business)
 * Resumen consolidado + exportación PDF / Excel.
 */
export default function CorporateReportsPage() {
  const { user } = useAuth();
  const PEN = useMoney();
  const { settings } = useUserSettings();
  const { isBusiness, loading: planLoading } = usePlan();

  const [clientFilter, setClientFilter] = useState<string>("all");

  const { data: projects = [] } = useQuery({
    queryKey: ["corp-reports-projects"],
    enabled: !!user && isBusiness,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status, progress, budget, actual_cost, start_date, end_date, client_id, clients(name)");
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = useMemo(() => {
    return projects.filter((p) => clientFilter === "all" || p.client_id === clientFilter);
  }, [projects, clientFilter]);

  const clientsList = useMemo(() => {
    const m = new Map<string, string>();
    projects.forEach((p) => p.client_id && p.clients?.name && m.set(p.client_id, p.clients.name));
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [projects]);

  const rows = useMemo(() => {
    return filtered.map((p) => {
      const billed = Number(p.budget) || 0;
      const cost = Number(p.actual_cost) || 0;
      const profit = billed - cost;
      const margin = billed > 0 ? (profit / billed) * 100 : 0;
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
        status: p.status,
        progress: Number(p.progress) || 0,
        billed,
        cost,
        profit,
        margin,
        health,
      };
    });
  }, [filtered, settings]);

  const totals = useMemo(() => {
    const billed = rows.reduce((s, r) => s + r.billed, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    return { billed, cost, profit: billed - cost, margin: billed > 0 ? ((billed - cost) / billed) * 100 : 0 };
  }, [rows]);

  function exportCsv() {
    const header = ["Proyecto", "Cliente", "Estado", "Avance %", "Facturado", "Costado", "Ganancia", "Margen %", "Salud"];
    const lines = [
      header.join(","),
      ...rows.map((r) => [
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.client.replace(/"/g, '""')}"`,
        r.status,
        r.progress,
        r.billed.toFixed(2),
        r.cost.toFixed(2),
        r.profit.toFixed(2),
        r.margin.toFixed(2),
        r.health.label,
      ].join(",")),
      "",
      `Totales,,,,${totals.billed.toFixed(2)},${totals.cost.toFixed(2)},${totals.profit.toFixed(2)},${totals.margin.toFixed(2)},`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `informe-ejecutivo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel exportado");
  }

  function exportPdf() {
    // Solución sin librerías: usar la impresión nativa, optimizada para PDF.
    window.print();
    toast.info("Usa 'Guardar como PDF' en el diálogo de impresión");
  }

  if (!planLoading && !isBusiness) {
    return (
      <div className="surface-card p-10 text-center max-w-2xl mx-auto">
        <Lock className="w-10 h-10 text-primary mx-auto mb-4 fire-icon" />
        <h1 className="text-xl font-bold mb-2 fire-text">Informes ejecutivos</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Los informes consolidados y exportación PDF/Excel están disponibles solo en el plan <strong>Business</strong>.
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
    <div className="space-y-5 print:space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 fire-text">
            <FileBarChart2 className="w-5 h-5 text-primary fire-icon" />
            Informes ejecutivos
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Consolidado de toda la cartera · Exporta para gerencia
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button size="sm" variant="outline" onClick={exportCsv} className="h-8 text-xs">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={exportPdf} className="h-8 text-xs">
            <Download className="w-3.5 h-3.5 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiBlock label="Facturado total" value={PEN.format(totals.billed)} />
        <KpiBlock label="Costo total" value={PEN.format(totals.cost)} />
        <KpiBlock label="Ganancia neta" value={PEN.format(totals.profit)} tone={totals.profit >= 0 ? "positive" : "negative"} />
        <KpiBlock label="Margen consolidado" value={`${totals.margin.toFixed(1)}%`} tone={totals.margin >= 20 ? "positive" : totals.margin >= 0 ? "neutral" : "negative"} />
      </div>

      <Card className="surface-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Detalle por proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No hay proyectos con los filtros aplicados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="pb-2 pr-3">Proyecto</th>
                    <th className="pb-2 pr-3">Cliente</th>
                    <th className="pb-2 pr-3 text-right">Avance</th>
                    <th className="pb-2 pr-3 text-right">Facturado</th>
                    <th className="pb-2 pr-3 text-right">Costado</th>
                    <th className="pb-2 pr-3 text-right">Ganancia</th>
                    <th className="pb-2 pr-3 text-right">Margen</th>
                    <th className="pb-2 text-right">Salud</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/40">
                      <td className="py-2 pr-3 text-foreground">{r.name}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{r.client}</td>
                      <td className="py-2 pr-3 text-right font-mono-data">{r.progress}%</td>
                      <td className="py-2 pr-3 text-right font-mono-data">{PEN.format(r.billed)}</td>
                      <td className="py-2 pr-3 text-right font-mono-data">{PEN.format(r.cost)}</td>
                      <td className={cn(
                        "py-2 pr-3 text-right font-mono-data font-semibold",
                        r.profit >= 0 ? "text-cost-positive" : "text-cost-negative"
                      )}>
                        {PEN.format(r.profit)}
                      </td>
                      <td className={cn(
                        "py-2 pr-3 text-right font-mono-data",
                        r.margin >= 20 ? "text-cost-positive" : r.margin >= 0 ? "text-amber-400" : "text-cost-negative"
                      )}>
                        {r.margin.toFixed(0)}%
                      </td>
                      <td className="py-2 text-right">
                        <span className={cn("text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded", r.health.bg, r.health.color)}>
                          {r.health.emoji} {r.health.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="py-2 pr-3">Totales</td>
                    <td></td>
                    <td></td>
                    <td className="py-2 pr-3 text-right font-mono-data">{PEN.format(totals.billed)}</td>
                    <td className="py-2 pr-3 text-right font-mono-data">{PEN.format(totals.cost)}</td>
                    <td className={cn(
                      "py-2 pr-3 text-right font-mono-data",
                      totals.profit >= 0 ? "text-cost-positive" : "text-cost-negative"
                    )}>
                      {PEN.format(totals.profit)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono-data">{totals.margin.toFixed(1)}%</td>
                    <td></td>
                  </tr>
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
