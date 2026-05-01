import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Users, Eye, Trash2, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { TeamMember, TeamRole } from "@/hooks/useTeam";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  onUpdateRole: (id: string, role: TeamRole) => Promise<void>;
  onSetProjectAccess: (
    userId: string,
    projectIds: string[],
    role?: TeamRole,
  ) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

const ROLE_OPTIONS: {
  value: TeamRole;
  label: string;
  desc: string;
  icon: React.ElementType;
}[] = [
  {
    value: "viewer",
    label: "Visualizador",
    desc: "Solo lectura. Sin edición ni acceso comercial.",
    icon: Eye,
  },
  {
    value: "collaborator",
    label: "Colaborador",
    desc: "Trabaja únicamente en proyectos asignados.",
    icon: Users,
  },
  {
    value: "admin",
    label: "Admin",
    desc: "Acceso total al workspace. No requiere asignación.",
    icon: Shield,
  },
];

export function ManageAccessDialog({
  open,
  onOpenChange,
  member,
  onUpdateRole,
  onSetProjectAccess,
  onRemove,
}: Props) {
  const { user } = useAuth();
  const [role, setRole] = useState<TeamRole>("collaborator");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Proyectos del owner (workspace activo)
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["manage-access-projects", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, clients(name)")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Membresías actuales del miembro
  const { data: currentMemberships = [], isLoading: loadingMemberships } =
    useQuery({
      queryKey: ["manage-access-memberships", member?.user_id, user?.id],
      enabled: !!member && !!user && open,
      queryFn: async () => {
        const { data } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("user_id", member!.user_id);
        return (data ?? []).map((r) => r.project_id);
      },
    });

  // Sync local state cuando se abre / cambia miembro
  useEffect(() => {
    if (member) setRole(member.role);
    setConfirmRemove(false);
  }, [member, open]);

  useEffect(() => {
    setProjectIds(currentMemberships);
  }, [currentMemberships]);

  const ownedProjectIds = useMemo(
    () => new Set(projects.map((p: { id: string }) => p.id)),
    [projects],
  );
  // Solo los project_ids que pertenecen al owner actual son editables aquí
  const editableSelected = projectIds.filter((id) => ownedProjectIds.has(id));

  const toggleProject = (id: string) => {
    setProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    if (!member) return;
    setSaving(true);
    try {
      // 1) Cambiar rol si difiere
      if (role !== member.role) {
        await onUpdateRole(member.id, role);
      }
      // 2) Solo aplicar asignación de proyectos si el rol es colaborador
      //    (admin/viewer no necesitan project_members en el modelo aditivo).
      if (role === "collaborator") {
        await onSetProjectAccess(member.user_id, editableSelected, "collaborator");
      } else {
        // Si pasa a admin/viewer, limpiamos asignaciones que ya no aplican
        await onSetProjectAccess(member.user_id, [], role);
      }
      toast.success("Cambios guardados", {
        description: `Acceso actualizado para ${member.full_name || member.email}.`,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast.error("No se pudo guardar", { description: e?.message ?? String(e) });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!member) return;
    setSaving(true);
    try {
      await onRemove(member.id);
      toast.success("Miembro removido del equipo");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("No se pudo remover", { description: e?.message ?? String(e) });
    } finally {
      setSaving(false);
    }
  };

  if (!member) return null;

  const initial = (member.full_name || member.email || "?")
    .charAt(0)
    .toUpperCase();
  const showProjectsList = role === "collaborator";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestionar acceso</DialogTitle>
          <DialogDescription>
            Define el rol y los proyectos a los que tiene acceso esta persona.
          </DialogDescription>
        </DialogHeader>

        {/* Identidad */}
        <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full scorpion-gradient flex items-center justify-center text-primary-foreground font-bold">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">
              {member.full_name || member.email.split("@")[0]}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {member.email}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Miembro desde{" "}
              {new Date(member.joined_at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wider"
          >
            {member.is_active ? "Activo" : "Inactivo"}
          </Badge>
        </div>

        {/* Rol */}
        <div className="space-y-2">
          <Label>Rol en el workspace</Label>
          <div className="grid gap-2">
            {ROLE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = role === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={cn(
                    "text-left rounded-lg border p-3 transition-colors flex items-start gap-3",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 mt-0.5 shrink-0",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-[12px] text-muted-foreground">
                      {opt.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Proyectos asignados (solo colaborador) */}
        {showProjectsList && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FolderKanban className="w-3.5 h-3.5" /> Proyectos asignados
              <Badge variant="secondary" className="text-[10px] ml-1">
                {editableSelected.length}
              </Badge>
            </Label>
            {loadingProjects || loadingMemberships ? (
              <div className="text-xs text-muted-foreground flex items-center gap-2 border rounded-lg p-3">
                <Loader2 className="w-3 h-3 animate-spin" />
                Cargando proyectos…
              </div>
            ) : projects.length === 0 ? (
              <p className="text-[12px] text-muted-foreground border rounded-lg p-3">
                No tienes proyectos creados aún. Crea uno para poder asignarlo.
              </p>
            ) : (
              <div className="max-h-56 overflow-auto border rounded-lg divide-y">
                {projects.map((p: { id: string; name: string; clients?: { name?: string } | null }) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={projectIds.includes(p.id)}
                      onCheckedChange={() => toggleProject(p.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{p.name}</div>
                      {p.clients?.name && (
                        <div className="text-[11px] text-muted-foreground truncate">
                          {p.clients.name}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              El colaborador solo verá los clientes y cotizaciones vinculados a
              estos proyectos.
            </p>
          </div>
        )}

        {role === "admin" && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-[12px] text-muted-foreground">
            Los <strong>Admin</strong> tienen acceso total al workspace. No
            necesitan asignación por proyecto.
          </div>
        )}
        {role === "viewer" && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-[12px] text-muted-foreground">
            Los <strong>Visualizadores</strong> ven todo en modo solo lectura.
            No pueden crear ni editar.
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          {!confirmRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmRemove(true)}
              className="text-muted-foreground hover:text-destructive"
              disabled={saving}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Remover del workspace
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-destructive font-medium">¿Confirmar?</span>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleRemove}
                disabled={saving}
              >
                Sí, remover
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirmRemove(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="scorpion-gradient text-primary-foreground border-0"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Guardar cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
