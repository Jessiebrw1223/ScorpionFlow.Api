import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { ListChecks, Plus, Loader2, AlertTriangle, User, Calendar, LayoutGrid, List as ListIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TASK_PRIORITY_META, TASK_STATUS_META, TASK_IMPACT_META } from "@/lib/business-intelligence";
import TaskDetailPanel from "./TaskDetailPanel";
import { useAuth } from "@/contexts/AuthContext";
import { canCreateProjectWork, canEditAssignedTask, NO_EDIT_PERMISSION_MESSAGE, type WorkspaceRole } from "@/lib/workspace-permissions";

type TaskStatus = "todo" | "in_progress" | "in_review" | "done" | "blocked";
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
  node_type: string;
  assignee_name: string | null;
  assignee_id?: string | null;
  due_date: string | null;
  blocks_project: boolean;
  blocked_since: string | null;
  position: number;
  created_at: string;
}

const STATUS_COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: "todo", label: "Por hacer", color: "bg-status-todo" },
  { status: "in_progress", label: "En progreso", color: "bg-status-progress" },
  { status: "in_review", label: "En revisión", color: "bg-status-review" },
  { status: "done", label: "Completada", color: "bg-status-done" },
  { status: "blocked", label: "Bloqueada", color: "bg-status-blocked" },
];

