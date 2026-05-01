import {
  tasks as allTasks,
  statusLabels,
  priorityLabels,
  costFormatter,
  type TaskStatus,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const statusDotColor: Record<TaskStatus, string> = {
  todo: "bg-status-todo",
  in_progress: "bg-status-progress",
  in_review: "bg-status-review",
  done: "bg-status-done",
  blocked: "bg-status-blocked",
};

export function TaskListView() {
  return (
    <div className="surface-card overflow-hidden">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-2.5 text-[12px] font-medium text-muted-foreground uppercase tracking-wide">N°</th>
            <th className="px-4 py-2.5 text-[12px] font-medium text-muted-foreground uppercase tracking-wide">Tarea</th>
            <th className="px-4 py-2.5 text-[12px] font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
            <th className="px-4 py-2.5 text-[12px] font-medium text-muted-foreground uppercase tracking-wide">Prioridad</th>
            <th className="px-4 py-2.5 text-[12px] font-medium text-muted-foreground uppercase tracking-wide">Encargado</th>
            <th className="px-4 py-2.5 text-[12px] font-medium text-muted-foreground uppercase tracking-wide text-right">Costo Est.</th>
            <th className="px-4 py-2.5 text-[12px] font-medium text-muted-foreground uppercase tracking-wide text-right">Costo Real</th>
            <th className="px-4 py-2.5 text-[12px] font-medium text-muted-foreground uppercase tracking-wide">Vencimiento</th>
          </tr>
        </thead>
        <tbody>
          {allTasks.map((task) => {
            const isOverBudget = task.actualCost > task.estimatedCost && task.actualCost > 0;
            return (
              <tr
                key={task.id}
                className={cn(
                  "border-b border-border hover:bg-muted/50 transition-sf cursor-pointer",
                  isOverBudget && "border-l-2 border-l-accent"
                )}
              >
                <td className="px-4 py-2.5 font-mono-data text-[12px] text-muted-foreground">
                  {task.id}
                </td>
                <td className="px-4 py-2.5 font-medium text-foreground max-w-[240px] truncate">
                  {task.title}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-1.5 h-1.5 rounded-full", statusDotColor[task.status])} />
                    <span className="text-[12px]">{statusLabels[task.status]}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-[12px]">{priorityLabels[task.priority]}</td>
                <td className="px-4 py-2.5 text-[12px]">{task.assignee}</td>
                <td className="px-4 py-2.5 font-mono-data text-[12px] text-right">
                  {costFormatter.format(task.estimatedCost)}
                </td>
                <td className={cn(
                  "px-4 py-2.5 font-mono-data text-[12px] text-right",
                  isOverBudget ? "text-cost-negative font-medium" : ""
                )}>
                  {task.actualCost > 0 ? costFormatter.format(task.actualCost) : "—"}
                </td>
                <td className="px-4 py-2.5 font-mono-data text-[12px] text-muted-foreground">
                  {task.dueDate}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
