import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Eye,
  Trash2,
  X,
  Crown,
  Sparkles,
  Lock,
  Copy,
  Send,
  CheckCircle2,
  Clock,
  CircleAlert,
  Sparkle,
  Settings2,
  FolderKanban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useTeam,
  type TeamRole,
  type TeamMember,
  type TeamInvitation,
  type InvitationStatus,
  buildInviteUrl,
  computeInvitationStatus,
} from "@/hooks/useTeam";
import { useAuth } from "@/contexts/AuthContext";
import { InviteMemberDialog } from "@/components/team/InviteMemberDialog";
import { UpgradePlanDialog } from "@/components/team/UpgradePlanDialog";
import { ManageAccessDialog } from "@/components/team/ManageAccessDialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageLoadingState, PageEmptyState } from "@/components/state/PageStates";
import { supabase } from "@/integrations/supabase/client";

const ROLE_LABEL: Record<TeamRole, string> = {
  admin: "Admin",
  collaborator: "Colaborador",
  viewer: "Visualizador",
};

const ROLE_ICON: Record<TeamRole, React.ElementType> = {
  admin: Shield,
  collaborator: Users,
  viewer: Eye,
};

const STATUS_META: Record<
  InvitationStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  pending: {
    label: "Pendiente",
    icon: Clock,
    className: "border-yellow-500/40 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10",
  },
  accepted: {
    label: "Aceptada",
    icon: CheckCircle2,
    className: "border-green-500/40 text-green-600 dark:text-green-400 bg-green-500/10",
  },
  expired: {
    label: "Expirada",
    icon: CircleAlert,
    className: "border-red-500/40 text-red-600 dark:text-red-400 bg-red-500/10",
  },
  cancelled: {
    label: "Cancelada",
    icon: X,
    className: "border-muted-foreground/30 text-muted-foreground bg-secondary",
  },
  rejected: {
    label: "Rechazada",
    icon: X,
    className: "border-muted-foreground/30 text-muted-foreground bg-secondary",
  },
};

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function formatExpiresIn(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return `Expiró hace ${Math.abs(d)}d`;
  if (d === 0) return "Expira hoy";
  if (d === 1) return "Expira mañana";
  return `Vence en ${d} días`;
}

