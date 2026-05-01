import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, CheckCircle2, AlertTriangle, Mail, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import type { TeamRole } from "@/hooks/useTeam";
import type { InviteResult } from "@/hooks/useTeam";
import { humanizeError } from "@/lib/humanize-error";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (
    email: string,
    role: TeamRole,
    options?: { scope?: "workspace" | "assigned"; projectIds?: string[] },
  ) => Promise<InviteResult>;
}

type Step = "form" | "result";
type Scope = "workspace" | "assigned" | "viewer";

export function InviteMemberDialog({ open, onOpenChange, onInvite }: Props) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [scope, setScope] = useState<Scope>("workspace");
  const [role, setRole] = useState<TeamRole>("collaborator");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Cargar proyectos del owner para el selector
  const { data: projects = [] } = useQuery({
    queryKey: ["invite-projects", user?.id],
    enabled: !!user && open && scope === "assigned",
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, clients(name)")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Sync rol implícito desde el alcance
  useEffect(() => {
    if (scope === "workspace") setRole("admin");
    else if (scope === "assigned") setRole("collaborator");
    else if (scope === "viewer") setRole("viewer");
  }, [scope]);

  const reset = () => {
    setEmail("");
    setScope("workspace");
    setRole("admin");
    setProjectIds([]);
    setStep("form");
    setResult(null);
    setCopied(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (scope === "assigned" && projectIds.length === 0) {
      toast.error("Selecciona al menos un proyecto para asignar.");
      return;
    }
    setSubmitting(true);
    const res = await onInvite(email, role, {
      scope: scope === "assigned" ? "assigned" : "workspace",
      projectIds: scope === "assigned" ? projectIds : [],
    });
    setSubmitting(false);

    if (res.error === "already_member") {
      toast.error("Este usuario ya forma parte de tu equipo.");
      return;
    }
    if (res.error === "already_invited") {
      toast.error("Ya enviaste una invitación a este email.");
      return;
    }
    if (res.error === "limit_reached") {
      toast.error("Has alcanzado el límite de tu plan.");
      return;
    }
    if (res.error) {
      toast.error(
        humanizeError(res.error, "No pudimos procesar la invitación. Intenta de nuevo en un momento."),
      );
      return;
    }

    setResult(res);
    setStep("result");
    if (res.emailSent) {
      toast.success("📨 Invitación enviada por correo");
    } else {
      toast.warning("No se pudo enviar el correo. Puedes compartir el enlace manualmente.");
    }
  };

  const handleCopy = async () => {
    if (!result?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(result.inviteUrl);
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const toggleProject = (id: string) => {
    setProjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle>Invitar a tu equipo</DialogTitle>
              <DialogDescription>
                La claridad no sirve si no es compartida. Define qué puede ver esta persona.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email del colaborador</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="persona@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>Alcance del acceso</Label>
                <div className="grid gap-2">
                  {[
                    {
                      key: "workspace" as const,
                      title: "Ver todo el workspace",
                      desc: "Acceso a todos los proyectos como admin.",
                    },
                    {
                      key: "assigned" as const,
                      title: "Solo proyectos asignados",
                      desc: "Colaborador con acceso únicamente a los proyectos que selecciones.",
                    },
                    {
                      key: "viewer" as const,
                      title: "Solo lectura",
                      desc: "Visualiza todo el workspace sin poder editar nada.",
                    },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setScope(opt.key)}
                      className={cn(
                        "text-left rounded-lg border p-3 transition-colors",
                        scope === opt.key
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <div className="text-sm font-semibold">{opt.title}</div>
                      <div className="text-[12px] text-muted-foreground">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {scope === "assigned" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FolderKanban className="w-3.5 h-3.5" /> Proyectos asignados
                  </Label>
                  {projects.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground border rounded-lg p-3">
                      Aún no tienes proyectos para asignar.
                    </p>
                  ) : (
                    <div className="max-h-44 overflow-auto border rounded-lg divide-y">
                      {projects.map((p: any) => (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/30"
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
                    {projectIds.length} proyecto{projectIds.length === 1 ? "" : "s"} seleccionado
                    {projectIds.length === 1 ? "" : "s"}.
                  </p>
                </div>
              )}

              {scope === "workspace" && (
                <div className="space-y-2">
                  <Label htmlFor="role">Rol dentro del workspace</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin · Control total</SelectItem>
                      <SelectItem value="collaborator">Colaborador · Acceso operativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="scorpion-gradient text-primary-foreground border-0"
                >
                  {submitting ? "Enviando..." : "Enviar invitación"}
                </Button>
              </div>
            </form>
          </>
        )}

        {step === "result" && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {result.emailSent ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    Invitación enviada
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Invitación creada
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {result.emailSent ? (
                  <>
                    Enviamos un correo a <strong>{result.invitation?.email}</strong> con el enlace
                    para unirse al equipo.
                  </>
                ) : (
                  <>
                    No pudimos enviar el correo, pero la invitación está activa. Comparte el enlace
                    manualmente con <strong>{result.invitation?.email}</strong>.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Enlace de invitación
                </Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={result.inviteUrl ?? ""}
                    className="font-mono text-xs"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button type="button" variant="outline" onClick={handleCopy} className="shrink-0">
                    {copied ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Este enlace es de un solo uso y expira en 14 días.
                </p>
              </div>

              {!result.emailSent && (
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-700 dark:text-orange-300 flex gap-2">
                  <Mail className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold mb-1">
                      No pudimos enviar el correo automáticamente
                    </div>
                    <div className="opacity-90">
                      Copia el enlace de arriba y compártelo manualmente con la persona invitada
                      (WhatsApp, Slack, correo personal, etc.). La invitación está activa y
                      funcional.
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => reset()}>
                  Invitar a otra persona
                </Button>
                <Button
                  type="button"
                  onClick={() => handleClose(false)}
                  className="scorpion-gradient text-primary-foreground border-0"
                >
                  Listo
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
