import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { humanizeFunctionError } from "@/lib/humanize-error";

export type TeamRole = "admin" | "collaborator" | "viewer";
export type SubscriptionPlan = "free" | "starter" | "pro" | "business";
export type InvitationStatus = "pending" | "accepted" | "rejected" | "cancelled" | "expired";

export interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: TeamRole;
  is_active: boolean;
  joined_at: string;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: TeamRole;
  status: InvitationStatus;
  token: string;
  expires_at: string;
  created_at: string;
  /** Estado del último intento de envío del correo (calculado desde email_send_log). */
  lastEmailStatus?:
    | "sent"
    | "pending"
    | "failed"
    | "suppressed"
    | "bounced"
    | "complained"
    | "unknown";
  /** Detalle del último error/rebote, si aplica. */
  lastEmailError?: string | null;
}

export interface AccountSubscription {
  id: string;
  plan: SubscriptionPlan;
  status: string;
  billing_cycle: string;
}

const PLAN_LIMITS: Record<SubscriptionPlan, number> = {
  free: 5,
  starter: 10,
  pro: Infinity,
  business: Infinity,
};

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

/** Construye la URL completa para que el invitado acepte la invitación. */
export function buildInviteUrl(token: string): string {
  if (typeof window === "undefined") return `/invite/${token}`;
  return `${window.location.origin}/invite/${token}`;
}

/** Estado real de una invitación, considerando expiración por fecha. */
export function computeInvitationStatus(inv: TeamInvitation): InvitationStatus {
  if (inv.status === "pending" && new Date(inv.expires_at).getTime() < Date.now()) {
    return "expired";
  }
  return inv.status;
}

export interface InviteResult {
  error: string | null;
  invitation?: TeamInvitation;
  inviteUrl?: string;
  emailSent?: boolean;
  emailError?: string;
}

/**
 * Resuelve el último estado de envío de email para una lista de invitaciones,
 * consultando email_send_log por message_id (idempotency_key) derivado del id
 * de la invitación. Si no hay log, queda como "unknown".
 */
async function enrichInvitationsWithEmailStatus(
  invs: TeamInvitation[],
): Promise<TeamInvitation[]> {
  if (invs.length === 0) return invs;
  // Filtramos por recipient_email para acotar la consulta y traemos los
  // últimos logs por email. Las invitaciones de team usan template_name
  // "team-invitation".
  const emails = Array.from(new Set(invs.map((i) => i.email.toLowerCase())));
  // Traemos también logs de "system" (suppression handler) para detectar bounces
  // y complaints reportados después del envío exitoso.
  const { data: logs } = await supabase
    .from("email_send_log")
    .select("recipient_email, status, error_message, created_at, template_name")
    .in("template_name", ["team-invitation", "system"])
    .in("recipient_email", emails)
    .order("created_at", { ascending: false });

  // Por email, capturamos el último log relevante. Los estados de suppression
  // (bounced/complained/suppressed) tienen prioridad sobre sent/pending.
  const latestByEmail = new Map<string, { status: string; error: string | null }>();
  for (const log of logs ?? []) {
    const key = (log.recipient_email ?? "").toLowerCase();
    if (!latestByEmail.has(key)) {
      latestByEmail.set(key, {
        status: log.status,
        error: log.error_message ?? null,
      });
    }
  }

  return invs.map((inv) => {
    const entry = latestByEmail.get(inv.email.toLowerCase());
    const status = entry?.status;
    let lastEmailStatus: TeamInvitation["lastEmailStatus"] = "unknown";
    if (status === "sent") lastEmailStatus = "sent";
    else if (status === "pending") lastEmailStatus = "pending";
    else if (status === "failed" || status === "dlq") lastEmailStatus = "failed";
    else if (status === "bounced") lastEmailStatus = "bounced";
    else if (status === "complained") lastEmailStatus = "complained";
    else if (status === "suppressed") lastEmailStatus = "suppressed";
    return { ...inv, lastEmailStatus, lastEmailError: entry?.error ?? null };
  });
}

