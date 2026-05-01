import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronDown, Plus, Loader2, AlertTriangle, Calendar, User, Layers } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TASK_IMPACT_META,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  NODE_TYPE_META,
  getNodeTypesForMode,
  isContainerNode,
  computeContainerProgress,
} from "@/lib/business-intelligence";
import TaskDetailPanel from "./TaskDetailPanel";

interface Props {
  projectId: string;
  mode: "agile" | "traditional";
  onCreate: (parentId: string | null, nodeType: string) => void;
  /** Si está definido, solo muestra nodos de ese tipo (y sus padres si aplica). */
  nodeTypeFilter?: string | null;
  canCreate?: boolean;
}

interface TaskRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  node_type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  impact: string;
  assignee_name: string | null;
  due_date: string | null;
  start_date: string | null;
  blocks_project: boolean;
  position: number;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

export default function PlanningHierarchyView({ projectId, mode, onCreate, nodeTypeFilter, canCreate = true }: Props) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [panelTask, setPanelTask] = useState<TaskRow | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["project-tasks-hierarchy", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TaskRow[];
    },
  });

  const nodeTypes = getNodeTypesForMode(mode);
  const [rootType, midType, leafType] = nodeTypes;

  // Si hay filtro por tipo, mostramos solo nodos de ese tipo en plano (sin jerarquía).
  // Si no hay filtro, agrupamos por jerarquía.
  const tree = useMemo(() => {
    if (nodeTypeFilter) {
      const filtered = tasks.filter((t) => t.node_type === nodeTypeFilter);
      return { roots: filtered, orphans: [] as TaskRow[], flat: true };
    }
    const roots = tasks.filter((t) => t.node_type === rootType);
    const orphans = tasks.filter((t) => {
      // Tareas sin padre que no son del tipo raíz (datos legacy)
      return !t.parent_id && t.node_type !== rootType;
    });
    return { roots, orphans, flat: false };
  }, [tasks, rootType, nodeTypeFilter]);

  const childrenOf = (parentId: string) =>
    nodeTypeFilter ? [] : tasks.filter((t) => t.parent_id === parentId);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(tasks.map((t) => t.id)));
  const collapseAll = () => setExpanded(new Set());

  if (isLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" /> Cargando backlog…
      </div>
    );
  }

  if (tasks.length === 0) {
    const rootMeta = NODE_TYPE_META[rootType];
    return (
      <div className="surface-card p-10 text-center space-y-3">
        <Layers className="w-10 h-10 text-primary mx-auto opacity-40" />
        <p className="font-semibold">Backlog vacío</p>
        <p className="text-[13px] text-muted-foreground max-w-sm mx-auto">
          Empieza creando una <strong>{rootMeta.label}</strong> para organizar el trabajo del proyecto.
        </p>
        <Button onClick={() => onCreate(null, rootType)} disabled={!canCreate} size="sm" className="fire-button mt-2">
          <Plus className="w-4 h-4" /> Nueva {rootMeta.label}
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Header de la lista */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="font-mono-data">{tree.roots.length}</span>
          <span>{NODE_TYPE_META[rootType].label}(s)</span>
          <span className="text-border">·</span>
          <span className="font-mono-data">{tasks.filter((t) => t.node_type === midType).length}</span>
          <span>{NODE_TYPE_META[midType].label}(s)</span>
          <span className="text-border">·</span>
          <span className="font-mono-data">{tasks.filter((t) => t.node_type === leafType).length}</span>
          <span>{NODE_TYPE_META[leafType].label}(s)</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={expandAll} className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/40 transition-sf">
            Expandir todo
          </button>
          <button onClick={collapseAll} className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/40 transition-sf">
            Contraer
          </button>
          <Button size="sm" variant="outline" onClick={() => onCreate(null, rootType)} disabled={!canCreate} className="ml-2">
            <Plus className="w-3.5 h-3.5" /> Nueva {NODE_TYPE_META[rootType].label}
          </Button>
        </div>
      </div>

      {/* Tabla jerárquica */}
      <div className="surface-card overflow-hidden">
        {/* Cabecera */}
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-secondary/40 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          <div className="col-span-5">Elemento</div>
          <div className="col-span-1 text-center">Estado</div>
          <div className="col-span-1 text-center">Prior.</div>
          <div className="col-span-1 text-center">Impacto</div>
          <div className="col-span-1 text-center">Resp.</div>
          <div className="col-span-2">Fechas</div>
          <div className="col-span-1 text-right">Acciones</div>
        </div>

        <div className="divide-y divide-border">
          {tree.roots.map((root) => (
            <HierarchyNode
              key={root.id}
              node={root}
              level={0}
              expanded={expanded}
              toggle={toggle}
              childrenOf={childrenOf}
              onOpen={(t) => {
                setPanelTask(t);
                setPanelOpen(true);
              }}
              onCreateChild={(parent) => {
                const childType = parent.node_type === rootType ? midType : leafType;
                onCreate(parent.id, childType);
              }}
              mode={mode}
              canCreate={canCreate}
            />
          ))}

          {/* Datos legacy sin jerarquía */}
          {tree.orphans.length > 0 && (
            <div className="bg-muted/10">
              <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
                Sin agrupar ({tree.orphans.length})
              </div>
              {tree.orphans.map((o) => (
                <HierarchyNode
                  key={o.id}
                  node={o}
                  level={0}
                  expanded={expanded}
                  toggle={toggle}
                  childrenOf={childrenOf}
                  onOpen={(t) => {
                    setPanelTask(t);
                    setPanelOpen(true);
                  }}
                  onCreateChild={() => {}}
                  mode={mode}
                  isOrphan
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <TaskDetailPanel task={panelTask as any} open={panelOpen} onOpenChange={setPanelOpen} projectId={projectId} />
    </>
  );
}

interface NodeProps {
  node: TaskRow;
  level: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  childrenOf: (id: string) => TaskRow[];
  onOpen: (t: TaskRow) => void;
  onCreateChild: (parent: TaskRow) => void;
  mode: "agile" | "traditional";
  isOrphan?: boolean;
  canCreate?: boolean;
}

function HierarchyNode({ node, level, expanded, toggle, childrenOf, onOpen, onCreateChild, mode, isOrphan, canCreate = true }: NodeProps) {
  const kids = childrenOf(node.id);
  const isOpen = expanded.has(node.id);
  const meta = NODE_TYPE_META[node.node_type] || NODE_TYPE_META.task;
  const st = TASK_STATUS_META[node.status];
  const pr = TASK_PRIORITY_META[node.priority];
  const im = TASK_IMPACT_META[node.impact || "delivery"];
  const overdue = node.due_date && node.status !== "done" && new Date(node.due_date) < new Date();

  // Avance del nodo (PMBOK 8 + regla anti-humo):
  // - Contenedores (épica/HU/fase/subfase): SIEMPRE se calculan por hojas reales
  //   ponderadas (excluyendo canceladas). El status del propio contenedor no
  //   puede inflar el porcentaje a 100% si hay hojas pendientes.
  // - Hojas (task/activity): 100 si done, 0 en otro caso.
  const allDescendants = (id: string): TaskRow[] => {
    const direct = childrenOf(id);
    return direct.concat(direct.flatMap((d) => allDescendants(d.id)));
  };
  const descendants = allDescendants(node.id);
  const leafDescendants = descendants.filter(
    (d) => !isContainerNode(d as any) && d.status !== "cancelled"
  );
  const isContainer = isContainerNode(node as any);
  const progressPct = isContainer
    ? computeContainerProgress(leafDescendants as any)
    : node.status === "done"
    ? 100
    : node.status === "cancelled"
    ? 0
    : 0;

  return (
    <>
      <div
        className={cn(
          "grid grid-cols-12 gap-2 px-3 py-2 items-center hover:bg-muted/20 transition-sf group",
          level === 0 && "bg-secondary/20"
        )}
        style={{ paddingLeft: `${12 + level * 20}px` }}
      >
        {/* Elemento (col 5) */}
        <div className="col-span-5 min-w-0 flex items-center gap-1.5">
          {kids.length > 0 ? (
            <button
              onClick={() => toggle(node.id)}
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-muted/60 transition-sf"
            >
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}

          <span
            className={cn(
              "shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
              meta.bg,
              meta.color
            )}
            title={meta.label}
          >
            {meta.emoji} {meta.short}
          </span>

          <button
            onClick={() => onOpen(node)}
            className={cn(
              "min-w-0 truncate text-left text-[13px] hover:text-primary transition-sf",
              level === 0 ? "font-semibold" : "font-normal",
              node.status === "done" && "line-through text-muted-foreground"
            )}
            title={node.title}
          >
            {node.title}
          </button>

          {node.blocks_project && (
            <AlertTriangle className="w-3 h-3 text-cost-warning shrink-0" />
          )}

          {/* Mini progress para épicas/HU/fases */}
          {kids.length > 0 && (
            <span className="shrink-0 text-[10px] font-mono-data text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded ml-1">
              {progressPct}%
            </span>
          )}
        </div>

        {/* Estado */}
        <div className="col-span-1 text-center">
          <span className="inline-flex items-center gap-1 text-[11px]">
            <span className={cn("w-1.5 h-1.5 rounded-full", st.color)} />
            <span className="hidden xl:inline truncate">{st.label}</span>
          </span>
        </div>

        {/* Prioridad */}
        <div className="col-span-1 text-center">
          <span className={cn("inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded", pr.bg, pr.color)}>
            {pr.label}
          </span>
        </div>

        {/* Impacto */}
        <div className="col-span-1 text-center">
          <span className={cn("inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded", im.bg, im.color)} title={im.label}>
            {im.emoji}
          </span>
        </div>

        {/* Responsable */}
        <div className="col-span-1 text-center">
          {node.assignee_name ? (
            <div
              className="inline-flex w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent items-center justify-center text-[10px] font-bold text-primary-foreground"
              title={node.assignee_name}
            >
              {getInitials(node.assignee_name)}
            </div>
          ) : (
            <span className="text-muted-foreground text-[11px]">—</span>
          )}
        </div>

        {/* Fechas */}
        <div className="col-span-2 text-[11px] font-mono-data">
          {node.start_date || node.due_date ? (
            <div className={cn("flex items-center gap-1", overdue && "text-destructive font-semibold")}>
              <Calendar className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {node.start_date && new Date(node.start_date).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                {node.start_date && node.due_date && " → "}
                {node.due_date && new Date(node.due_date).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>

        {/* Acciones */}
        <div className="col-span-1 text-right">
          {!isOrphan && meta.level < 2 && canCreate && (
            <button
              onClick={() => onCreateChild(node)}
              className="opacity-0 group-hover:opacity-100 text-[11px] inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-sf"
              title={`Agregar ${meta.level === 0 ? NODE_TYPE_META[mode === "agile" ? "story" : "subphase"].label : NODE_TYPE_META[mode === "agile" ? "task" : "activity"].label}`}
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Hijos */}
      {isOpen && kids.map((k) => (
        <HierarchyNode
          key={k.id}
          node={k}
          level={level + 1}
          expanded={expanded}
          toggle={toggle}
          childrenOf={childrenOf}
          onOpen={onOpen}
          onCreateChild={onCreateChild}
          mode={mode}
          canCreate={canCreate}
        />
      ))}
    </>
  );
}
