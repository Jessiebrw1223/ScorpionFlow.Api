import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2, AlertTriangle, Calendar, User, Save, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";
import { TASK_PRIORITY_META, TASK_STATUS_META, TASK_IMPACT_META, BLOCKED_REASONS, suggestWeightFromPriority } from "@/lib/business-intelligence";
import { canAdminWorkspace, canEditAssignedTask, NO_EDIT_PERMISSION_MESSAGE, type WorkspaceRole } from "@/lib/workspace-permissions";

type TaskStatus = "todo" | "in_progress" | "in_review" | "done" | "blocked" | "cancelled";
type TaskPriority = "low" | "medium" | "high" | "critical";
type TaskImpact = "time" | "cost" | "delivery";

interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  impact: TaskImpact;
  assignee_name: string | null;
  assignee_id?: string | null;
  due_date: string | null;
  blocks_project: boolean;
  estimated_cost?: number;
  actual_cost?: number;
  blocked_reason?: string | null;
  weight?: number | null;
  node_type?: string | null;
}

interface Props {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  role?: WorkspaceRole;
  userId?: string | null;
}

export default function TaskDetailPanel({ task, open, onOpenChange, projectId, role = null, userId = null }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Task | null>(null);
  const canEdit = canEditAssignedTask(role, task, userId);
  const canDelete = canAdminWorkspace(role);
  const canEditCosts = canAdminWorkspace(role);

  useEffect(() => {
    setForm(task);
  }, [task]);

  const save = useMutation({
    mutationFn: async (values: Task) => {
      if (!canEdit) throw new Error(NO_EDIT_PERMISSION_MESSAGE);
      const { error } = await supabase
        .from("tasks")
        .update({
          title: values.title,
          description: values.description,
          status: values.status,
          priority: values.priority,
          impact: values.impact,
          assignee_name: values.assignee_name,
          due_date: values.due_date,
          blocks_project: values.blocks_project,
          estimated_cost: Number(values.estimated_cost) || 0,
          actual_cost: Number(values.actual_cost) || 0,
          // Solo guardamos motivo si la tarea está bloqueada; al cambiar de estado se limpia.
          blocked_reason: values.status === "blocked" ? (values.blocked_reason || null) : null,
          // Peso (story points) — clamp [1,100], default 1.
          weight: Math.min(100, Math.max(1, Number(values.weight) || 1)),
        })
        .eq("id", values.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-summary", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-calendar", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-report", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-hierarchy", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-cost", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-for-resources", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Tarea actualizada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("No se pudo guardar", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!canDelete) throw new Error(NO_EDIT_PERMISSION_MESSAGE);
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-summary", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-calendar", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-hierarchy", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Tarea eliminada");
      onOpenChange(false);
    },
  });

  if (!form) return null;

  const im = TASK_IMPACT_META[form.impact || "delivery"];
  const pr = TASK_PRIORITY_META[form.priority];
  const overdue = form.due_date && new Date(form.due_date) < new Date() && form.status !== "done";
  const initials = (form.assignee_name || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-2 pb-4 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded", pr.bg, pr.color)}>
              {pr.emoji} {pr.label}
            </span>
            <span className={cn("text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded", im.bg, im.color)}>
              {im.emoji} {im.short}
            </span>
            {form.blocks_project && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-cost-warning/10 text-cost-warning inline-flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" /> Bloquea entrega
              </span>
            )}
          </div>
          <SheetTitle className="fire-text text-lg leading-tight">{form.title}</SheetTitle>
        </SheetHeader>

        <div className="py-4 space-y-4">
          {/* Título */}
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nombre</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Descripción</Label>
            <Textarea
              rows={3}
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detalles, contexto o subtareas…"
            />
          </div>

          {/* Estado + Prioridad */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Estado</Label>
              <Select value={form.status} onValueChange={(v: TaskStatus) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_STATUS_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Prioridad</Label>
              <Select value={form.priority} onValueChange={(v: TaskPriority) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_PRIORITY_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Peso / Story points — solo nodos hoja contables (PMBOK 8: ponderado real) */}
          {(!form.node_type || ["task", "activity"].includes(form.node_type)) && (
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                Peso (story points)
                <span className="text-[10px] text-muted-foreground/70 normal-case tracking-normal">
                  · cuánto vale para el avance
                </span>
              </Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={form.weight ?? 1}
                  onChange={(e) => setForm({ ...form, weight: Number(e.target.value) || 1 })}
                  className="w-24 font-mono-data"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-[11px]"
                  onClick={() => setForm({ ...form, weight: suggestWeightFromPriority(form.priority) })}
                  title="Sugerir peso según la prioridad"
                >
                  Sugerir ({suggestWeightFromPriority(form.priority)})
                </Button>
                <p className="text-[11px] text-muted-foreground basis-full">
                  Tareas pequeñas = 1-3 · Medianas = 5-8 · Grandes = 13+
                </p>
              </div>
            </div>
          )}

          {/* Motivo de bloqueo — solo visible si status = blocked */}
          {form.status === "blocked" && (
            <div className="space-y-1.5 surface-card p-3 border-l-2 border-status-blocked bg-status-blocked/5">
              <Label className="text-[11px] uppercase tracking-wider text-status-blocked inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Motivo del bloqueo
              </Label>
              <Select
                value={form.blocked_reason || ""}
                onValueChange={(v) => setForm({ ...form, blocked_reason: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un motivo…" />
                </SelectTrigger>
                <SelectContent>
                  {BLOCKED_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.emoji} {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Identificar la causa ayuda al equipo a desbloquear más rápido.
              </p>
            </div>
          )}
          {/* Responsable + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                <User className="w-3 h-3" /> Responsable
              </Label>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[11px] font-bold text-primary-foreground shrink-0">
                  {initials}
                </div>
                <Input
                  value={form.assignee_name || ""}
                  onChange={(e) => setForm({ ...form, assignee_name: e.target.value })}
                  placeholder="Nombre o equipo"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Fecha límite
              </Label>
              <Input
                type="date"
                value={form.due_date || ""}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className={cn(overdue && "border-destructive text-destructive")}
              />
              {overdue && (
                <p className="text-[11px] text-destructive font-medium">⚠ Atrasada</p>
              )}
            </div>
          </div>

          {/* SECCIÓN CLAVE: Impacto en negocio */}
          <div className="surface-card p-3 space-y-3 border-l-2 border-primary bg-primary/5">
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-wider fire-text">Impacto en el negocio</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Conecta esta tarea con resultados reales del proyecto.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Tipo de impacto</Label>
              <Select value={form.impact} onValueChange={(v: TaskImpact) => setForm({ ...form, impact: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_IMPACT_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.emoji} {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground italic">
                {im.description}
              </p>
            </div>

            <div className="flex items-start gap-2 pt-2 border-t border-border">
              <Checkbox
                id="blocks-side"
                checked={form.blocks_project}
                onCheckedChange={(v) => setForm({ ...form, blocks_project: !!v })}
              />
              <Label htmlFor="blocks-side" className="cursor-pointer text-[12px] leading-tight">
                <span className="inline-flex items-center gap-1 font-medium text-cost-warning">
                  <AlertTriangle className="w-3 h-3" /> Esta tarea bloquea la entrega del proyecto
                </span>
                <span className="block text-[11px] text-muted-foreground font-normal mt-0.5">
                  Si no se completa, no podemos entregar al cliente.
                </span>
              </Label>
            </div>
          </div>

          {/* SECCIÓN: Costos de la tarea */}
          <div className="surface-card p-3 space-y-3 border-l-2 border-cost-warning bg-cost-warning/5">
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-cost-warning inline-flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" /> Costo de esta tarea
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Cuánto piensas que costará y cuánto ha costado realmente.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Costo estimado</Label>
                <CurrencyInput
                  value={Number(form.estimated_cost) || 0}
                  onValueChange={(v) => setForm({ ...form, estimated_cost: v })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Costo real</Label>
                <CurrencyInput
                  value={Number(form.actual_cost) || 0}
                  onValueChange={(v) => setForm({ ...form, actual_cost: v })}
                />
              </div>
            </div>
            {Number(form.actual_cost) > Number(form.estimated_cost) && Number(form.estimated_cost) > 0 && (
              <p className="text-[11px] text-cost-negative font-medium inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Costo real supera lo estimado
              </p>
            )}
          </div>
        </div>

        {/* Footer acciones */}
        <div className="flex items-center justify-between gap-2 pt-4 border-t border-border sticky bottom-0 bg-background pb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("¿Eliminar esta tarea?")) remove.mutate(form.id);
            }}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" /> Eliminar
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => save.mutate(form)}
              disabled={save.isPending}
              className="fire-button"
            >
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar cambios
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
