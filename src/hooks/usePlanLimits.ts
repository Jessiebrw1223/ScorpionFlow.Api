import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan, type PlanId } from "@/hooks/usePlan";

/**
 * Límites de cantidad por plan (lado de negocio).
 * Free: 5 clientes / 3 proyectos / 5 cotizaciones
 * Starter+: ilimitado
 */
export const QUANTITY_LIMITS: Record<PlanId, { clients: number; projects: number; quotations: number }> = {
  free:     { clients: 5,        projects: 3,        quotations: 5 },
  starter:  { clients: Infinity, projects: Infinity, quotations: Infinity },
  pro:      { clients: Infinity, projects: Infinity, quotations: Infinity },
  business: { clients: Infinity, projects: Infinity, quotations: Infinity },
};

export type LimitResource = "clients" | "projects" | "quotations";

export interface PlanLimitsInfo {
  loading: boolean;
  plan: PlanId;
  counts: Record<LimitResource, number>;
  limits: Record<LimitResource, number>;
  /** ¿Puede crear uno más de este recurso? */
  canCreate: (resource: LimitResource) => boolean;
  /** ¿Está al límite (igual o sobre)? */
  isAtLimit: (resource: LimitResource) => boolean;
  /** Cuántos slots restantes (Infinity si no hay límite) */
  remaining: (resource: LimitResource) => number;
  refresh: () => void;
}

export function usePlanLimits(): PlanLimitsInfo {
  const { user } = useAuth();
  const { plan, loading: planLoading } = usePlan();

  const { data: counts, isLoading, refetch } = useQuery({
    queryKey: ["plan-usage-counts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [clientsRes, projectsRes, quotationsRes] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("owner_id", user!.id),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", user!.id),
        supabase.from("quotations").select("id", { count: "exact", head: true }).eq("owner_id", user!.id),
      ]);
      return {
        clients: clientsRes.count ?? 0,
        projects: projectsRes.count ?? 0,
        quotations: quotationsRes.count ?? 0,
      };
    },
    staleTime: 30_000,
  });

  const safeCounts = counts ?? { clients: 0, projects: 0, quotations: 0 };
  const limits = QUANTITY_LIMITS[plan];

  return {
    loading: isLoading || planLoading,
    plan,
    counts: safeCounts,
    limits,
    canCreate: (r) => safeCounts[r] < limits[r],
    isAtLimit: (r) => safeCounts[r] >= limits[r],
    remaining: (r) => Math.max(0, limits[r] - safeCounts[r]),
    refresh: () => refetch(),
  };
}
