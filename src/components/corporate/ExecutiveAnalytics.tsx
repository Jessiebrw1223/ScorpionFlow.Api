import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import {
  Activity,
  TrendingUp,
  Wallet,
  Users,
  Crown,
  LineChart as LineChartIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMoney } from "@/lib/format-money";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  status: string;
  progress: number | null;
  budget: number | string | null;
  actual_cost: number | string | null;
  start_date: string | null;
  end_date: string | null;
  client_id: string | null;
  clients?: { name?: string } | null;
  created_at: string | null;
};

type Resource = {
  id: string;
  project_id: string;
  kind: string;
  name: string;
  role_or_type: string | null;
  quantity: number | string | null;
  unit_cost: number | string | null;
  total_cost: number | string | null;
  status: string;
};

type Quotation = {
  id: string;
  status: string;
  total: number | string | null;
  close_probability: number | null;
  client_id: string | null;
  status_changed_at: string | null;
  clients?: { name?: string } | null;
};

interface Props {
  projects: Project[];
  resources: Resource[];
  quotations: Quotation[];
}

/**
 * Analítica visual ejecutiva para Plan Business.
 * Frontend-first: usa los datos existentes (projects, resources, quotations)
 * para construir 6 vistas comprensibles para gerentes y dueños.
 */
export function ExecutiveAnalytics({ projects, resources, quotations }: Props) {
  const PEN = useMoney();

  // ============================================================
  // 1) EARNED VALUE (EVM): PV vs EV vs AC agregados por mes
  // ============================================================
  const evmData = useMemo(() => {
    // Construye serie de los últimos 6 meses
    const now = new Date();
    const months: { key: string; label: string; pv: number; ev: number; ac: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: d.toISOString().slice(0, 7),
        label: d.toLocaleDateString("es", { month: "short" }),
        pv: 0,
        ev: 0,
        ac: 0,
      });
    }

    projects.forEach((p) => {
      const budget = Number(p.budget) || 0;
      const cost = Number(p.actual_cost) || 0;
      const progress = Math.min(100, Math.max(0, Number(p.progress) || 0)) / 100;
      const start = p.start_date ? new Date(p.start_date) : null;
      const end = p.end_date ? new Date(p.end_date) : null;
      if (!start || !end || budget <= 0) return;

      const totalDays = Math.max(1, (end.getTime() - start.getTime()) / 86400000);

      months.forEach((m) => {
        const monthEnd = new Date(m.key + "-01");
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        // PV = cuánto debería haberse ejecutado a la fecha
        const elapsed = Math.max(0, Math.min(totalDays, (monthEnd.getTime() - start.getTime()) / 86400000));
        const expectedPct = elapsed / totalDays;
        m.pv += budget * expectedPct;
        // EV = % de avance real * presupuesto, pero solo si ya empezó
        if (monthEnd.getTime() >= start.getTime()) {
          m.ev += budget * progress;
        }
        // AC = costos reales acumulados (proporcional al tiempo transcurrido del costo total)
        if (monthEnd.getTime() >= start.getTime()) {
          const ratio = Math.min(1, elapsed / totalDays);
          m.ac += cost * ratio;
        }
      });
    });

    return months.map((m) => ({
      label: m.label,
      Planificado: Math.round(m.pv),
      "Valor Ganado": Math.round(m.ev),
      "Costo Real": Math.round(m.ac),
    }));
  }, [projects]);

  const evmInterpretation = useMemo(() => {
    const last = evmData[evmData.length - 1];
    if (!last) return { label: "Sin datos", tone: "neutral", desc: "Aún no hay información suficiente." };
    const pv = last.Planificado;
    const ev = last["Valor Ganado"];
    const ac = last["Costo Real"];
    if (pv === 0) return { label: "Sin datos", tone: "neutral", desc: "Configura fechas y presupuesto en tus proyectos." };
    const sv = ev - pv; // schedule variance
    const cv = ev - ac; // cost variance
    if (cv < 0 && sv < 0) return { label: "Crítico", tone: "negative", desc: "Estás atrasado y gastando de más. Revisa proyectos en pérdida." };
    if (cv < 0) return { label: "Sobre presupuesto", tone: "negative", desc: "Tus costos crecen más rápido que el valor entregado." };
    if (sv < 0) return { label: "Atrasado", tone: "warning", desc: "Vas más lento que lo planificado. Acelera entregas clave." };
    if (sv > 0 && cv >= 0) return { label: "Adelantado", tone: "positive", desc: "Excelente: entregas más rápido y dentro de presupuesto." };
    return { label: "Saludable", tone: "positive", desc: "Todo en orden. Mantén el ritmo actual." };
  }, [evmData]);

  // ============================================================
  // 2) FLUJO DE CAJA: 30 / 60 / 90 días
  // ============================================================
  const cashflowData = useMemo(() => {
    const now = Date.now();
    const buckets = [
      { label: "30 días", limit: now + 30 * 86400000, ingresos: 0, cobros: 0, costos: 0 },
      { label: "60 días", limit: now + 60 * 86400000, ingresos: 0, cobros: 0, costos: 0 },
      { label: "90 días", limit: now + 90 * 86400000, ingresos: 0, cobros: 0, costos: 0 },
    ];

    projects.forEach((p) => {
      if (!p.end_date) return;
      const end = new Date(p.end_date).getTime();
      const budget = Number(p.budget) || 0;
      const cost = Number(p.actual_cost) || 0;
      const pending = Math.max(0, budget - cost);
      const remainingCost = Math.max(0, cost * 0.2); // proyección simple: 20% costo restante
      buckets.forEach((b) => {
        if (end <= b.limit && p.status !== "completed") {
          b.cobros += pending;
          b.costos += remainingCost;
        }
      });
    });

    quotations.forEach((q) => {
      if (!["pending", "in_contact", "quoted"].includes(q.status)) return;
      const prob = (q.close_probability ?? 50) / 100;
      const expected = Number(q.total) * prob;
      // distribuye probables linealmente: asume cierre dentro de 90 días
      buckets.forEach((b, idx) => {
        if (idx === 0) b.ingresos += expected * 0.3;
        else if (idx === 1) b.ingresos += expected * 0.5;
        else b.ingresos += expected * 0.2;
      });
    });

    return buckets.map((b) => ({
      label: b.label,
      "Ingresos esperados": Math.round(b.ingresos),
      "Cobros pendientes": Math.round(b.cobros),
      "Costos futuros": -Math.round(b.costos),
      "Caja neta": Math.round(b.ingresos + b.cobros - b.costos),
    }));
  }, [projects, quotations]);

  const cashInterpretation = useMemo(() => {
    const m30 = cashflowData[0];
    if (!m30) return "Sin datos suficientes para proyectar caja.";
    if (m30["Caja neta"] < 0) return `Caja negativa próximos 30 días: ${PEN.format(Math.abs(m30["Caja neta"]))}. Activa cobros pendientes.`;
    if (m30["Caja neta"] < (m30["Costos futuros"] ? Math.abs(m30["Costos futuros"]) : 0))
      return "Caja ajustada: tus ingresos cubren costos pero no dejan colchón.";
    return `Caja estable próximos 30 días: ${PEN.format(m30["Caja neta"])} disponibles.`;
  }, [cashflowData, PEN]);

  // ============================================================
  // 3) MARGEN HISTÓRICO: línea mensual
  // ============================================================
  const marginHistory = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; income: number; cost: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: d.toISOString().slice(0, 7),
        label: d.toLocaleDateString("es", { month: "short" }),
        income: 0,
        cost: 0,
      });
    }
    projects.forEach((p) => {
      if (!p.created_at) return;
      const m = p.created_at.slice(0, 7);
      const target = months.find((x) => x.key === m);
      if (!target) return;
      target.income += Number(p.budget) || 0;
      target.cost += Number(p.actual_cost) || 0;
    });
    return months.map((m) => ({
      label: m.label,
      Margen: m.income > 0 ? Math.round(((m.income - m.cost) / m.income) * 100) : 0,
    }));
  }, [projects]);

  const marginTrend = useMemo(() => {
    if (marginHistory.length < 2) return null;
    const last = marginHistory[marginHistory.length - 1].Margen;
    const prev = marginHistory[marginHistory.length - 2].Margen;
    const diff = last - prev;
    if (Math.abs(diff) < 1) return "Tu margen se mantiene estable mes a mes.";
    if (diff > 0) return `Tu margen creció ${diff.toFixed(0)} puntos vs el mes anterior.`;
    return `Tu margen cayó ${Math.abs(diff).toFixed(0)} puntos. Revisa costos.`;
  }, [marginHistory]);

  // ============================================================
  // 4) CARGA DE RECURSOS: saturación por persona/área
  // ============================================================
  const resourceLoad = useMemo(() => {
    const map = new Map<string, { name: string; cost: number; assignments: number }>();
    resources.forEach((r) => {
      if (r.kind !== "personnel" && r.kind !== "person" && r.kind !== "team") {
        // incluye también si role_or_type sugiere persona
        if (r.kind !== "machinery" && r.kind !== "tech" && r.kind !== "asset") {
          // tratamos cualquier kind como recurso humano si no es maquinaria/activo
        }
      }
      const key = r.name || "Sin nombre";
      const cur = map.get(key) || { name: key, cost: 0, assignments: 0 };
      cur.cost += Number(r.total_cost) || 0;
      cur.assignments += 1;
      map.set(key, cur);
    });
    const arr = Array.from(map.values()).sort((a, b) => b.assignments - a.assignments).slice(0, 8);
    // Saturación = asignaciones relativas al máximo del set
    const maxA = Math.max(1, ...arr.map((a) => a.assignments));
    return arr.map((a) => ({
      name: a.name.length > 16 ? a.name.slice(0, 14) + "…" : a.name,
      Saturación: Math.round((a.assignments / maxA) * 100),
      cost: a.cost,
      assignments: a.assignments,
    }));
  }, [resources]);

  // ============================================================
  // 5) RENTABILIDAD POR CLIENTE: top utilidad
  // ============================================================
  const clientProfitability = useMemo(() => {
    const map = new Map<string, { name: string; profit: number; income: number }>();
    projects.forEach((p) => {
      const cname = p.clients?.name || "Sin cliente";
      const income = Number(p.budget) || 0;
      const cost = Number(p.actual_cost) || 0;
      const cur = map.get(cname) || { name: cname, profit: 0, income: 0 };
      cur.profit += income - cost;
      cur.income += income;
      map.set(cname, cur);
    });
    const total = Array.from(map.values()).reduce((s, c) => s + Math.max(0, c.profit), 0);
    return Array.from(map.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 6)
      .map((c) => ({
        name: c.name.length > 18 ? c.name.slice(0, 16) + "…" : c.name,
        Utilidad: Math.round(c.profit),
        share: total > 0 ? Math.round((Math.max(0, c.profit) / total) * 100) : 0,
      }));
  }, [projects]);

  const topClientPhrase = useMemo(() => {
    const top = clientProfitability[0];
    if (!top || top.Utilidad <= 0) return "Aún no tienes clientes con utilidad consolidada.";
    return `Cliente ${top.name} genera ${top.share}% de tu utilidad total.`;
  }, [clientProfitability]);

  // Matriz de riesgo se eliminó de aquí: ahora vive en el módulo /riesgos


  return (
    <div className="space-y-5">
      <div>
        <h2 className="section-header mb-2 flex items-center gap-2">
          <LineChartIcon className="w-3.5 h-3.5 text-primary" />
          Analítica visual ejecutiva
        </h2>
        <p className="text-[11px] text-muted-foreground -mt-1 mb-3">
          Vista directiva: lee tus números de un vistazo. Sin tecnicismos.
        </p>
      </div>

      {/* === 1. EVM === */}
      <Card className="surface-card">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Valor ganado (EVM)
            </CardTitle>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold",
                evmInterpretation.tone === "positive" && "bg-cost-positive/15 text-cost-positive",
                evmInterpretation.tone === "negative" && "bg-cost-negative/15 text-cost-negative",
                evmInterpretation.tone === "warning" && "bg-amber-400/15 text-amber-400",
                evmInterpretation.tone === "neutral" && "bg-secondary text-muted-foreground"
              )}
            >
              {evmInterpretation.label}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">{evmInterpretation.desc}</p>
        </CardHeader>
        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer>
              <LineChart data={evmData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(v: number) => PEN.format(v)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Planificado" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Valor Ganado" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Costo Real" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* === 2. Flujo de caja === */}
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              Flujo de caja proyectado
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-1">{cashInterpretation}</p>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer>
                <BarChart data={cashflowData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    formatter={(v: number) => PEN.format(Math.abs(v))}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Ingresos esperados" stackId="a" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Cobros pendientes" stackId="a" fill="hsl(var(--cost-positive, 142 70% 45%))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Costos futuros" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* === 3. Margen histórico === */}
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Margen mensual (%)
            </CardTitle>
            {marginTrend && <p className="text-[11px] text-muted-foreground mt-1">{marginTrend}</p>}
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer>
                <LineChart data={marginHistory} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    formatter={(v: number) => `${v}%`}
                  />
                  <Line
                    type="monotone"
                    dataKey="Margen"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* === 4. Carga de recursos === */}
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Carga de recursos
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-1">
              {resourceLoad.length === 0
                ? "Aún no hay recursos asignados a proyectos."
                : `${resourceLoad.filter((r) => r.Saturación >= 80).length} recurso(s) con saturación alta.`}
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              {resourceLoad.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Sin datos de recursos.
                </div>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={resourceLoad} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                      formatter={(v: number) => `${v}% saturación`}
                    />
                    <Bar dataKey="Saturación" radius={[0, 3, 3, 0]}>
                      {resourceLoad.map((r, i) => (
                        <Cell
                          key={i}
                          fill={
                            r.Saturación >= 80
                              ? "hsl(var(--destructive))"
                              : r.Saturación >= 60
                              ? "hsl(38 92% 50%)"
                              : "hsl(var(--primary))"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* === 5. Rentabilidad por cliente === */}
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              Top clientes por utilidad
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-1">{topClientPhrase}</p>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              {clientProfitability.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Sin datos de clientes.
                </div>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={clientProfitability} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                      formatter={(v: number) => PEN.format(v)}
                    />
                    <Bar dataKey="Utilidad" radius={[0, 3, 3, 0]}>
                      {clientProfitability.map((c, i) => (
                        <Cell key={i} fill={c.Utilidad >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Matriz de riesgo movida al módulo independiente /riesgos */}
    </div>
  );
}
