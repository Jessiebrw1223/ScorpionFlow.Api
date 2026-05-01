import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Verifica si el usuario actual tiene rol global "superadmin".
 * Validado contra la tabla user_roles (RLS protegida).
 */
export function useIsSuperadmin() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["is-superadmin", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "superadmin")
        .maybeSingle();
      if (error) {
        console.warn("[useIsSuperadmin]", error.message);
        return false;
      }
      return !!data;
    },
  });

  return {
    isSuperadmin: !!query.data,
    loading: query.isLoading,
  };
}
