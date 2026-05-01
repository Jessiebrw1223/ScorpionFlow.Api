import { useState } from "react";
import { tasks as allTasks, statusLabels, type TaskStatus } from "@/lib/mock-data";
import { TaskCard } from "@/components/TaskCard";
import { cn } from "@/lib/utils";

const columns: { status: TaskStatus; color: string }[] = [
  { status: "todo", color: "bg-status-todo" },
  { status: "in_progress", color: "bg-status-progress" },
  { status: "in_review", color: "bg-status-review" },
  { status: "done", color: "bg-status-done" },
  { status: "blocked", color: "bg-status-blocked" },
];

export function KanbanBoard() {
  const [tasks] = useState(allTasks);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map(({ status, color }) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        return (
          <div
            key={status}
            className="flex-shrink-0 w-[280px] space-y-2"
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-1 py-2">
              <div className={cn("w-2 h-2 rounded-full", color)} />
              <span className="text-[13px] font-medium text-foreground">
                {statusLabels[status]}
              </span>
              <span className="text-[12px] font-mono-data text-muted-foreground ml-auto">
                {columnTasks.length}
              </span>
            </div>

            {/* Tasks */}
            <div className="space-y-2">
              {columnTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
              {columnTasks.length === 0 && (
                <div className="surface-card p-4 text-center text-[12px] text-muted-foreground">
                  Sin tareas
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
