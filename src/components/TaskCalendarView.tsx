import { useState, useMemo } from "react";
import { tasks, statusLabels, priorityLabels, type Task } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-[hsl(var(--status-todo))]",
  in_progress: "bg-[hsl(var(--status-progress))]",
  in_review: "bg-[hsl(var(--status-review))]",
  done: "bg-[hsl(var(--status-done))]",
  blocked: "bg-[hsl(var(--status-blocked))]",
};

const STATUS_DOT: Record<string, string> = {
  todo: "bg-[hsl(var(--status-todo))]",
  in_progress: "bg-[hsl(var(--status-progress))]",
  in_review: "bg-[hsl(var(--status-review))]",
  done: "bg-[hsl(var(--status-done))]",
  blocked: "bg-[hsl(var(--status-blocked))]",
};

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday-based
}

// Derive a pseudo start date from dueDate and estimatedHours
function getTaskStartDate(task: Task): string {
  const due = new Date(task.dueDate);
  const workDays = Math.max(Math.ceil(task.estimatedHours / 8), 1);
  const start = new Date(due);
  start.setDate(start.getDate() - workDays);
  return start.toISOString().split("T")[0];
}

function getTaskProgress(task: Task): number {
  if (task.status === "done") return 100;
  if (task.status === "todo") return 0;
  if (task.estimatedHours === 0) return 0;
  return Math.min(Math.round((task.loggedHours / task.estimatedHours) * 100), 100);
}

interface DayTaskInfo {
  task: Task;
  type: "start" | "end" | "in-progress";
}

export function TaskCalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1)); // March 2026 to match mock data

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date(2026, 2, 15));

  // Build a map: day -> tasks
  const dayMap = useMemo(() => {
    const map: Record<number, DayTaskInfo[]> = {};
    tasks.forEach((task) => {
      const startStr = getTaskStartDate(task);
      const endStr = task.dueDate;
      const start = new Date(startStr);
      const end = new Date(endStr);

      for (let d = 1; d <= daysInMonth; d++) {
        const current = new Date(year, month, d);
        const currentStr = current.toISOString().split("T")[0];

        if (currentStr === startStr && current.getMonth() === month) {
          if (!map[d]) map[d] = [];
          map[d].push({ task, type: "start" });
        } else if (currentStr === endStr && current.getMonth() === month) {
          if (!map[d]) map[d] = [];
          map[d].push({ task, type: "end" });
        } else if (current > start && current < end && current.getMonth() === month) {
          if (!map[d]) map[d] = [];
          map[d].push({ task, type: "in-progress" });
        }
      }
    });
    return map;
  }, [year, month, daysInMonth]);

  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  // Legend
  const statuses = [
    { key: "todo", label: "Pendiente" },
    { key: "in_progress", label: "En Proceso" },
    { key: "in_review", label: "En Revisión" },
    { key: "done", label: "Finalizada" },
    { key: "blocked", label: "Bloqueada" },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded hover:bg-secondary transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h2 className="text-sm font-semibold text-foreground min-w-[160px] text-center">
            {MONTHS[month]} {year}
          </h2>
          <button onClick={nextMonth} className="p-1.5 rounded hover:bg-secondary transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={goToday}
            className="ml-2 text-[11px] px-2 py-1 rounded bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
          >
            Hoy
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3">
          {statuses.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <div className={cn("w-2.5 h-2.5 rounded-full", STATUS_DOT[s.key])} />
              <span className="text-[10px] text-muted-foreground">{s.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-4 h-1 rounded bg-primary/60" />
            <span className="text-[10px] text-muted-foreground">Progreso</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="surface-card overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-2 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {/* Empty cells for offset */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[110px] border-b border-r border-border bg-secondary/20" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayTasks = dayMap[day] || [];
            const isTodayCell = isToday(day);

            return (
              <div
                key={day}
                className={cn(
                  "min-h-[110px] border-b border-r border-border p-1.5 transition-colors hover:bg-secondary/30",
                  isTodayCell && "bg-primary/5"
                )}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full",
                      isTodayCell
                        ? "bg-primary text-primary-foreground font-bold"
                        : "text-muted-foreground"
                    )}
                  >
                    {day}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[9px] text-muted-foreground">{dayTasks.length}</span>
                  )}
                </div>

                {/* Task entries */}
                <div className="space-y-0.5 overflow-hidden max-h-[80px]">
                  {dayTasks.slice(0, 3).map(({ task, type }) => {
                    const progress = getTaskProgress(task);
                    return (
                      <div
                        key={`${task.id}-${type}`}
                        className={cn(
                          "group relative rounded px-1 py-0.5 cursor-pointer transition-colors",
                          "hover:bg-secondary/60"
                        )}
                        title={`${task.title}\nEstado: ${statusLabels[task.status]}\nProgreso: ${progress}%\nVence: ${task.dueDate}`}
                      >
                        <div className="flex items-center gap-1">
                          {/* Status dot */}
                          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[task.status])} />

                          {/* Type indicator */}
                          {type === "start" && (
                            <span className="text-[8px] font-bold text-[hsl(var(--status-progress))] shrink-0">▶</span>
                          )}
                          {type === "end" && (
                            <span className="text-[8px] font-bold text-primary shrink-0">■</span>
                          )}

                          {/* Task name */}
                          <span className="text-[10px] text-foreground truncate leading-tight">
                            {task.id.split("-")[0]}-{task.id.split("-")[1]}
                          </span>
                        </div>

                        {/* Progress bar (only on start/end markers) */}
                        {(type === "start" || type === "end") && (
                          <div className="mt-0.5 w-full h-[3px] rounded-full bg-secondary overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                progress === 100
                                  ? "bg-[hsl(var(--status-done))]"
                                  : progress > 0
                                  ? "bg-primary/70"
                                  : "bg-muted-foreground/30"
                              )}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <span className="text-[9px] text-muted-foreground pl-1">
                      +{dayTasks.length - 3} más
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary cards below calendar */}
      <div className="grid grid-cols-4 gap-3">
        {(["todo", "in_progress", "in_review", "done"] as const).map((status) => {
          const filtered = tasks.filter((t) => t.status === status);
          return (
            <div key={status} className="surface-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("w-2 h-2 rounded-full", STATUS_DOT[status])} />
                <span className="text-[11px] font-semibold text-foreground">{statusLabels[status]}</span>
                <span className="text-[11px] text-muted-foreground ml-auto">{filtered.length}</span>
              </div>
              <div className="space-y-1.5">
                {filtered.slice(0, 3).map((task) => {
                  const progress = getTaskProgress(task);
                  return (
                    <div key={task.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-foreground truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-[2px] rounded-full bg-secondary overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                progress === 100 ? "bg-[hsl(var(--status-done))]" : "bg-primary/60"
                              )}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-muted-foreground">{progress}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
