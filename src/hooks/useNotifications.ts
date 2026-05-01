import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { daysSince } from "@/lib/business-intelligence";
import { tasks, projects, personnelResources } from "@/lib/mock-data";
import { useUserSettings } from "@/hooks/useUserSettings";

export type AlertType =
  | "task_blocked"
  | "project_risk"
  | "client_no_followup"
  | "cost_overrun"
  | "resource_overload"
  | "quotation_stale"
  | "general";

export type AlertSeverity = "info" | "warning" | "critical";

export interface Notification {
  id: string;
  user_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string | null;
  link: string | null;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export function useNotifications() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["notifications"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Notification[];
    },
  });

  // Realtime subscription — unique channel name per instance to avoid
  // "cannot add postgres_changes callbacks after subscribe()" when the hook
  // mounts multiple times (StrictMode, multiple consumers).
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`notifications-rt-${user.id}-${Math.random().toString(36).slice(2)}`);
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
      () => qc.invalidateQueries({ queryKey: ["notifications"] })
    );
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = (query.data || []).filter((n) => !n.is_read).length;

  return { ...query, notifications: query.data || [], unreadCount, markRead, markAllRead };
}

/**
 * Auto-generates alerts based on operational state.
 * Uses a daily dedupe key to avoid spam.
 */
export function useAutoAlertEngine(opts: {
  clients: { id: string; name: string; last_contact_at: string | null; commercial_status: string }[];
  quotations: { id: string; title: string; status: string; status_changed_at: string }[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { settings } = useUserSettings();
  const alertsCfg = settings.alerts;

  useEffect(() => {
    if (!user) return;

    const run = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const dedupeKey = `alerts-run-${user.id}-${today}`;
      if (sessionStorage.getItem(dedupeKey)) return;
      sessionStorage.setItem(dedupeKey, "1");

      // Check existing today's notifications to avoid duplicates
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data: existing } = await supabase
        .from("notifications")
        .select("title")
        .gte("created_at", startOfDay.toISOString());

      const existingTitles = new Set((existing || []).map((n) => n.title));
      const toInsert: {
        user_id: string;
        alert_type: AlertType;
        severity: AlertSeverity;
        title: string;
        message: string;
        link: string;
      }[] = [];

      // Tareas bloqueadas — solo si el usuario tiene habilitado "blockingTask"
      if (alertsCfg.blockingTask) {
        tasks
          .filter((t) => t.status === "blocked")
          .forEach((t) => {
            const title = `Tarea bloqueada: ${t.title}`;
            if (!existingTitles.has(title)) {
              toInsert.push({
                user_id: user.id,
                alert_type: "task_blocked",
                severity: "warning",
                title,
                message: `${t.assignee} · ${t.id} requiere intervención.`,
                link: "/tasks",
              });
            }
          });
      }

      // Proyectos en riesgo / sobrecosto — respetan toggles del usuario
      projects
        .filter((p) => p.status !== "on_track")
        .forEach((p) => {
          const isOver = p.status === "over_budget";
          if (isOver && !alertsCfg.budgetExceeded) return;
          if (!isOver && !alertsCfg.criticalDelays && !alertsCfg.losingMoney) return;
          const title = isOver ? `Sobrecosto: ${p.name}` : `Proyecto en riesgo: ${p.name}`;
          if (!existingTitles.has(title)) {
            toInsert.push({
              user_id: user.id,
              alert_type: isOver ? "cost_overrun" : "project_risk",
              severity: isOver ? "critical" : "warning",
              title,
              message: isOver
                ? `Gastado $${p.spent.toLocaleString()} de $${p.budget.toLocaleString()}.`
                : `Progreso ${p.progress}% — revisa cronograma.`,
              link: "/projects",
            });
          }
        });

      // Resource overload
      personnelResources
        .filter((r) => r.utilization > 90)
        .forEach((r) => {
          const title = `Sobrecarga: ${r.firstName} ${r.lastName}`;
          if (!existingTitles.has(title)) {
            toInsert.push({
              user_id: user.id,
              alert_type: "resource_overload",
              severity: "warning",
              title,
              message: `Utilización ${r.utilization}%. Reasigna tareas para evitar burnout.`,
              link: "/resources",
            });
          }
        });

      // Clients without follow-up > 7 days
      opts.clients
        .filter((c) => {
          const d = daysSince(c.last_contact_at);
          return c.commercial_status === "no_followup" || d > 7;
        })
        .forEach((c) => {
          const d = daysSince(c.last_contact_at);
          const title = `Sin seguimiento: ${c.name}`;
          if (!existingTitles.has(title)) {
            toInsert.push({
              user_id: user.id,
              alert_type: "client_no_followup",
              severity: d > 14 ? "critical" : "warning",
              title,
              message: `${d > 100 ? "Sin contacto registrado" : `${d} días sin contacto`}. Retoma la conversación.`,
              link: "/clientes",
            });
          }
        });

      // Stale quotations > 7 days in same state
      opts.quotations
        .filter((q) => q.status !== "won" && q.status !== "lost")
        .forEach((q) => {
          const d = daysSince(q.status_changed_at);
          if (d > 7) {
            const title = `Cotización estancada: ${q.title}`;
            if (!existingTitles.has(title)) {
              toInsert.push({
                user_id: user.id,
                alert_type: "quotation_stale",
                severity: "info",
                title,
                message: `${d} días en el mismo estado. Empuja el cierre.`,
                link: "/cotizaciones",
              });
            }
          }
        });

      if (toInsert.length > 0) {
        await supabase.from("notifications").insert(toInsert);
        qc.invalidateQueries({ queryKey: ["notifications"] });
      }
    };

    run();
  }, [user, opts.clients, opts.quotations, qc, alertsCfg]);
}
