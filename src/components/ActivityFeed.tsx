import { CheckCircle2, Clock, AlertTriangle, ArrowRight } from "lucide-react";

const activities = [
  { icon: CheckCircle2, iconClass: "text-status-done", text: "ALPHA-002 marcada como finalizada", time: "Hace 2h", user: "Carlos López" },
  { icon: AlertTriangle, iconClass: "text-status-blocked", text: "ALPHA-007 bloqueada por dependencia", time: "Hace 3h", user: "Elena Martín" },
  { icon: Clock, iconClass: "text-status-progress", text: "GAMMA-002 actualizada: 32h registradas", time: "Hace 4h", user: "Ana García" },
  { icon: ArrowRight, iconClass: "text-status-review", text: "ALPHA-008 movida a revisión", time: "Hace 5h", user: "Ana García" },
  { icon: CheckCircle2, iconClass: "text-status-done", text: "BETA-001 wireframes aprobados", time: "Hace 6h", user: "María Torres" },
  { icon: AlertTriangle, iconClass: "text-cost-warning", text: "ALPHA-003 excede presupuesto estimado", time: "Hace 7h", user: "Sistema" },
];

export function ActivityFeed() {
  return (
    <div className="surface-card divide-y divide-border">
      {activities.map((activity, i) => (
        <div key={i} className="flex items-start gap-3 p-3">
          <activity.icon className={`w-4 h-4 mt-0.5 shrink-0 ${activity.iconClass}`} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-foreground leading-snug">{activity.text}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {activity.user} · {activity.time}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
