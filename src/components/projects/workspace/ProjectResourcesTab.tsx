import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Users, Cpu, Cog, Trash2, Pencil, AlertTriangle,
  TrendingUp, Sparkles, Loader2, ListChecks, UserCircle2, UsersRound,
  Link2, DollarSign, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";
import { useMoney } from "@/lib/format-money";

type Kind = "human" | "tech" | "asset";
type Unit = "hour" | "month" | "use" | "fixed";
type ResponsibleType = "person" | "area";

interface ProjectResource {
  id: string;
  project_id: string;
  owner_id: string;
  kind: Kind;
  name: string;
  role_or_type: string | null; // Para humanos: "person" | "area" | "<rol libre>" — usamos prefijo "person:" / "area:"
  unit: Unit;
  unit_cost: number;
  quantity: number;
  total_cost: number;
  status: string;
  notes: string | null;
}

interface Props {
  project: any;
}

const KIND_META: Record<Kind, { label: string; icon: typeof Users; color: string; bg: string; placeholderName: string; placeholderRole: string }> = {
  human: { label: "Personal", icon: Users, color: "text-primary", bg: "bg-primary/15", placeholderName: "Ana García", placeholderRole: "Diseñadora UX" },
  tech: { label: "Tecnología", icon: Cpu, color: "text-status-progress", bg: "bg-status-progress/15", placeholderName: "Figma Pro", placeholderRole: "Software / SaaS" },
  asset: { label: "Activo", icon: Cog, color: "text-cost-warning", bg: "bg-cost-warning/15", placeholderName: "Laptop MacBook Pro", placeholderRole: "Equipo" },
};

// Lenguaje humano. "use" se reetiqueta como "Por tarea/entregable" para freelancers.
const UNIT_META: Record<Unit, { label: string; suffix: string; qtyLabel: string }> = {
  month: { label: "Pago mensual",       suffix: "mes",  qtyLabel: "Meses trabajados" },
  hour:  { label: "Pago por hora",      suffix: "h",    qtyLabel: "Horas estimadas" },
  use:   { label: "Pago por tarea",     suffix: "tarea",qtyLabel: "Cantidad de tareas" },
  fixed: { label: "Costo único",        suffix: "",     qtyLabel: "Cantidad" },
};

// Acceso defensivo: si el valor en BD no coincide con el enum esperado,
// devuelve un fallback en lugar de romper el render.
const FALLBACK_UNIT_META = { label: "Costo", suffix: "", qtyLabel: "Cantidad" };
const FALLBACK_KIND_META = {
  label: "Recurso",
  icon: Cog,
  color: "text-muted-foreground",
  bg: "bg-muted",
  placeholderName: "",
  placeholderRole: "",
};
function unitMeta(u: unknown) {
  return (u && (UNIT_META as any)[u as string]) || FALLBACK_UNIT_META;
}
function kindMeta(k: unknown) {
  return (k && (KIND_META as any)[k as string]) || FALLBACK_KIND_META;
}

// Opciones de tipo de costo permitidas según naturaleza del recurso
const HUMAN_UNIT_OPTIONS: Unit[] = ["month", "hour", "use"];      // Personas: mensual / hora / tarea
const TECH_UNIT_OPTIONS:  Unit[] = ["month", "use", "fixed"];     // Tech: SaaS mensual, APIs por uso, software único
const ASSET_UNIT_OPTIONS: Unit[] = ["fixed", "month"];            // Activos: compra única o renta mensual

// Presets sugeridos para Tecnología y Activos — reducen carga cognitiva
const TECH_PRESETS: { id: string; label: string; defaultName: string; defaultUnit: Unit }[] = [
  { id: "hosting",  label: "Hosting / Servidor",  defaultName: "Hosting",        defaultUnit: "month" },
  { id: "saas",     label: "Software / SaaS",     defaultName: "Suscripción",    defaultUnit: "month" },
  { id: "api",      label: "APIs / Integraciones",defaultName: "API externa",    defaultUnit: "use" },
  { id: "ai",       label: "IA / Modelos LLM",    defaultName: "Créditos IA",    defaultUnit: "use" },
  { id: "license",  label: "Licencia única",      defaultName: "Licencia",       defaultUnit: "fixed" },
  { id: "custom",   label: "Otro",                defaultName: "",               defaultUnit: "month" },
];