export default function TeamPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    loading,
    plan,
    planLabel,
    members,
    allInvitations,
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
  } = useTeam();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [manageMember, setManageMember] = useState<TeamMember | null>(null);

  // Conteo de proyectos asignados por miembro (para badges en la lista)
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const userIds = members.map((m) => m.user_id).filter(Boolean);
      if (userIds.length === 0) {
        setProjectCounts({});
        return;
      }
      const { data } = await supabase
        .from("project_members")
        .select("user_id")
        .in("user_id", userIds);
      if (cancelled) return;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: { user_id: string }) => {
        counts[r.user_id] = (counts[r.user_id] ?? 0) + 1;
      });
      setProjectCounts(counts);
    })();
    return () => {
      cancelled = true;
    };
  }, [members, manageMember]);

  const handleInviteClick = () => {
    if (!canInvite) {
      setUpsellOpen(true);
      return;
    }
    setInviteOpen(true);
  };

  const handleCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(buildInviteUrl(token));
      toast.success("✅ Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  const handleResend = async (inv: TeamInvitation) => {
    const res = await resendInvitation(inv);
    if (res.emailSent) {
      toast.success("📨 Invitación reenviada");
    } else {
      toast.warning(
        "No pudimos reenviar el correo. Comparte el enlace manualmente.",
      );
    }
  };

  const usagePercent = isUnlimited ? 0 : Math.min(100, (used / limit) * 100);
  const progressColor =
    usagePercent >= 100
      ? "bg-destructive"
      : usagePercent >= 80
      ? "bg-orange-500"
      : "scorpion-gradient";

  // Visible: pending + recent history (accepted/expired/cancelled)
  const pendingInvs = allInvitations.filter(
    (i) => computeInvitationStatus(i) === "pending",
  );
  const historyInvs = allInvitations.filter(
    (i) => computeInvitationStatus(i) !== "pending",
  );

  const ownerName =
    (user?.user_metadata as any)?.full_name ||
    (user?.user_metadata as any)?.name ||
    user?.email?.split("@")[0] ||
    "Tú";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Equipo
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Invita personas y colabora en tiempo real. Comparte la misma
              información, toma decisiones alineadas.
            </p>
          </div>
          <Button
            onClick={handleInviteClick}
            className="scorpion-gradient text-primary-foreground border-0 fire-glow"
            size="lg"
          >
            {canInvite ? (
              <UserPlus className="w-4 h-4 mr-2" />
            ) : (
              <Lock className="w-4 h-4 mr-2" />
            )}
            Invitar usuario
          </Button>
        </div>

        {/* Plan usage card */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Plan {planLabel}</span>
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wider"
              >
                {isUnlimited ? "Ilimitado" : `${used} / ${limit} usuarios`}
              </Badge>
            </div>
            {!isUnlimited && (
              <button
                onClick={() => navigate("/settings?tab=subscription")}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Mejorar plan
              </button>
            )}
          </div>

          {!isUnlimited ? (
            <>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full ${progressColor} transition-all`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {remaining > 0
                  ? `Te quedan ${remaining} ${
                      remaining === 1 ? "cupo" : "cupos"
                    } por usar.`
                  : "Has alcanzado el límite de usuarios de tu plan."}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Tu plan permite usuarios ilimitados. Invita a todo tu equipo sin
              restricciones.
            </p>
          )}
        </div>

        {/* Members list */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">Miembros activos</h2>
            <span className="text-xs text-muted-foreground">
              {members.length + 1} {members.length + 1 === 1 ? "persona" : "personas"}
            </span>
          </div>

          {loading ? (
            <PageLoadingState title="Cargando equipo…" />
          ) : (
            <div className="divide-y divide-border">
              <MemberRow
                name={ownerName}
                email={user?.email ?? ""}
                role="admin"
                joinedAt={user?.created_at ?? null}
                isOwner
              />
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  name={m.full_name || m.email.split("@")[0]}
                  email={m.email}
                  role={m.role}
                  joinedAt={m.joined_at}
                  assignedProjectsCount={projectCounts[m.user_id] ?? 0}
                  onManage={() => setManageMember(m)}
                />
              ))}
              {members.length === 0 && (
                <PageEmptyState
                  icon={<Users className="w-6 h-6 text-muted-foreground" />}
                  title="Aún no hay otros miembros"
                  description="Invita a tu equipo para colaborar en proyectos, clientes y cotizaciones."
                  className="py-10"
                />
              )}
            </div>
          )}
        </div>

        {/* Pending invitations */}
        {pendingInvs.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Invitaciones pendientes
                <Badge variant="secondary" className="text-[10px]">
                  {pendingInvs.length}
                </Badge>
              </h2>
            </div>
            <div className="divide-y divide-border">
              {pendingInvs.map((inv) => (
                <InvitationRow
                  key={inv.id}
                  inv={inv}
                  onCopy={handleCopy}
                  onResend={handleResend}
                  onCancel={async () => {
                    await cancelInvitation(inv.id);
                    toast.success("❌ Invitación cancelada");
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {historyInvs.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Historial de invitaciones
                <Badge variant="secondary" className="text-[10px]">
                  {historyInvs.length}
                </Badge>
              </h2>
            </div>
            <div className="divide-y divide-border">
              {historyInvs.slice(0, 10).map((inv) => (
                <InvitationRow
                  key={inv.id}
                  inv={inv}
                  history
                  onCopy={handleCopy}
                  onResend={handleResend}
                  onCancel={async () => {
                    await cancelInvitation(inv.id);
                    toast.success("Invitación eliminada");
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Roles helper */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["admin", "collaborator", "viewer"] as TeamRole[]).map((r) => {
            const Icon = ROLE_ICON[r];
            const desc =
              r === "admin"
                ? "Control total: gestiona equipo, proyectos y datos."
                : r === "collaborator"
                ? "Acceso operativo: trabaja en proyectos y tareas."
                : "Solo lectura: consulta sin modificar.";
            return (
              <div
                key={r}
                className="rounded-lg border border-border bg-card p-4"
              >
                <Icon className="w-4 h-4 text-primary mb-2" />
                <div className="text-sm font-semibold mb-1">
                  {ROLE_LABEL[r]}
                </div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
            );
          })}
        </div>

        {/* Trust banner */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg scorpion-gradient flex items-center justify-center shrink-0">
            <Sparkle className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="text-sm">
            <div className="font-semibold mb-0.5">
              Invita personas y colabora en tiempo real
            </div>
            <p className="text-xs text-muted-foreground">
              Tus colaboradores verán los mismos proyectos, costos y alertas que tú,
              según el rol que les asignes. Sin reenvíos, sin duplicidad.
            </p>
          </div>
        </div>

        <InviteMemberDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          onInvite={inviteUser}
        />
        <UpgradePlanDialog
          open={upsellOpen}
          onOpenChange={setUpsellOpen}
          currentPlan={plan}
          used={used}
          limit={limit}
        />
        <ManageAccessDialog
          open={!!manageMember}
          onOpenChange={(o) => !o && setManageMember(null)}
          member={manageMember}
          onUpdateRole={updateMemberRole}
          onSetProjectAccess={setMemberProjectAccess}
          onRemove={removeMember}
        />
      </div>
    </TooltipProvider>
  );
}

function MemberRow({
  name,
  email,
  role,
  isOwner,
  joinedAt,
  assignedProjectsCount,
  onManage,
}: {
  name: string;
  email: string;
  role: TeamRole;
  isOwner?: boolean;
  joinedAt?: string | null;
  assignedProjectsCount?: number;
  onManage?: () => void;
}) {
  const initial = (name || email || "?").charAt(0).toUpperCase();
  const RoleIcon = ROLE_ICON[role];

  // Badge contextual por rol
  const roleBadge = isOwner
    ? null
    : role === "admin"
    ? { label: "Acceso total", className: "border-primary/40 text-primary bg-primary/10" }
    : role === "viewer"
    ? { label: "Solo lectura", className: "border-muted-foreground/30 text-muted-foreground bg-muted/30" }
    : (assignedProjectsCount ?? 0) === 0
    ? { label: "Sin proyectos", className: "border-destructive/40 text-destructive bg-destructive/10" }
    : { label: `${assignedProjectsCount} proyecto${assignedProjectsCount === 1 ? "" : "s"}`, className: "border-orange-500/40 text-orange-600 dark:text-orange-400 bg-orange-500/10" };

  return (
    <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-full scorpion-gradient flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate flex items-center gap-2 flex-wrap">
            <span className="truncate">{name}</span>
            {isOwner && (
              <Badge
                variant="outline"
                className="text-[9px] uppercase tracking-wider border-primary/40 text-primary"
              >
                <Crown className="w-2.5 h-2.5 mr-1" />
                Propietario
              </Badge>
            )}
            {roleBadge && (
              <Badge
                variant="outline"
                className={`text-[9px] uppercase tracking-wider ${roleBadge.className}`}
              >
                {role === "collaborator" && (assignedProjectsCount ?? 0) > 0 && (
                  <FolderKanban className="w-2.5 h-2.5 mr-1" />
                )}
                {roleBadge.label}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate flex flex-wrap gap-x-2">
            {email && <span>{email}</span>}
            {joinedAt && (
              <span className="opacity-70">
                · Desde{" "}
                {new Date(joinedAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <RoleIcon className="w-3.5 h-3.5" />
          {ROLE_LABEL[role]}
        </div>
        {!isOwner && onManage && (
          <Button
            variant="outline"
            size="sm"
            onClick={onManage}
            className="h-8"
          >
            <Settings2 className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline">Gestionar acceso</span>
            <span className="sm:hidden">Gestionar</span>
          </Button>
        )}
      </div>
    </div>
  );
}

function InvitationRow({
  inv,
  history,
  onCopy,
  onResend,
  onCancel,
}: {
  inv: TeamInvitation;
  history?: boolean;
  onCopy: (token: string) => void;
  onResend: (inv: TeamInvitation) => void;
  onCancel: () => void;
}) {
  const status = computeInvitationStatus(inv);
  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;
  const isPending = status === "pending";
  const canResend = isPending || status === "expired";

  return (
    <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
          <Mail className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{inv.email}</div>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 items-center">
            <span>{ROLE_LABEL[inv.role]}</span>
            <span>·</span>
            <span>
              Enviada{" "}
              {new Date(inv.created_at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
              })}
            </span>
            {isPending && (
              <>
                <span>·</span>
                <span>{formatExpiresIn(inv.expires_at)}</span>
              </>
            )}
            {isPending && inv.lastEmailStatus === "sent" && (
              <span className="text-green-600 dark:text-green-400 inline-flex items-center gap-1">
                · <CheckCircle2 className="w-3 h-3" /> Correo entregado
              </span>
            )}
            {isPending && inv.lastEmailStatus === "pending" && (
              <span className="text-yellow-600 dark:text-yellow-400 inline-flex items-center gap-1">
                · <Clock className="w-3 h-3" /> Enviando correo…
              </span>
            )}
            {isPending && inv.lastEmailStatus === "bounced" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-red-600 dark:text-red-400 inline-flex items-center gap-1 cursor-help">
                    · <CircleAlert className="w-3 h-3" /> Rebotado — comparte el enlace
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  El dominio receptor rechazó el mensaje (dirección inválida o
                  bloqueada). Copia el enlace y compártelo por otro medio.
                </TooltipContent>
              </Tooltip>
            )}
            {isPending && inv.lastEmailStatus === "complained" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-red-600 dark:text-red-400 inline-flex items-center gap-1 cursor-help">
                    · <CircleAlert className="w-3 h-3" /> Marcado como spam
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Este destinatario marcó tus correos como spam. Comparte el
                  enlace manualmente.
                </TooltipContent>
              </Tooltip>
            )}
            {isPending && inv.lastEmailStatus === "suppressed" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-orange-600 dark:text-orange-400 inline-flex items-center gap-1 cursor-help">
                    · <CircleAlert className="w-3 h-3" /> Correo bloqueado
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Esta dirección está en la lista de no entregables. Comparte
                  el enlace manualmente.
                </TooltipContent>
              </Tooltip>
            )}
            {isPending && inv.lastEmailStatus === "failed" && (
              <span className="text-orange-600 dark:text-orange-400 inline-flex items-center gap-1">
                · <CircleAlert className="w-3 h-3" /> No entregado — comparte el enlace
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge
          variant="outline"
          className={`text-[10px] gap-1 ${meta.className}`}
        >
          <StatusIcon className="w-3 h-3" />
          {meta.label}
        </Badge>

        {isPending && (
          <>
            {/* Desktop: text + icon */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopy(inv.token)}
              className="h-8 hidden sm:inline-flex"
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copiar enlace
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResend(inv)}
              className="h-8 hidden sm:inline-flex"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Reenviar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 text-muted-foreground hover:text-destructive hidden sm:inline-flex"
            >
              <X className="w-3.5 h-3.5 mr-1.5" />
              Cancelar
            </Button>

            {/* Mobile: only icons + tooltip */}
            <div className="sm:hidden flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => onCopy(inv.token)} className="h-8 w-8">
                    <Copy className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copiar enlace</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => onResend(inv)} className="h-8 w-8">
                    <Send className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reenviar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8 hover:text-destructive">
                    <X className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cancelar invitación</TooltipContent>
              </Tooltip>
            </div>
          </>
        )}

        {history && status === "expired" && canResend && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onResend(inv)}
            className="h-8"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Reenviar
          </Button>
        )}
      </div>
    </div>
  );
}
