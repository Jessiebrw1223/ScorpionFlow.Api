import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, AlertTriangle, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  TASK_IMPACT_META,
  TASK_STATUS_META,
  NODE_TYPE_META,
} from "@/lib/business-intelligence";
import TaskDetailPanel from "./TaskDetailPanel";

interface Props {
  projectId: string;
  nodeTypeFilter?: string | null;
}

interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  status: string;
  impact: string;
  node_type: string;
  start_date: string | null;
  due_date: string | null;
  blocks_project: boolean;
  assignee_name: string | null;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  // Postgres date 'YYYY-MM-DD'
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function PlanningTimelineView({ projectId, nodeTypeFilter }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [panelTask, setPanelTask] = useState<any>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const { data: rawTasks = [], isLoading } = useQuery({
    queryKey: ["project-tasks-timeline", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .or("start_date.not.is.null,due_date.not.is.null");
      if (error) throw error;
      return data as TaskRow[];
    },
  });

  const tasks = useMemo(
    () => (nodeTypeFilter ? rawTasks.filter((t) => t.node_type === nodeTypeFilter) : rawTasks),
    [rawTasks, nodeTypeFilter]
  );

  const monthLabel = cursor.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const firstDayWeek = (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7;

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth(), daysInMonth, 23, 59, 59);

  // Para cada día del mes, qué elementos están activos (entre start_date y due_date)
  const tasksByDay = useMemo(() => {
    const map: Record<number, TaskRow[]> = {};
    tasks.forEach((t) => {
      const start = parseDate(t.start_date) || parseDate(t.due_date);
      const end = parseDate(t.due_date) || parseDate(t.start_date);
      if (!start || !end) return;
      // Recortar al mes visible
      const s = start < monthStart ? monthStart : start;
      const e = end > monthEnd ? monthEnd : end;
      if (s > monthEnd || e < monthStart) return;
      for (let d = s.getDate(); d <= e.getDate(); d++) {
        if (!map[d]) map[d] = [];
        map[d].push(t);
      }
    });
    return map;
  }, [tasks, cursor.getFullYear(), cursor.getMonth()]);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === cursor.getFullYear() && today.getMonth() === cursor.getMonth();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const goPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const goToday = () => {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" /> Cargando cronograma…
      </div>
    );
  }

  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const overdueCount = tasks.filter(
    (t) => t.status !== "done" && t.due_date && parseDate(t.due_date)! < today
  ).length;
  const todayCount = isCurrentMonth ? (tasksByDay[today.getDate()] || []).length : 0;

  return (
    <>
      <div className="surface-card p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={goPrev} className="surface-card p-1.5 hover:bg-muted/40 transition-sf">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={goToday} className="text-[12px] font-medium px-3 py-1.5 surface-card hover:bg-muted/40 transition-sf">
              Hoy
            </button>
            <button onClick={goNext} className="surface-card p-1.5 hover:bg-muted/40 transition-sf">
              <ChevronRight className="w-4 h-4" />
            </button>
            <h3 className="text-base font-semibold capitalize ml-2">{monthLabel}</h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {isCurrentMonth && (
              <span className="inline-flex items-center gap-1 text-primary font-semibold">
                <CalendarIcon className="w-3 h-3" /> {todayCount} hoy
              </span>
            )}
            <span>{tasks.length} con cronograma</span>
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1 text-destructive font-semibold">
                <AlertTriangle className="w-3 h-3" /> {overdueCount} atrasada(s)
              </span>
            )}
          </div>
        </div>

        {/* Días de semana */}
        <div className="grid grid-cols-7 gap-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-center">
          {weekDays.map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        {/* Celdas */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} className="min-h-[110px]" />;
            }
            const dayTasks = tasksByDay[day] || [];
            const isToday = isCurrentMonth && day === today.getDate();
            const cellDate = new Date(cursor.getFullYear(), cursor.getMonth(), day);
            cellDate.setHours(23, 59, 59, 999);

            return (
              <div
                key={day}
                className={cn(
                  "surface-card p-1.5 min-h-[110px] flex flex-col gap-1",
                  isToday && "border-primary bg-primary/5"
                )}
              >
                <div className={cn(
                  "text-[11px] font-mono-data font-semibold flex items-center justify-between",
                  isToday ? "text-primary" : "text-muted-foreground"
                )}>
                  <span>{day}</span>
                  {dayTasks.length > 0 && (
                    <span className="text-[9px] bg-muted/40 px-1 rounded">{dayTasks.length}</span>
                  )}
                </div>
                <div className="space-y-1 flex-1 overflow-hidden">
                  {dayTasks.slice(0, 3).map((t) => {
                    const im = TASK_IMPACT_META[t.impact || "delivery"];
                    const st = TASK_STATUS_META[t.status];
                    const nm = NODE_TYPE_META[t.node_type] || NODE_TYPE_META.task;
                    const overdue = t.status !== "done" && t.due_date && parseDate(t.due_date)! < today;
                    const start = parseDate(t.start_date);
                    const end = parseDate(t.due_date);
                    const isStart = start && start.getDate() === day && start.getMonth() === cursor.getMonth();
                    const isEnd = end && end.getDate() === day && end.getMonth() === cursor.getMonth();
                    const isMiddle = !isStart && !isEnd;

                    return (
                      <button
                        key={`${t.id}-${day}`}
                        onClick={() => {
                          setPanelTask(t);
                          setPanelOpen(true);
                        }}
                        className={cn(
                          "w-full text-left text-[10px] px-1.5 py-1 truncate flex items-center gap-1 transition-sf hover:scale-[1.02]",
                          im.bg,
                          im.color,
                          // Bordes según posición en barra
                          isStart && "rounded-l rounded-r-none",
                          isEnd && "rounded-r rounded-l-none",
                          isMiddle && "rounded-none",
                          isStart && isEnd && "rounded",
                          t.blocks_project && "ring-1 ring-cost-warning",
                          overdue && "ring-1 ring-destructive"
                        )}
                        title={`${nm.short}: ${t.title} — ${st.label}${overdue ? " (Atrasada)" : ""}`}
                      >
                        {(isStart || (isStart && isEnd)) && (
                          <span className="shrink-0 text-[9px] opacity-70">{nm.emoji}</span>
                        )}
                        {overdue && <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-destructive" />}
                        <span className="truncate">{isStart || (start?.getMonth() !== cursor.getMonth()) ? t.title : "·"}</span>
                      </button>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <div className="text-[10px] text-muted-foreground font-mono-data px-1">
                      +{dayTasks.length - 3} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground pt-2 border-t border-border">
          <span className="font-medium">Impacto:</span>
          {Object.entries(TASK_IMPACT_META).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={cn("w-2.5 h-2.5 rounded", v.bg)} />
              <span>{v.emoji} {v.short}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-destructive" /> Atrasada
          </span>
          <span className="ml-auto italic">
            Las barras indican duración (inicio → fin)
          </span>
        </div>
      </div>

      <TaskDetailPanel task={panelTask} open={panelOpen} onOpenChange={setPanelOpen} projectId={projectId} />
    </>
  );
}
