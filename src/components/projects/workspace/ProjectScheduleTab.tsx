import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, CheckCircle2, AlertTriangle, Clock, Save, Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getExecutionStatus } from "@/lib/business-intelligence";
import { useUserSettings } from "@/hooks/useUserSettings";
import { toast } from "@/hooks/use-toast";
import { canAdminWorkspace, NO_EDIT_PERMISSION_MESSAGE, type WorkspaceRole } from "@/lib/workspace-permissions";

interface Props {
  project: any;
  role?: WorkspaceRole;
}

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateLong(date: Date) {
  return date.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
}

export default function ProjectScheduleTab({ project, role = null }: Props) {
  const qc = useQueryClient();
  const { settings } = useUserSettings();
  const canEdit = canAdminWorkspace(role);
  const [startDraft, setStartDraft] = useState(project.start_date || "");
  const [endDraft, setEndDraft] = useState(project.end_date || "");

  const { data: tasks = [] } = useQuery({
    queryKey: ["project-tasks-schedule", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, status, due_date, start_date, node_type")
        .eq("project_id", project.id);
      if (error) throw error;
      return data;
    },
  });

  const today = new Date();
  const overdueCount = tasks.filter(
    (t: any) => t.status !== "done" && t.due_date && new Date(t.due_date) < today
  ).length;

  const execution = getExecutionStatus({
    status: project.status,
    startDate: project.start_date,
    endDate: project.end_date,
    progress: Number(project.progress) || 0,
    hasOverdueTasks: overdueCount > 0,
    taskDates: tasks.map((t: any) => t.due_date),
    inferSchedule: settings.auto_behavior?.inferSchedule,
  });

  const metrics = useMemo(() => {
    const start = project.start_date ? new Date(project.start_date) : null;
    const end = project.end_date ? new Date(project.end_date) : null;
    if (!start || !end || end <= start) return null;

    const total = end.getTime() - start.getTime();
    const elapsed = Math.max(0, Math.min(total, today.getTime() - start.getTime()));
    const expectedPct = Math.round((elapsed / total) * 100);
    const realPct = Math.round(Number(project.progress) || 0);
    const totalDays = Math.ceil(total / 86400000);
    const elapsedDays = Math.ceil(elapsed / 86400000);
    const remainingDays = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
    const overdueDays = today > end ? Math.ceil((today.getTime() - end.getTime()) / 86400000) : 0;
    const gap = expectedPct - realPct;

    const tasksDone = tasks.filter((t: any) => t.status === "done").length;
    const tasksTotal = tasks.length;

    return {
      start, end, totalDays, elapsedDays, remainingDays, overdueDays,
      expectedPct, realPct, gap, tasksDone, tasksTotal,
    };
  }, [project.start_date, project.end_date, project.progress, tasks]);

  const updateDates = useMutation({
    mutationFn: async () => {
      if (!canEdit) throw new Error(NO_EDIT_PERMISSION_MESSAGE);
      const { error } = await supabase
        .from("projects")
        .update({
          start_date: startDraft || null,
          end_date: endDraft || null,
        })
        .eq("id", project.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Cronograma actualizado", description: "Las fechas del proyecto se guardaron correctamente." });
    },
    onError: (e: any) => {
      toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
    },
  });

  const noSchedule = !project.start_date || !project.end_date;

  return (
    <div className="space-y-4">
      {/* Header del estado */}
      <div className={cn("surface-card p-4 border-l-4", execution.border)}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn("p-2 rounded", execution.bg)}>
              <CalendarRange className={cn("w-5 h-5", execution.color)} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold">Estado de ejecución</h3>
                <span className={cn("text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded", execution.bg, execution.color)}>
                  {execution.label}
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground mt-1">{execution.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Editor de fechas (siempre disponible) */}
      <div className="surface-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h4 className="text-[13px] font-semibold inline-flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Cronograma del proyecto
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Define cuándo inicia y cuándo debe terminar. Esto activa el cálculo real de avance vs lo esperado.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="space-y-1">
            <Label htmlFor="start-date" className="text-[11px]">Fecha de inicio</Label>
            <Input
              id="start-date"
              type="date"
              value={startDraft || ""}
              onChange={(e) => setStartDraft(e.target.value)}
              disabled={!canEdit}
              className="text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="end-date" className="text-[11px]">Fecha de fin esperada</Label>
            <Input
              id="end-date"
              type="date"
              value={endDraft || ""}
              onChange={(e) => setEndDraft(e.target.value)}
              min={startDraft || undefined}
              disabled={!canEdit}
              className="text-[13px]"
            />
          </div>
          <Button
            onClick={() => updateDates.mutate()}
            disabled={!canEdit || updateDates.isPending || (startDraft === (project.start_date || "") && endDraft === (project.end_date || ""))}
            title={!canEdit ? NO_EDIT_PERMISSION_MESSAGE : undefined}
            className="gap-2"
          >
            {updateDates.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar fechas
          </Button>
        </div>

        {noSchedule && (
          <div className="flex items-start gap-2 text-[12px] bg-cost-warning/10 border border-cost-warning/30 rounded p-3">
            <Info className="w-4 h-4 text-cost-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-cost-warning">Sin cronograma definido</p>
              <p className="text-muted-foreground">
                Mientras no haya fechas, el estado mostrará <strong>"No evaluable"</strong>. Define inicio y fin para activar el cálculo real.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Métricas reales (solo si hay cronograma) */}
      {metrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="surface-card p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Inicio</p>
              <p className="text-[14px] font-semibold mt-1">{formatDateLong(metrics.start)}</p>
            </div>
            <div className="surface-card p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Fin esperado</p>
              <p className="text-[14px] font-semibold mt-1">{formatDateLong(metrics.end)}</p>
            </div>
            <div className="surface-card p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Duración total</p>
              <p className="text-[14px] font-semibold mt-1 font-mono-data">{metrics.totalDays} días</p>
            </div>
            <div className="surface-card p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {metrics.overdueDays > 0 ? "Días vencido" : "Días restantes"}
              </p>
              <p className={cn(
                "text-[14px] font-semibold mt-1 font-mono-data",
                metrics.overdueDays > 0 ? "text-cost-negative" : "text-foreground"
              )}>
                {metrics.overdueDays > 0 ? `+${metrics.overdueDays}` : metrics.remainingDays} días
              </p>
            </div>
          </div>

          {/* Comparación real vs esperado */}
          <div className="surface-card p-4 space-y-4">
            <div>
              <h4 className="text-[13px] font-semibold">Avance real vs avance esperado</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Compara qué tanto del trabajo está hecho contra cuánto deberías llevar a esta fecha.
              </p>
            </div>

            {/* Avance esperado */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/60" />
                  Avance esperado por cronograma
                </span>
                <span className="font-mono-data font-semibold">{metrics.expectedPct}%</span>
              </div>
              <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-muted-foreground/60 transition-all"
                  style={{ width: `${metrics.expectedPct}%` }}
                />
              </div>
            </div>

            {/* Avance real */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("w-2 h-2 rounded-full", execution.bg.replace("/10", ""))} />
                  <span className="font-medium">Avance real</span>
                  <span className="text-muted-foreground">
                    ({metrics.tasksDone}/{metrics.tasksTotal} tareas)
                  </span>
                </span>
                <span className={cn("font-mono-data font-semibold", execution.color)}>{metrics.realPct}%</span>
              </div>
              <div className="h-3 bg-muted/30 rounded-full overflow-hidden relative">
                <div
                  className={cn("h-full transition-all", execution.bg.replace("/10", "/80"))}
                  style={{ width: `${metrics.realPct}%` }}
                />
                {/* Marca de avance esperado */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground/80"
                  style={{ left: `${metrics.expectedPct}%` }}
                  title={`Esperado: ${metrics.expectedPct}%`}
                />
              </div>
            </div>

            {/* Diagnóstico */}
            <div className={cn(
              "flex items-start gap-2 p-3 rounded text-[12px] border",
              execution.bg, execution.border
            )}>
              {execution.key === "on_time" || execution.key === "completed" ? (
                <CheckCircle2 className={cn("w-4 h-4 shrink-0 mt-0.5", execution.color)} />
              ) : (
                <AlertTriangle className={cn("w-4 h-4 shrink-0 mt-0.5", execution.color)} />
              )}
              <div>
                <p className={cn("font-semibold", execution.color)}>
                  {metrics.gap <= 0
                    ? `Vas adelantado o al día (${Math.abs(metrics.gap)}% sobre lo esperado)`
                    : `Vas ${metrics.gap}% por debajo de lo esperado`}
                </p>
                {overdueCount > 0 && (
                  <p className="text-muted-foreground mt-1">
                    Hay <strong className="text-cost-negative">{overdueCount}</strong> tarea(s) vencida(s) que pueden afectar la entrega final.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Línea de tiempo visual */}
          <div className="surface-card p-4 space-y-3">
            <h4 className="text-[13px] font-semibold">Línea de tiempo</h4>
            <div className="relative h-10 bg-muted/20 rounded overflow-hidden border border-border">
              {/* Barra elapsed */}
              <div
                className="absolute top-0 bottom-0 bg-primary/15"
                style={{ width: `${Math.min(100, (metrics.elapsedDays / metrics.totalDays) * 100)}%` }}
              />
              {/* Marker hoy */}
              {metrics.elapsedDays > 0 && metrics.elapsedDays <= metrics.totalDays && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-primary"
                  style={{ left: `${(metrics.elapsedDays / metrics.totalDays) * 100}%` }}
                >
                  <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-primary" />
                  <div className="absolute -bottom-5 -translate-x-1/2 text-[9px] font-mono-data text-primary font-semibold whitespace-nowrap">
                    HOY
                  </div>
                </div>
              )}
              {/* Labels */}
              <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-mono-data text-muted-foreground">
                <span>{ymd(metrics.start)}</span>
                <span>{ymd(metrics.end)}</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground pt-3">
              Han transcurrido <strong className="text-foreground font-mono-data">{metrics.elapsedDays}</strong> de <strong className="text-foreground font-mono-data">{metrics.totalDays}</strong> días del cronograma.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