export function useTeam() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<AccountSubscription | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [subRes, memRes, invRes] = await Promise.all([
      supabase.from("account_subscriptions").select("*").eq("owner_id", user.id).maybeSingle(),
      supabase.from("team_members").select("*").eq("owner_id", user.id).order("joined_at", { ascending: false }),
      supabase
        .from("team_invitations")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (subRes.data) {
      setSubscription(subRes.data as AccountSubscription);
    } else {
      const { data: created } = await supabase
        .from("account_subscriptions")
        .insert({ owner_id: user.id, plan: "free", status: "active" })
        .select()
        .single();
      if (created) setSubscription(created as AccountSubscription);
    }
    setMembers((memRes.data ?? []) as TeamMember[]);

    // Enriquecer invitaciones con el último estado de envío de email
    const rawInvitations = (invRes.data ?? []) as TeamInvitation[];
    const enriched = await enrichInvitationsWithEmailStatus(rawInvitations);
    setInvitations(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const plan: SubscriptionPlan = subscription?.plan ?? "free";
  const limit = PLAN_LIMITS[plan];
  const activeMembers = members.filter((m) => m.is_active).length;
  const pendingInvites = invitations.filter(
    (i) => i.status === "pending" && new Date(i.expires_at) > new Date()
  ).length;
  // Owner cuenta como 1
  const used = 1 + activeMembers + pendingInvites;
  const isUnlimited = limit === Infinity;
  const canInvite = isUnlimited || used < limit;
  const remaining = isUnlimited ? Infinity : Math.max(0, limit - used);

  const inviteUser = async (
    email: string,
    role: TeamRole,
    options?: { scope?: "workspace" | "assigned"; projectIds?: string[] },
  ): Promise<InviteResult> => {
    if (!user) return { error: "No user" };
    if (!canInvite) {
      return { error: "limit_reached" };
    }
    const normalized = email.trim().toLowerCase();
    const dupMember = members.find((m) => m.email.toLowerCase() === normalized);
    if (dupMember) return { error: "already_member" };
    const dupInv = invitations.find(
      (i) => i.email.toLowerCase() === normalized && i.status === "pending"
    );
    if (dupInv) return { error: "already_invited" };

    const scope = options?.scope ?? "workspace";
    const projectIds = options?.projectIds ?? [];

    const inviterName =
      (user.user_metadata as any)?.full_name ||
      (user.user_metadata as any)?.name ||
      user.email ||
      null;

    // 1. Crear invitación en DB (genera token único automáticamente)
    const { data: created, error } = await supabase
      .from("team_invitations")
      .insert({
        owner_id: user.id,
        email: normalized,
        role,
        invited_by_name: inviterName,
        scope,
        assigned_project_ids: scope === "assigned" ? projectIds : [],
      })
      .select()
      .single();

    if (error || !created) {
      return { error: error?.message ?? "No se pudo crear la invitación" };
    }

    // Si el invitado YA es miembro del workspace y se asignaron proyectos,
    // materializar de inmediato en project_members (idempotente).
    if (scope === "assigned" && projectIds.length > 0) {
      const existingMember = members.find(
        (m) => m.email.toLowerCase() === normalized && m.user_id,
      );
      if (existingMember) {
        await supabase.from("project_members").upsert(
          projectIds.map((pid) => ({
            project_id: pid,
            user_id: existingMember.user_id,
            role,
          })),
          { onConflict: "project_id,user_id" },
        );
      }
    }

    const invitation = created as TeamInvitation;
    const inviteUrl = buildInviteUrl(invitation.token);

    // 2. Intentar enviar correo (NO bloquea el flujo si falla)
    let emailSent = false;
    let emailError: string | undefined;
    try {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke(
        "send-transactional-email",
        {
          body: {
            templateName: "team-invitation",
            recipientEmail: normalized,
            idempotencyKey: `team-invite-${invitation.id}`,
            templateData: {
              inviterName,
              role,
              inviteUrl,
            },
          },
        }
      );
      if (fnErr) {
        // eslint-disable-next-line no-console
        console.error("[useTeam] send-transactional-email error", fnErr);
        emailError = humanizeFunctionError(
          fnErr,
          fnData,
          "No pudimos enviar el correo. Comparte el enlace manualmente.",
        );
      } else if (fnData && (fnData as any).success === false) {
        emailError = humanizeFunctionError(
          null,
          fnData,
          "El correo fue rechazado. Comparte el enlace manualmente.",
        );
      } else {
        emailSent = true;
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[useTeam] send-transactional-email exception", e);
      emailError = humanizeFunctionError(
        e,
        null,
        "No pudimos enviar el correo. Comparte el enlace manualmente.",
      );
    }

    await refresh();
    return { error: null, invitation, inviteUrl, emailSent, emailError };
  };

  const resendInvitation = async (invitation: TeamInvitation): Promise<InviteResult> => {
    if (!user) return { error: "No user" };
    const inviterName =
      (user.user_metadata as any)?.full_name ||
      (user.user_metadata as any)?.name ||
      user.email ||
      null;
    const inviteUrl = buildInviteUrl(invitation.token);
    let emailSent = false;
    let emailError: string | undefined;
    try {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke(
        "send-transactional-email",
        {
          body: {
            templateName: "team-invitation",
            recipientEmail: invitation.email,
            idempotencyKey: `team-invite-resend-${invitation.id}-${Date.now()}`,
            templateData: {
              inviterName,
              role: invitation.role,
              inviteUrl,
            },
          },
        }
      );
      if (fnErr) {
        // eslint-disable-next-line no-console
        console.error("[useTeam] resend send-transactional-email error", fnErr);
        emailError = humanizeFunctionError(
          fnErr,
          fnData,
          "No pudimos reenviar el correo. Comparte el enlace manualmente.",
        );
      } else if (fnData && (fnData as any).success === false) {
        emailError = humanizeFunctionError(
          null,
          fnData,
          "El correo fue rechazado. Comparte el enlace manualmente.",
        );
      } else {
        emailSent = true;
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[useTeam] resend send-transactional-email exception", e);
      emailError = humanizeFunctionError(
        e,
        null,
        "No pudimos reenviar el correo. Comparte el enlace manualmente.",
      );
    }
    return { error: null, invitation, inviteUrl, emailSent, emailError };
  };

  const cancelInvitation = async (id: string) => {
    await supabase.from("team_invitations").update({ status: "cancelled" }).eq("id", id);
    await refresh();
  };

  const removeMember = async (id: string) => {
    await supabase.from("team_members").delete().eq("id", id);
    await refresh();
  };

  const updateMemberRole = async (id: string, role: TeamRole) => {
    await supabase.from("team_members").update({ role }).eq("id", id);
    await refresh();
  };

  /**
   * Reemplaza la lista de proyectos asignados de un miembro (project_members).
   * - Inserta los nuevos proyectos.
   * - Elimina los que el usuario ya no debe tener.
   * Owner/Admin del workspace no necesitan project_members (aditivo); aún así
   * podemos asignarle proyectos sin efecto adverso para registro explícito.
   */
  const setMemberProjectAccess = async (
    userId: string,
    projectIds: string[],
    role: TeamRole = "collaborator",
  ) => {
    if (!user) return;
    // 1) Traer proyectos del owner (workspace activo del invitador) para acotar borrado
    const { data: ownedProjects } = await supabase
      .from("projects")
      .select("id")
      .eq("owner_id", user.id);
    const ownedIds = (ownedProjects ?? []).map((p) => p.id);

    // 2) Borrar membresías de este usuario que ya no estén en la nueva lista,
    //    limitadas a proyectos del owner actual (no tocar otros workspaces).
    if (ownedIds.length > 0) {
      const toKeep = projectIds.filter((id) => ownedIds.includes(id));
      const toDelete = ownedIds.filter((id) => !toKeep.includes(id));
      if (toDelete.length > 0) {
        await supabase
          .from("project_members")
          .delete()
          .eq("user_id", userId)
          .in("project_id", toDelete);
      }
      if (toKeep.length > 0) {
        await supabase.from("project_members").upsert(
          toKeep.map((pid) => ({ project_id: pid, user_id: userId, role })),
          { onConflict: "project_id,user_id" },
        );
      }
    }
    await refresh();
  };

  return {
    loading,
    plan,
    planLabel: PLAN_LABELS[plan],
    subscription,
    members,
    invitations: invitations.filter(
      (i) => computeInvitationStatus(i) === "pending"
    ),
    allInvitations: invitations,
    used,
    limit,
    isUnlimited,
    canInvite,
    remaining,
    inviteUser,
    resendInvitation,
    cancelInvitation,
    removeMember,
    updateMemberRole,
    setMemberProjectAccess,
    refresh,
  };
}
