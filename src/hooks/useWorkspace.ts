import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type WorkspaceRole = "owner" | "admin" | "collaborator" | "viewer";

/** Resumen de un workspace ajeno donde el usuario fue invitado. */
export interface GuestWorkspace {
  ownerId: string;
  role: WorkspaceRole;
  ownerName: string | null;
}

export interface WorkspaceContext {
  /**
   * ID del workspace personal del usuario actual.
   * SIEMPRE es `auth.uid()` mientras haya sesión.
   * No se sobrescribe por pertenecer a equipos ajenos.
   */
  ownerId: string | null;
  /**
   * Rol del usuario en su propio workspace personal.
   * Siempre `"owner"` cuando hay sesión (y `null` si no hay).
   * Las páginas comerciales personales (Clientes, Cotizaciones) deben usar este rol,
   * NO el rol que el usuario tenga dentro de un workspace invitado.
   */
  role: WorkspaceRole | null;
  /** Nombre legible del usuario (para banners de bienvenida personal). */
  ownerName: string | null;
  /** True: el usuario está en su propio workspace personal. Siempre true cuando hay sesión. */
  isOwner: boolean;
  /**
   * @deprecated El contexto global YA NO cambia automáticamente al workspace de un invitador.
   * Siempre `false`. Para detectar pertenencia a otros equipos usa `guestWorkspaces`
   * o `useActiveProjectWorkspace` dentro de la vista del proyecto.
   */
  isGuest: boolean;
  /** Lista de workspaces ajenos donde el usuario es miembro activo. Solo informativo. */
  guestWorkspaces: GuestWorkspace[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  collaborator: 2,
  viewer: 1,
};

/**
 * Resuelve el contexto de workspace PERSONAL del usuario.
 *
 * Regla del producto:
 *   - Cada usuario conserva siempre su workspace personal (clientes, cotizaciones,
 *     proyectos propios, plan, dashboard).
 *   - Pertenecer a un equipo invitado NO sobrescribe ese contexto global.
 *   - El acceso a proyectos de otros equipos se resuelve a nivel de página/proyecto
 *     vía RLS (`projects.owner_id` real) y la lista `guestWorkspaces`.
 */
export function useWorkspace(): WorkspaceContext {
  const { user, loading: authLoading } = useAuth();
  const [guestWorkspaces, setGuestWorkspaces] = useState<GuestWorkspace[]>([]);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setGuestWorkspaces([]);
      setOwnerName(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    // Nombre legible del propio usuario (para banners personales).
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    setOwnerName(
      (meta?.full_name as string) ||
        (meta?.name as string) ||
        user.email?.split("@")[0] ||
        "tu workspace",
    );

    // Cargar memberships en workspaces ajenos (solo informativo).
    const { data: memberships } = await supabase
      .from("team_members")
      .select("owner_id, role, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const others = (memberships ?? []).filter((m) => m.owner_id !== user.id);

    if (others.length === 0) {
      setGuestWorkspaces([]);
      setLoading(false);
      return;
    }

    // Resolver nombres de owners en una sola consulta.
    const ownerIds = Array.from(new Set(others.map((m) => m.owner_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", ownerIds);

    const nameByOwner = new Map<string, string>();
    (profiles ?? []).forEach((p) => {
      nameByOwner.set(
        p.user_id,
        p.full_name || p.email?.split("@")[0] || "su equipo",
      );
    });

    // Si el usuario aparece varias veces en el mismo workspace ajeno (edge case),
    // conservar el rol de mayor rango.
    const dedup = new Map<string, GuestWorkspace>();
    for (const m of others) {
      const role = (m.role as WorkspaceRole) ?? "collaborator";
      const existing = dedup.get(m.owner_id);
      if (!existing || ROLE_RANK[role] > ROLE_RANK[existing.role]) {
        dedup.set(m.owner_id, {
          ownerId: m.owner_id,
          role,
          ownerName: nameByOwner.get(m.owner_id) ?? null,
        });
      }
    }
    setGuestWorkspaces(Array.from(dedup.values()));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) refresh();
  }, [authLoading, refresh]);

  return {
    ownerId: user?.id ?? null,
    role: user ? "owner" : null,
    ownerName,
    isOwner: !!user,
    isGuest: false,
    guestWorkspaces,
    loading: loading || authLoading,
    refresh,
  };
}

export const WORKSPACE_ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "Propietario",
  admin: "Admin",
  collaborator: "Colaborador",
  viewer: "Visualizador",
};

export function canWriteWorkspace(role: WorkspaceRole | null): boolean {
  return role === "owner" || role === "admin" || role === "collaborator";
}

export function canAdminWorkspace(role: WorkspaceRole | null): boolean {
  return role === "owner" || role === "admin";
}
