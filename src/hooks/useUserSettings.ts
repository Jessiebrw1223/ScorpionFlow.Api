import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Currency = "PEN" | "USD";
export type CostModel = "hourly" | "monthly" | "fixed" | "mixed";
export type Channel = "system" | "email";

export interface AutoAlerts {
  budgetOver80: boolean;
  marginBelow15: boolean;
  projectInLoss: boolean;
}
export interface AutoBehavior {
  autoCostFromResources: boolean;
  autoProgressFromTasks: boolean;
  inferSchedule: boolean;
}
export interface AlertsCfg {
  losingMoney: boolean;
  criticalDelays: boolean;
  budgetExceeded: boolean;
  blockingTask: boolean;
}

export interface UserSettings {
  id?: string;
  user_id?: string;
  currency: Currency;
  cost_model: CostModel;
  target_margin: number;
  auto_alerts: AutoAlerts;
  auto_behavior: AutoBehavior;
  alerts: AlertsCfg;
  channel: Channel;
}

export const DEFAULT_SETTINGS: UserSettings = {
  currency: "PEN",
  cost_model: "mixed",
  target_margin: 20,
  auto_alerts: { budgetOver80: true, marginBelow15: true, projectInLoss: true },
  auto_behavior: { autoCostFromResources: true, autoProgressFromTasks: true, inferSchedule: false },
  alerts: { losingMoney: true, criticalDelays: true, budgetExceeded: true, blockingTask: true },
  channel: "system",
};

const QK = ["user_settings"];

// Listener simple para que componentes no-react también se enteren (ej. helpers de formato)
let _cachedSettings: UserSettings = DEFAULT_SETTINGS;
const _listeners = new Set<(s: UserSettings) => void>();
export function getCachedSettings(): UserSettings {
  return _cachedSettings;
}
export function subscribeSettings(fn: (s: UserSettings) => void) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
function _publish(s: UserSettings) {
  _cachedSettings = s;
  _listeners.forEach((fn) => fn(s));
}

export function useUserSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QK,
    enabled: !!user,
    queryFn: async (): Promise<UserSettings> => {
      if (!user) return DEFAULT_SETTINGS;
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_SETTINGS;
      return {
        id: data.id,
        user_id: data.user_id,
        currency: (data.currency as Currency) ?? "PEN",
        cost_model: (data.cost_model as CostModel) ?? "mixed",
        target_margin: Number(data.target_margin ?? 20),
        auto_alerts: (data.auto_alerts as unknown as AutoAlerts) ?? DEFAULT_SETTINGS.auto_alerts,
        auto_behavior: (data.auto_behavior as unknown as AutoBehavior) ?? DEFAULT_SETTINGS.auto_behavior,
        alerts: (data.alerts as unknown as AlertsCfg) ?? DEFAULT_SETTINGS.alerts,
        channel: (data.channel as Channel) ?? "system",
      };
    },
  });

  useEffect(() => {
    if (query.data) _publish(query.data);
  }, [query.data]);

  const save = useMutation({
    mutationFn: async (patch: Partial<UserSettings>) => {
      if (!user) throw new Error("No user");
      const current = query.data ?? DEFAULT_SETTINGS;
      const next: UserSettings = { ...current, ...patch };
      const { error } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: user.id,
            currency: next.currency,
            cost_model: next.cost_model,
            target_margin: next.target_margin,
            auto_alerts: next.auto_alerts as unknown as Record<string, boolean>,
            auto_behavior: next.auto_behavior as unknown as Record<string, boolean>,
            alerts: next.alerts as unknown as Record<string, boolean>,
            channel: next.channel,
          },
          { onConflict: "user_id" }
        );
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(QK, next);
      _publish(next);
    },
  });

  return {
    settings: query.data ?? DEFAULT_SETTINGS,
    isLoading: query.isLoading,
    save: save.mutateAsync,
    saving: save.isPending,
  };
}
