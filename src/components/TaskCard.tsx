import { Task, costFormatter, priorityLabels } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
}

const priorityColors: Record<string, string> = {
  low: "bg-secondary text-secondary-foreground",
  medium: "bg-status-progress/15 text-status-progress",
  high: "bg-cost-warning/15 text-cost-warning",
  critical: "bg-cost-negative/15 text-cost-negative",
};

export function TaskCard({ task }: TaskCardProps) {
  const isOverBudget = task.actualCost > task.estimatedCost && task.actualCost > 0;
  const initial = task.assignee
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <div
      className={cn(
        "surface-card surface-card-hover p-3 cursor-pointer",
        isOverBudget && "scorpion-border-left-alert"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono-data text-[11px] text-primary/70">{task.id}</span>
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", priorityColors[task.priority])}>
          {priorityLabels[task.priority]}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-[13px] font-medium text-foreground leading-snug line-clamp-2 mb-2">
        {task.title}
      </h4>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-[9px] font-semibold text-primary">{initial}</span>
          </div>
          <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
            {task.assignee.split(" ")[0]}
          </span>
        </div>
        <span
          className={cn(
            "font-mono-data text-[11px] font-semibold",
            isOverBudget ? "text-cost-negative" : "text-foreground"
          )}
        >
          {costFormatter.format(task.estimatedCost)}
        </span>
      </div>
    </div>
  );
}