const ASSET_PRESETS: { id: string; label: string; defaultName: string; defaultUnit: Unit }[] = [
  { id: "machinery",label: "Maquinaria",          defaultName: "Equipo industrial", defaultUnit: "fixed" },
  { id: "computer", label: "Equipo de cómputo",   defaultName: "Laptop",            defaultUnit: "fixed" },
  { id: "tool",     label: "Herramienta",         defaultName: "Herramienta",       defaultUnit: "fixed" },
  { id: "rental",   label: "Renta de equipo",     defaultName: "Renta",             defaultUnit: "month" },
  { id: "custom",   label: "Otro",                defaultName: "",                  defaultUnit: "fixed" },
];

// Helpers para serializar el tipo de responsable dentro de role_or_type
function parseRole(role: string | null): { type: ResponsibleType; label: string } {
  if (!role) return { type: "person", label: "" };
  if (role.startsWith("area:")) return { type: "area", label: role.slice(5).trim() };
  if (role.startsWith("person:")) return { type: "person", label: role.slice(7).trim() };
  return { type: "person", label: role };
}
function serializeRole(type: ResponsibleType, label: string) {
  return `${type}:${label.trim()}`;
}

export default function ProjectResourcesTab({ project }: Props) {
  const qc = useQueryClient();
  const PEN = useMoney();

  // Dialog para asignar costo a humano detectado
  const [humanDialog, setHumanDialog] = useState<{
    name: string;
    existing?: ProjectResource;
  } | null>(null);
  const [humanForm, setHumanForm] = useState({
    responsibleType: "person" as ResponsibleType,
    role_label: "",
    unit: "hour" as Unit,
    unit_cost: 0,
    quantity: 1,
    notes: "",
  });

  // Dialog para tech / asset (creación manual permitida)
  const [dialogKind, setDialogKind] = useState<Exclude<Kind, "human"> | null>(null);
  const [editingNonHuman, setEditingNonHuman] = useState<ProjectResource | null>(null);
  const [form, setForm] = useState({ name: "", role_or_type: "", unit: "fixed" as Unit, unit_cost: 0, quantity: 1, notes: "" });
  const [presetId, setPresetId] = useState<string>("custom");

  const projectId: string | undefined = project?.id;

  const { data: resources = [], isLoading, error: resourcesError } = useQuery({
    queryKey: ["project-resources", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_resources" as any)
        .select("*")
        .eq("project_id", projectId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProjectResource[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["project-tasks-for-resources", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, status, assignee_name, node_type")
        .eq("project_id", projectId as string);
      if (error) throw error;
      return data || [];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: Partial<ProjectResource> & { id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      if (payload.id) {
        const { error } = await supabase.from("project_resources" as any).update({
          name: payload.name,
          role_or_type: payload.role_or_type,
          unit: payload.unit,
          unit_cost: payload.unit_cost,
          quantity: payload.quantity,
          notes: payload.notes,
        } as any).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_resources" as any).insert({
          project_id: project.id,
          owner_id: project.owner_id ?? user.id,
          kind: payload.kind,
          name: payload.name,
          role_or_type: payload.role_or_type,
          unit: payload.unit,
          unit_cost: payload.unit_cost,
          quantity: payload.quantity,
          notes: payload.notes,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-resources", project.id] });
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["project-financials", project.id] });
      toast.success("Costo asignado");
      closeAllDialogs();
    },
    onError: (e: any) => toast.error("Error", { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_resources" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-resources", project.id] });
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["project-financials", project.id] });
      toast.success("Recurso eliminado");
    },
  });

  // ===== Detección automática de responsables desde tareas =====
  const detectedHumans = useMemo(() => {
    const map = new Map<string, { name: string; active: number; total: number }>();
    tasks.forEach((t: any) => {
      const name = (t.assignee_name || "").trim();
      if (!name) return;
      const cur = map.get(name) || { name, active: 0, total: 0 };
      cur.total += 1;
      if (t.status !== "done") cur.active += 1;
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [tasks]);

  // Cruce: detectados + recursos humanos persistidos
  // Defensivo: ignora recursos sin nombre (legacy / data corrupta) para no romper la vista.
  const humanResources = resources.filter(r => r.kind === "human" && typeof r.name === "string" && r.name.trim().length > 0);
  const humanByName = useMemo(() => {
    const m = new Map<string, ProjectResource>();
    humanResources.forEach(r => m.set((r.name ?? "").trim(), r));
    return m;
  }, [humanResources]);

  // Detectados sin costo configurado
  const pendingHumans = detectedHumans.filter(d => {
    const r = humanByName.get(d.name);
    return !r || Number(r.unit_cost) <= 0;
  });
  // Configurados (con costo > 0) — incluye huérfanos (sin tareas activas, manuales legacy)
  const configuredHumans = humanResources.filter(r => Number(r.unit_cost) > 0);

  // Huérfanos: configurados que ya no aparecen en tareas (legacy o reasignados)
  const detectedNamesSet = new Set(detectedHumans.map(d => d.name));
  const orphanConfigured = configuredHumans.filter(r => !detectedNamesSet.has((r.name ?? "").trim()));

  function openAssignCost(name: string) {
    const existing = humanByName.get(name);
    if (existing) {
      const parsed = parseRole(existing.role_or_type);
      setHumanForm({
        responsibleType: parsed.type,
        role_label: parsed.label,
        unit: existing.unit,
        unit_cost: Number(existing.unit_cost),
        quantity: Number(existing.quantity),
        notes: existing.notes || "",
      });
      setHumanDialog({ name, existing });
    } else {
      setHumanForm({ responsibleType: "person", role_label: "", unit: "hour", unit_cost: 0, quantity: 1, notes: "" });
      setHumanDialog({ name });
    }
  }

  function submitHuman() {
    if (!humanDialog) return;
    if (humanForm.unit_cost <= 0) {
      toast.error("El costo debe ser mayor a 0");
      return;
    }
    upsertMutation.mutate({
      id: humanDialog.existing?.id,
      kind: "human",
      name: humanDialog.name,
      role_or_type: serializeRole(humanForm.responsibleType, humanForm.role_label),
      unit: humanForm.unit,
      unit_cost: humanForm.unit_cost,
      quantity: humanForm.quantity,
      notes: humanForm.notes.trim() || null,
    });
  }

  // ===== Tech / Asset (creación manual permitida) =====
  function openCreateNonHuman(kind: Exclude<Kind, "human">) {
    setEditingNonHuman(null);
    setPresetId("custom");
    const defaultUnit: Unit = kind === "tech" ? "month" : "fixed";
    setForm({ name: "", role_or_type: "", unit: defaultUnit, unit_cost: 0, quantity: 1, notes: "" });
    setDialogKind(kind);
  }
  function openEditNonHuman(r: ProjectResource) {
    setEditingNonHuman(r);
    setPresetId("custom");
    setForm({
      name: r.name,
      role_or_type: r.role_or_type || "",
      unit: r.unit,
      unit_cost: Number(r.unit_cost),
      quantity: Number(r.quantity),
      notes: r.notes || "",
    });
    setDialogKind(r.kind as Exclude<Kind, "human">);
  }
  function applyPreset(id: string) {
    setPresetId(id);
    if (!dialogKind) return;
    const list = dialogKind === "tech" ? TECH_PRESETS : ASSET_PRESETS;
    const preset = list.find((p) => p.id === id);
    if (!preset || id === "custom") return;
    setForm((f) => ({
      ...f,
      name: f.name || preset.defaultName,
      role_or_type: f.role_or_type || preset.label,
      unit: preset.defaultUnit,
    }));
  }
  function submitNonHuman() {
    if (!form.name.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    upsertMutation.mutate({
      id: editingNonHuman?.id,
      kind: dialogKind!,
      name: form.name.trim(),
      role_or_type: form.role_or_type.trim() || null,
      unit: form.unit,
      unit_cost: form.unit_cost,
      quantity: form.quantity,
      notes: form.notes.trim() || null,
    });
  }

  function closeAllDialogs() {
    setHumanDialog(null);
    setDialogKind(null);
    setEditingNonHuman(null);
  }

  // ===== Totales =====
  const totals = useMemo(() => {
    const safeNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const sum = (k: Kind) =>
      (resources ?? [])
        .filter(r => r?.kind === k)
        .reduce((s, r) => s + safeNum(r?.total_cost), 0);
    const human = sum("human");
    const tech = sum("tech");
    const asset = sum("asset");
    return { human, tech, asset, total: human + tech + asset };
  }, [resources]);

  // ===== Insights =====
  const insights = useMemo(() => {
    const out: { type: "warn" | "info" | "good"; text: string }[] = [];
    const budget = Number(project?.budget) || 0;
    if (budget > 0 && totals.total > budget) {
      out.push({ type: "warn", text: `Costos asignados (${PEN.format(totals.total)}) superan el presupuesto (${PEN.format(budget)}).` });
    } else if (budget > 0 && totals.total > budget * 0.85) {
      out.push({ type: "warn", text: `Costos asignados consumen ${Math.round((totals.total / budget) * 100)}% del presupuesto.` });
    }
    if (pendingHumans.length > 0) {
      out.push({ type: "warn", text: `${pendingHumans.length} ${pendingHumans.length === 1 ? "responsable trabaja" : "responsables trabajan"} sin costo asignado. Haz clic en "Asignar costo".` });
    }
    detectedHumans.forEach(d => {
      const util = Math.min(120, Math.round((d.active / 4) * 100));
      if (util > 100) out.push({ type: "warn", text: `${d.name} está sobrecargado (${util}%). Redistribuye tareas.` });
      else if (util > 80) out.push({ type: "info", text: `${d.name} cerca del límite (${util}%).` });
    });
    if (detectedHumans.length === 0 && resources.length === 0) {
      out.push({ type: "info", text: "Asigna responsables a las tareas en Planificación para que aparezcan aquí." });
    } else if (out.length === 0) {
      out.push({ type: "good", text: "Todos los responsables tienen costo configurado y la carga está bajo control." });
    }
    return out;
  }, [totals, project?.budget, detectedHumans, pendingHumans.length, resources.length]);

  if (!projectId) {
    return (
      <div className="surface-card p-8 text-center text-[12px] text-muted-foreground">
        Cargando información del proyecto…
      </div>
    );
  }

  if (resourcesError) {
    return (
      <div className="surface-card p-8 text-center space-y-2">
        <AlertTriangle className="w-6 h-6 text-cost-warning mx-auto" />
        <p className="text-[13px] font-medium text-foreground">No se pudieron cargar los recursos del proyecto.</p>
        <p className="text-[11px] text-muted-foreground">
          Verifica tu conexión o tus permisos. Si el problema persiste, intenta recargar la página.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* RESUMEN ARRIBA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(["human", "tech", "asset"] as Kind[]).map((k) => {
          const meta = kindMeta(k);
          const Icon = meta.icon;
          const cost = totals[k];
          const count = k === "human"
            ? configuredHumans.length
            : resources.filter(r => r.kind === k).length;
          const pendingCount = k === "human" ? pendingHumans.length : 0;
          return (
            <div
              key={k}
              className="surface-card p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", meta.bg)}>
                  <Icon className={cn("w-4 h-4", meta.color)} />
                </div>
                {k !== "human" && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openCreateNonHuman(k as Exclude<Kind, "human">)}>
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
              <h3 className="text-[12px] font-medium text-muted-foreground">{meta.label}</h3>
              <div className="font-mono-data text-lg font-semibold text-foreground mt-0.5">{PEN.format(cost)}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {count} {count === 1 ? "configurado" : "configurados"}
                {pendingCount > 0 && (
                  <span className="text-cost-warning font-medium"> · {pendingCount} sin costo</span>
                )}
              </p>
            </div>
          );
        })}
        <div className="surface-card p-4 bg-primary/5 border-primary/30">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
          </div>
          <h3 className="text-[12px] font-medium text-muted-foreground">Costo total recursos</h3>
          <div className="font-mono-data text-lg font-bold text-primary mt-0.5">{PEN.format(totals.total)}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Suma automática al proyecto</p>
        </div>
      </div>

      {isLoading ? (
        <div className="surface-card p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div>
      ) : (
        <>
          {/* PERSONAL — auto-detectado desde tareas */}
          <div className="surface-card p-4">
            <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <h3 className="text-[14px] font-semibold text-foreground">Personal del proyecto</h3>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Link2 className="w-3 h-3" /> Detectado automáticamente desde responsables de tareas
                  </p>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-primary/80 bg-primary/10 px-2 py-1 rounded">
                Primero quién trabaja, luego cuánto cuesta
              </span>
            </div>

            {detectedHumans.length === 0 && configuredHumans.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <Users className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
                <p className="text-[12px] text-muted-foreground">
                  Aún no hay responsables asignados.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Ve a <span className="font-semibold text-foreground">Planificación</span> y asigna responsables a las tareas. Aparecerán aquí automáticamente.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* SIN COSTO ASIGNADO */}
                {pendingHumans.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cost-warning" />
                      <h4 className="text-[12px] font-semibold text-cost-warning uppercase tracking-wider">
                        Sin costo asignado ({pendingHumans.length})
                      </h4>
                    </div>
                    <div className="divide-y divide-border border border-cost-warning/20 bg-cost-warning/5 rounded-md">
                      {pendingHumans.map((d) => {
                        const util = Math.min(120, Math.round((d.active / 4) * 100));
                        return (
                          <div key={d.name} className="py-2.5 px-3 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <UserCircle2 className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[13px] font-medium text-foreground truncate">{d.name}</span>
                                <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                                  <ListChecks className="w-3 h-3" /> {d.total} {d.total === 1 ? "tarea" : "tareas"}
                                </span>
                              </div>
                              <p className="text-[11px] text-cost-warning flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="w-3 h-3" /> Este responsable aún no tiene costo asignado
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={cn(
                                "text-[11px] font-mono-data font-medium",
                                util > 100 ? "text-cost-negative" : util > 80 ? "text-cost-warning" : "text-muted-foreground"
                              )}>
                                {util}% carga
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => openAssignCost(d.name)}
                              className="fire-button h-7 text-[11px] gap-1"
                            >
                              <DollarSign className="w-3 h-3" /> Asignar costo
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CONFIGURADOS */}
                {configuredHumans.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cost-positive" />
                      <h4 className="text-[12px] font-semibold text-cost-positive uppercase tracking-wider">
                        Configurados ({configuredHumans.length})
                      </h4>
                    </div>
                    <div className="divide-y divide-border border border-border rounded-md">
                      {configuredHumans.map((r) => {
                        const safeName = (r.name ?? "").trim();
                        const detected = detectedHumans.find(d => d.name === safeName);
                        const isOrphan = !detected;
                        const active = detected?.active || 0;
                        const total = detected?.total || 0;
                        const util = Math.min(120, Math.round((active / 4) * 100));
                        const isOverloaded = util > 100;
                        const isWarn = util > 80 && util <= 100;
                        const parsed = parseRole(r.role_or_type);
                        const TypeIcon = parsed.type === "area" ? UsersRound : UserCircle2;
                        return (
                          <div key={r.id} className="py-2.5 px-3 flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                              parsed.type === "area" ? "bg-status-progress/15" : "bg-primary/15"
                            )}>
                              <TypeIcon className={cn("w-4 h-4", parsed.type === "area" ? "text-status-progress" : "text-primary")} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[13px] font-medium text-foreground truncate">{r.name}</span>
                                <span className={cn(
                                  "text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded",
                                  parsed.type === "area" ? "bg-status-progress/15 text-status-progress" : "bg-primary/15 text-primary"
                                )}>
                                  {parsed.type === "area" ? "Área" : "Persona"}
                                </span>
                                {parsed.label && (
                                  <span className="text-[11px] text-muted-foreground">· {parsed.label}</span>
                                )}
                                {detected && (
                                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                                    <ListChecks className="w-3 h-3" /> {total} {total === 1 ? "tarea" : "tareas"}
                                  </span>
                                )}
                                {isOrphan && (
                                  <span className="text-[10px] text-cost-warning bg-cost-warning/10 px-1.5 py-0.5 rounded">
                                    Sin tareas activas
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                                <span className="font-mono-data">
                                  {PEN.format(Number(r.unit_cost))}{unitMeta(r.unit).suffix && `/${unitMeta(r.unit).suffix}`} × {Number(r.quantity)}
                                </span>
                                {detected && (
                                  <span className={cn(
                                    "font-mono-data font-medium",
                                    isOverloaded ? "text-cost-negative" : isWarn ? "text-cost-warning" : "text-cost-positive"
                                  )}>
                                    {util}% carga
                                    {isOverloaded && " · Crítico"}
                                    {isWarn && " · Alerta"}
                                  </span>
                                )}
                              </div>
                              {detected && (
                                <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-1.5">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-sf",
                                      isOverloaded ? "bg-cost-negative" : isWarn ? "bg-cost-warning" : "bg-primary"
                                    )}
                                    style={{ width: `${Math.min(util, 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono-data text-[13px] font-semibold text-foreground">
                                {PEN.format(Number(r.total_cost))}
                              </div>
                              <p className="text-[10px] text-muted-foreground">{unitMeta(r.unit).label}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openAssignCost(r.name)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              {isOrphan && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-cost-negative hover:text-cost-negative"
                                  onClick={() => {
                                    if (confirm(`Eliminar "${r.name}"? Solo se permite porque ya no tiene tareas activas.`)) deleteMutation.mutate(r.id);
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* TECH + ASSET — creación manual permitida */}
          {(["tech", "asset"] as Exclude<Kind, "human">[]).map((k) => {
            const meta = kindMeta(k);
            const Icon = meta.icon;
            const items = resources.filter(r => r.kind === k);
            return (
              <div key={k} className="surface-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("w-4 h-4", meta.color)} />
                    <h3 className="text-[14px] font-semibold text-foreground">{meta.label}</h3>
                    <span className="text-[11px] text-muted-foreground">({items.length})</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openCreateNonHuman(k)} className="gap-1.5 text-[12px] h-7">
                    <Plus className="w-3.5 h-3.5" /> Agregar recurso
                  </Button>
                </div>

                {items.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground text-center py-4">
                    Sin {meta.label.toLowerCase()} asignados.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {items.map((r) => (
                      <div key={r.id} className="py-2.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-medium text-foreground truncate">{r.name}</span>
                            {r.role_or_type && (
                              <span className="text-[11px] text-muted-foreground">· {r.role_or_type}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                            <span className="font-mono-data">
                              {PEN.format(Number(r.unit_cost))}{unitMeta(r.unit).suffix && `/${unitMeta(r.unit).suffix}`} × {Number(r.quantity)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono-data text-[13px] font-semibold text-foreground">
                            {PEN.format(Number(r.total_cost))}
                          </div>
                          <p className="text-[10px] text-muted-foreground">{unitMeta(r.unit).label}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditNonHuman(r)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-cost-negative hover:text-cost-negative" onClick={() => {
                            if (confirm(`¿Eliminar "${r.name}"?`)) deleteMutation.mutate(r.id);
                          }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* INSIGHTS ABAJO */}
      <div className="surface-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-[14px] font-semibold text-foreground">Insights automáticos</h3>
        </div>
        <div className="space-y-2">
          {insights.map((ins, i) => {
            const Icon = ins.type === "warn" ? AlertTriangle : ins.type === "good" ? CheckCircle2 : Sparkles;
            const color = ins.type === "warn" ? "text-cost-negative" : ins.type === "good" ? "text-cost-positive" : "text-muted-foreground";
            return (
              <div key={i} className="flex items-start gap-2 text-[12px]">
                <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", color)} />
                <span className="text-foreground">{ins.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* DIALOG: Asignar costo a humano detectado */}
      <Dialog open={!!humanDialog} onOpenChange={(o) => !o && closeAllDialogs()}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              {humanDialog?.existing ? "Editar costo de" : "Asignar costo a"} {humanDialog?.name}
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              Detectado en tareas del proyecto. Define cuánto cuesta su trabajo.
            </DialogDescription>
          </DialogHeader>
          {humanDialog && (
            <div className="space-y-3 mt-2">
              {/* Toggle Persona / Área */}
              <div className="space-y-1.5">
                <Label className="text-[12px]">Tipo de responsable</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["person", "area"] as ResponsibleType[]).map((t) => {
                    const active = humanForm.responsibleType === t;
                    const Icon = t === "area" ? UsersRound : UserCircle2;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setHumanForm(f => ({ ...f, responsibleType: t }))}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-md border text-[12px] font-medium transition-sf",
                          active
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {t === "area" ? "Área / Equipo" : "Persona individual"}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {humanForm.responsibleType === "area"
                    ? "Costo grupal aplicado al equipo completo."
                    : "Costo individual asignado a una persona."}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px]">{humanForm.responsibleType === "area" ? "Descripción del área" : "Rol"}</Label>
                <Input
                  value={humanForm.role_label}
                  onChange={(e) => setHumanForm(f => ({ ...f, role_label: e.target.value }))}
                  placeholder={humanForm.responsibleType === "area" ? "Equipo de Diseño" : "Diseñadora UX"}
                  className="h-9 text-[13px]"
                  maxLength={80}
                />
              </div>

              {/* Tipo de costo: toggle visual claro (sin Select confuso) */}
              <div className="space-y-1.5">
                <Label className="text-[12px]">¿Cómo se le paga?</Label>
                <div className="grid grid-cols-3 gap-2">
                  {HUMAN_UNIT_OPTIONS.map((u) => {
                    const active = humanForm.unit === u;
                    return (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setHumanForm(f => ({ ...f, unit: u }))}
                        className={cn(
                          "px-2 py-2 rounded-md border text-[11px] font-medium transition-sf",
                          active ? "bg-primary/10 border-primary text-primary" : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {unitMeta(u).label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">{unitMeta(humanForm.unit).qtyLabel}</Label>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.5}
                    value={humanForm.quantity}
                    onChange={(e) => setHumanForm(f => ({ ...f, quantity: Number(e.target.value) || 0 }))}
                    className="h-9 text-[13px] font-mono-data"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px]">
                    Costo {humanForm.unit === "fixed" ? "único" : `por ${unitMeta(humanForm.unit).suffix}`}
                  </Label>
                  <CurrencyInput
                    value={humanForm.unit_cost}
                    onValueChange={(v) => setHumanForm(f => ({ ...f, unit_cost: v }))}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="rounded-md bg-primary/5 border border-primary/20 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">Costo total</span>
                  <span className="font-mono-data text-[15px] font-bold text-primary">
                    {PEN.format(humanForm.unit_cost * humanForm.quantity)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Se sumará automáticamente al costo del proyecto.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeAllDialogs} disabled={upsertMutation.isPending}>Cancelar</Button>
            <Button onClick={submitHuman} disabled={upsertMutation.isPending} className="fire-button">
              {upsertMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              {humanDialog?.existing ? "Guardar costo" : "Asignar costo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Tech / Asset (manual) */}
      <Dialog open={!!dialogKind} onOpenChange={(o) => !o && closeAllDialogs()}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingNonHuman ? "Editar" : "Agregar"} {dialogKind && kindMeta(dialogKind).label.toLowerCase()}
            </DialogTitle>
          </DialogHeader>
          {dialogKind && (
            <div className="space-y-3 mt-2">
              {/* Preset selector — solo al CREAR (al editar lo dejamos vacío para no sobreescribir) */}
              {!editingNonHuman && (
                <div className="space-y-1.5">
                  <Label className="text-[12px]">¿Qué tipo de {kindMeta(dialogKind).label.toLowerCase()} es?</Label>
                  <Select value={presetId} onValueChange={applyPreset}>
                    <SelectTrigger className="h-9 text-[13px]">
                      <SelectValue placeholder="Selecciona un tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(dialogKind === "tech" ? TECH_PRESETS : ASSET_PRESETS).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Te pre-llena la unidad de cobro más común. Puedes ajustar todo después.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[12px]">Nombre</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={kindMeta(dialogKind).placeholderName}
                  className="h-9 text-[13px]"
                  maxLength={120}
                />
              </div>

              {/* Tipo de costo — toggle limitado por categoría */}
              <div className="space-y-1.5">
                <Label className="text-[12px]">¿Cómo se paga?</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(dialogKind === "tech" ? TECH_UNIT_OPTIONS : ASSET_UNIT_OPTIONS).map((u) => {
                    const active = form.unit === u;
                    return (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, unit: u }))}
                        className={cn(
                          "px-2 py-2 rounded-md border text-[11px] font-medium transition-sf",
                          active ? "bg-primary/10 border-primary text-primary" : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {unitMeta(u).label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">{unitMeta(form.unit).qtyLabel}</Label>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.5}
                    value={form.quantity}
                    onChange={(e) => setForm(f => ({ ...f, quantity: Number(e.target.value) || 0 }))}
                    className="h-9 text-[13px] font-mono-data"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px]">
                    Costo {form.unit === "fixed" ? "único" : `por ${unitMeta(form.unit).suffix}`}
                  </Label>
                  <CurrencyInput
                    value={form.unit_cost}
                    onValueChange={(v) => setForm(f => ({ ...f, unit_cost: v }))}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="rounded-md bg-primary/5 border border-primary/20 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">Costo total</span>
                  <span className="font-mono-data text-[15px] font-bold text-primary">
                    {PEN.format(form.unit_cost * form.quantity)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Se sumará automáticamente al costo del proyecto.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeAllDialogs} disabled={upsertMutation.isPending}>Cancelar</Button>
            <Button onClick={submitNonHuman} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              {editingNonHuman ? "Guardar" : "Asignar recurso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
