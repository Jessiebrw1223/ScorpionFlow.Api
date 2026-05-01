import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, AlertTriangle, AlertCircle, Info, ArrowRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications, type AlertSeverity } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

const SEV_META: Record<AlertSeverity, { icon: typeof Info; color: string; bg: string }> = {
  info: { icon: Info, color: "text-status-progress", bg: "bg-status-progress/15" },
  warning: { icon: AlertTriangle, color: "text-cost-warning", bg: "bg-cost-warning/15" },
  critical: { icon: AlertCircle, color: "text-cost-negative", bg: "bg-cost-negative/15" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markRead, markAllRead, isLoading } = useNotifications();
  const navigate = useNavigate();

  const handleClick = (n: typeof notifications[number]) => {
    if (!n.is_read) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative w-9 h-9 rounded-lg bg-secondary/50 hover:bg-secondary transition-sf flex items-center justify-center group"
          aria-label="Notificaciones"
        >
          <Bell
            className={cn(
              "w-4 h-4 transition-sf",
              unreadCount > 0 ? "text-primary fire-icon" : "text-muted-foreground group-hover:text-foreground"
            )}
          />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center fire-glow border border-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm fire-text">Notificaciones</h3>
            <p className="text-[11px] text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} sin leer` : "Todo al día"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px]"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="w-3 h-3" /> Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-[12px] text-muted-foreground">Cargando…</div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <div className="text-3xl">🛡️</div>
              <p className="text-[12px] text-muted-foreground">No hay alertas. El sistema te avisa cuando algo cambie.</p>
            </div>
          ) : (
            notifications.map((n) => {
              const m = SEV_META[n.severity];
              const Icon = m.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 border-b border-border last:border-0 hover:bg-secondary/40 transition-sf flex gap-3 group",
                    !n.is_read && "bg-primary/5"
                  )}
                >
                  <div className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0", m.bg)}>
                    <Icon className={cn("w-4 h-4", m.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-[12px] leading-tight", !n.is_read ? "font-bold text-foreground" : "font-medium text-foreground/80")}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground font-mono-data shrink-0">{timeAgo(n.created_at)}</span>
                    </div>
                    {n.message && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                    )}
                    {n.link && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-primary mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Ir <ArrowRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0 fire-glow" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