const schema = z.object({
  title: z.string().trim().min(2, "Mínimo 2 caracteres").max(160),
  description: z.string().max(500).optional().or(z.literal("")),
  status: z.enum(["todo", "in_progress", "in_review", "done", "blocked"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  impact: z.enum(["time", "cost", "delivery"]),
  assignee_name: z.string().max(80).optional().or(z.literal("")),
  due_date: z.string().optional().or(z.literal("")),
  blocks_project: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const emptyForm: FormValues = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  impact: "delivery",
  assignee_name: "",
  due_date: "",
  blocks_project: false,
};

interface Props {
  projectId: string;
  defaultView?: "kanban" | "list";
  /** Filtra por tipo de nodo (epic/story/task/phase/subphase/activity). */
  nodeTypeFilter?: string | null;
  role?: WorkspaceRole;
  ownerId?: string | null;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
}

export default function ProjectTasksTab({ projectId, defaultView = "kanban", nodeTypeFilter, role = null, ownerId = null }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canCreate = canCreateProjectWork(role);
  const [view, setView] = useState<"kanban" | "list">(defaultView);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [panelTask, setPanelTask] = useState<Task | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const tasks = useMemo(
    () => (nodeTypeFilter ? allTasks.filter((t) => t.node_type === nodeTypeFilter) : allTasks),
    [allTasks, nodeTypeFilter]
  );

  const create = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!ownerId) throw new Error("Workspace no disponible");
      const payload = {
        owner_id: ownerId,
        project_id: projectId,
        title: values.title,
        description: values.description || null,
        status: values.status,
        priority: values.priority,
        impact: values.impact,
        assignee_name: values.assignee_name || null,
        due_date: values.due_date || null,
        blocks_project: values.blocks_project,
      };
      const { error } = await supabase.from("tasks").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-summary", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-calendar", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-report", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks-dash"] });
      toast.success("Tarea creada");
      setOpenForm(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const task = allTasks.find((t) => t.id === id);
      if (!canEditAssignedTask(role, task, user?.id)) throw new Error(NO_EDIT_PERMISSION_MESSAGE);
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
  });

  const openTaskPanel = (t: Task) => {
    setPanelTask(t);
    setPanelOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fld = parsed.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(fld).map(([k, v]) => [k, v?.[0]])) as any);
      return;
    }
    setErrors({});
    create.mutate(parsed.data);
  };

  const grouped = useMemo(() => {
    const m: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], in_review: [], done: [], blocked: [] };
    tasks.forEach((t) => m[t.status].push(t));
    return m;
  }, [tasks]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Tareas del proyecto</h2>
          <p className="text-[12px] text-muted-foreground">
            {tasks.length} tareas · {tasks.filter(t => t.blocks_project).length} bloqueando entrega
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center surface-card p-0.5 gap-0.5">
            {[
              { key: "kanban" as const, icon: LayoutGrid, label: "Tablero" },
              { key: "list" as const, icon: ListIcon, label: "Lista" },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-sf",
                  view === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
          <Dialog open={openForm} onOpenChange={setOpenForm}>
            <DialogTrigger asChild>
              <Button onClick={() => { setForm(emptyForm); setOpenForm(true); }} disabled={!canCreate} title={!canCreate ? NO_EDIT_PERMISSION_MESSAGE : undefined} className="fire-button font-semibold">
                <Plus className="w-4 h-4" /> Nueva tarea
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="fire-text">Nueva tarea</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <Label>Título *</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Configurar pasarela de pago" />
                    {errors.title && <p className="text-[12px] text-destructive">{errors.title}</p>}
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Descripción</Label>
                    <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Estado</Label>
                    <Select value={form.status} onValueChange={(v: TaskStatus) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_COLUMNS.map((s) => (<SelectItem key={s.status} value={s.status}>{s.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prioridad</Label>
                    <Select value={form.priority} onValueChange={(v: TaskPriority) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">⚪ Baja</SelectItem>
                        <SelectItem value="medium">🔵 Media</SelectItem>
                        <SelectItem value="high">🟠 Alta</SelectItem>
                        <SelectItem value="critical">🔴 Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Impacto en el negocio *</Label>
                    <Select value={form.impact} onValueChange={(v: TaskImpact) => setForm({ ...form, impact: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TASK_IMPACT_META).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      {TASK_IMPACT_META[form.impact]?.description}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Responsable</Label>
                    <Input value={form.assignee_name} onChange={(e) => setForm({ ...form, assignee_name: e.target.value })} placeholder="Nombre o equipo" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fecha límite</Label>
                    <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                  <div className="col-span-2 flex items-center gap-2 surface-card p-3 bg-cost-warning/5 border-cost-warning/30">
                    <Checkbox id="blocks" checked={form.blocks_project} onCheckedChange={(v) => setForm({ ...form, blocks_project: !!v })} />
                    <Label htmlFor="blocks" className="cursor-pointer flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-cost-warning" />
                      Esta tarea impacta en el retraso del proyecto
                    </Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
                  <Button type="submit" disabled={create.isPending} className="fire-button">
                    {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Crear tarea
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" /> Cargando tareas…
        </div>
      ) : tasks.length === 0 ? (
        <div className="surface-card fire-border p-8 text-center space-y-3">
          <ListChecks className="w-10 h-10 text-primary fire-icon mx-auto" />
          <div>
            <p className="font-semibold text-foreground">Aún no hay tareas en este proyecto</p>
            <p className="text-[13px] text-muted-foreground mt-1">
              Empieza desglosando lo que vendiste en pequeños bloques de trabajo.
            </p>
          </div>
          <Button onClick={() => { setForm(emptyForm); setOpenForm(true); }} disabled={!canCreate} title={!canCreate ? NO_EDIT_PERMISSION_MESSAGE : undefined} className="fire-button">
            <Plus className="w-4 h-4" /> Crear primera tarea
          </Button>
        </div>
      ) : view === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {STATUS_COLUMNS.map(({ status, label, color }) => (
            <div key={status} className="space-y-2">
              <div className="flex items-center gap-2 px-1 py-2">
                <div className={cn("w-2 h-2 rounded-full", color)} />
                <span className="text-[13px] font-medium text-foreground">{label}</span>
                <span className="text-[12px] font-mono-data text-muted-foreground ml-auto">{grouped[status].length}</span>
              </div>
              <div className="space-y-2 min-h-[120px]">
                {grouped[status].length === 0 ? (
                  <div className="surface-card p-3 text-center text-[11px] text-muted-foreground border border-dashed">
                    Sin tareas
                  </div>
                ) : (
                  grouped[status].map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onOpen={openTaskPanel}
                      onMove={(s) => move.mutate({ id: t.id, status: s })}
                      canMove={canEditAssignedTask(role, t, user?.id)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ListBacklog tasks={tasks} onOpen={openTaskPanel} />
      )}

      <TaskDetailPanel
        task={panelTask}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        projectId={projectId}
        role={role}
        userId={user?.id ?? null}
      />
    </div>
  );
}

function TaskCard({ task, onOpen, onMove, canMove }: { task: Task; onOpen: (t: Task) => void; onMove: (s: TaskStatus) => void; canMove: boolean; }) {
  const pr = TASK_PRIORITY_META[task.priority];
  const im = TASK_IMPACT_META[task.impact || "delivery"];
  const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
  return (
    <div
      className={cn(
        "surface-card surface-card-hover p-2.5 space-y-2 cursor-pointer group",
        task.blocks_project && "border-l-2 border-cost-warning",
        task.status === "blocked" && "border-l-2 border-destructive"
      )}
      onClick={() => onOpen(task)}
    >
      <div className="flex items-start gap-1.5 flex-wrap">
        <span className={cn("text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded shrink-0", pr.bg, pr.color)}>
          {pr.emoji} {pr.label}
        </span>
        <span className={cn("text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded shrink-0 inline-flex items-center gap-1", im.bg, im.color)} title={im.description}>
          <span>{im.emoji}</span> {im.short}
        </span>
        {task.blocks_project && (
          <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-cost-warning/10 text-cost-warning shrink-0 inline-flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" /> Bloquea
          </span>
        )}
      </div>
      <div className="font-medium text-[13px] text-foreground line-clamp-2 group-hover:text-primary transition-sf">{task.title}</div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        {task.assignee_name ? (
          <span className="inline-flex items-center gap-1.5" title={task.assignee_name}>
            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[9px] font-bold text-primary-foreground">
              {getInitials(task.assignee_name)}
            </span>
            <span className="truncate max-w-[80px]">{task.assignee_name.split(" ")[0]}</span>
          </span>
        ) : <span />}
        {task.due_date && (
          <span className={cn("inline-flex items-center gap-1 font-mono-data", overdue && "text-destructive font-semibold")}>
            <Calendar className="w-3 h-3" /> {new Date(task.due_date).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 pt-1 border-t border-border" onClick={(e) => e.stopPropagation()}>
        <Select value={task.status} onValueChange={(v: TaskStatus) => onMove(v)} disabled={!canMove}>
          <SelectTrigger className="h-7 text-[11px] flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(TASK_STATUS_META).map(([k, v]) => (<SelectItem key={k} value={k}>{v.label}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ListBacklog({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  return (
    <div className="surface-card overflow-hidden">
      {/* Header tabla */}
      <div className="hidden md:grid grid-cols-[1fr_auto_140px_110px_110px_120px] gap-3 px-4 py-2.5 border-b border-border bg-muted/20 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
        <div>Tarea</div>
        <div>Resp.</div>
        <div>Estado</div>
        <div>Prioridad</div>
        <div>Impacto</div>
        <div>Fecha</div>
      </div>
      <div className="divide-y divide-border">
        {tasks.map((t) => (<TaskRow key={t.id} task={t} onOpen={onOpen} />))}
      </div>
    </div>
  );
}

function TaskRow({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const pr = TASK_PRIORITY_META[task.priority];
  const st = TASK_STATUS_META[task.status];
  const im = TASK_IMPACT_META[task.impact || "delivery"];
  const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
  return (
    <div
      className="grid md:grid-cols-[1fr_auto_140px_110px_110px_120px] grid-cols-1 gap-3 px-4 py-2.5 items-center cursor-pointer hover:bg-muted/20 transition-sf group"
      onClick={() => onOpen(task)}
    >
      <div className="min-w-0 flex items-center gap-2">
        {task.blocks_project && (
          <AlertTriangle className="w-3.5 h-3.5 text-cost-warning shrink-0" />
        )}
        <div className="min-w-0">
          <div className="font-medium text-[13px] text-foreground truncate group-hover:text-primary transition-sf">
            {task.title}
          </div>
          {task.description && (
            <div className="text-[11px] text-muted-foreground truncate hidden md:block">
              {task.description}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center" title={task.assignee_name || "Sin asignar"}>
        {task.assignee_name ? (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] font-bold text-primary-foreground">
            {getInitials(task.assignee_name)}
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-muted border border-dashed border-border flex items-center justify-center">
            <User className="w-3 h-3 text-muted-foreground" />
          </div>
        )}
      </div>
      <div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
          <span className={cn("w-1.5 h-1.5 rounded-full", st.color)} />
          {st.label}
        </span>
      </div>
      <div>
        <span className={cn("text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded", pr.bg, pr.color)}>
          {pr.emoji} {pr.label}
        </span>
      </div>
      <div>
        <span className={cn("text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1", im.bg, im.color)} title={im.description}>
          {im.emoji} {im.short}
        </span>
      </div>
      <div className={cn("text-[12px] font-mono-data", overdue ? "text-destructive font-semibold" : "text-muted-foreground")}>
        {task.due_date ? (
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(task.due_date).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
            {overdue && " ⚠"}
          </span>
        ) : "—"}
      </div>
    </div>
  );
}
