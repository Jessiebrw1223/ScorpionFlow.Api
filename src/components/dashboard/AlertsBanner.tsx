import { useState } from "react";
import { AlertCircle, X, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

export function AlertsBanner() {
  const { notifications, markRead } = useNotifications();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const critical = notifications
    .filter((n) => !n.is_read && n.severity === "critical" && !dismissed.has(n.id))
    .slice(0, 1);

  if (critical.length === 0) return null;
  const n = critical[0];

  return (
    <div
      className={cn(
        "surface-card border-l-4 border-cost-negative p-3 flex items-center gap-3 relative overflow-hidden",
        "bg-gradient-to-r from-cost-negative/15 via-cost-negative/5 to-transparent"
      )}
    >
      <div className="w-9 h-9 rounded-lg bg-cost-negative/20 flex items-center justify-center shrink-0 fire-glow">
        <AlertCircle className="w-5 h-5 text-cost-negative fire-icon" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest font-bold text-cost-negative">Alerta crítica</p>
        <p className="text-sm font-bold text-foreground truncate">{n.title}</p>
        {n.message && <p className="text-[12px] text-muted-foreground truncate">{n.message}</p>}
      </div>
      {n.link && (
        <button
          onClick={() => {
            markRead.mutate(n.id);
            navigate(n.link!);
          }}
          className="fire-button px-3 py-1.5 rounded-md text-[12px] font-bold flex items-center gap-1 shrink-0"
        >
          Atender <ArrowRight className="w-3 h-3" />
        </button>
      )}
      <button
        onClick={() => setDismissed((s) => new Set([...s, n.id]))}
        className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground shrink-0"
        aria-label="Cerrar"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
