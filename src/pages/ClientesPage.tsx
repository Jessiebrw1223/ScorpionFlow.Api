import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  Pencil,
  Trash2,
  Loader2,
  PhoneCall,
  Globe,
  CalendarClock,
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CLIENT_TYPE_META, CLIENT_TYPES, daysSince, inferCommercialBadge } from "@/lib/business-intelligence";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpsellDialog } from "@/components/billing/UpsellDialog";
import { humanizeError } from "@/lib/humanize-error";
import { PageLoadingState, PageEmptyState, PageErrorState } from "@/components/state/PageStates";
import { Sparkles } from "lucide-react";

type ClientType = string;
type CommercialStatus = "active" | "pending" | "no_followup";

interface Client {
  id: string;
  name: string;
  company: string | null;
  client_type: ClientType;
  email: string | null;
  phone: string | null;
  ruc: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  country: string | null;
  industry: string | null;
  last_contact_at: string | null;
  next_action: string | null;
  commercial_status: CommercialStatus;
}

const schema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  client_type: z.string(),
  email: z.string().trim().email("Correo inválido").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  ruc: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
  country: z.string().trim().max(60).optional().or(z.literal("")),
  industry: z.string().trim().max(80).optional().or(z.literal("")),
  next_action: z.string().trim().max(200).optional().or(z.literal("")),
  commercial_status: z.enum(["active", "pending", "no_followup"]),
});

type FormValues = z.infer<typeof schema>;

const emptyForm: FormValues = {
  name: "",
  company: "",
  client_type: "business",
  email: "",
  phone: "",
  ruc: "",
  notes: "",
  country: "",
  industry: "",
  next_action: "",
  commercial_status: "pending",
};

export default function ClientesPage() {
  const qc = useQueryClient();
  const { ownerId, role } = useWorkspace();
  const canWrite = role === "owner" || role === "admin";
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | CommercialStatus>("all");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const planLimits = usePlanLimits();
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});

  const { data: clients = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (typeFilter !== "all" && c.client_type !== typeFilter) return false;
      if (statusFilter !== "all" && c.commercial_status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.company || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.country || "").toLowerCase().includes(q) ||
        (c.industry || "").toLowerCase().includes(q) ||
        (c.ruc || "").toLowerCase().includes(q)
      );
    });
  }, [clients, search, typeFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const active = clients.filter((c) => c.commercial_status === "active").length;
    const pending = clients.filter((c) => c.commercial_status === "pending").length;
    const noFw = clients.filter(
      (c) => c.commercial_status === "no_followup" || daysSince(c.last_contact_at) > 14
    ).length;
    return { active, pending, noFw };
  }, [clients]);

  const upsert = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No autenticado");
      if (!ownerId) throw new Error("Workspace no disponible");

      const payload = {
        owner_id: ownerId,
        name: values.name,
        company: values.company || null,
        client_type: values.client_type as any,
        email: values.email || null,
        phone: values.phone || null,
        ruc: values.ruc || null,
        notes: values.notes || null,
        country: values.country || null,
        industry: values.industry || null,
        next_action: values.next_action || null,
        commercial_status: values.commercial_status,
      };

      if (editing) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(editing ? "Cliente actualizado" : "Cliente creado", { description: form.name });
      setOpenForm(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente eliminado");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error("No se pudo eliminar", { description: e.message }),
  });

  const contactNow = useMutation({
    mutationFn: async (c: Client) => {
      const { error } = await supabase
        .from("clients")
        .update({
          last_contact_at: new Date().toISOString(),
          commercial_status: "active",
        })
        .eq("id", c.id);
      if (error) throw error;
      return c;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(`Contacto registrado con ${c.name}`, {
        description: "Estado actualizado a 'Activo'.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fld = parsed.error.flatten().fieldErrors;
      setErrors({
        name: fld.name?.[0],
        company: fld.company?.[0],
        email: fld.email?.[0],
        phone: fld.phone?.[0],
        ruc: fld.ruc?.[0],
        notes: fld.notes?.[0],
        country: fld.country?.[0],
        industry: fld.industry?.[0],
        next_action: fld.next_action?.[0],
      });
      return;
    }
    setErrors({});
    upsert.mutate(parsed.data);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({
      name: c.name,
      company: c.company || "",
      client_type: c.client_type,
      email: c.email || "",
      phone: c.phone || "",
      ruc: c.ruc || "",
      notes: c.notes || "",
      country: c.country || "",
      industry: c.industry || "",
      next_action: c.next_action || "",
      commercial_status: c.commercial_status,
    });
    setOpenForm(true);
  };

  const openCreate = () => {
    // Gating por plan: si está al límite, mostrar upsell en vez de abrir el form
    if (planLimits.isAtLimit("clients")) {
      setShowUpsell(true);
      return;
    }
    setEditing(null);
    setForm(emptyForm);
    setOpenForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 fire-text">
            <Users className="w-5 h-5 text-primary fire-icon" />
            Clientes
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            CRM internacional · industrial · tecnológico · comercial
          </p>
          {planLimits.plan === "free" && !planLimits.loading && (
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" />
              {planLimits.counts.clients} de {planLimits.limits.clients} clientes en plan Free
            </p>
          )}
        </div>

        {canWrite && (
          <Dialog open={openForm} onOpenChange={setOpenForm}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="fire-button font-semibold">
                <Plus className="w-4 h-4" />
                Nuevo cliente
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="fire-text">
                {editing ? "Editar cliente" : "Nuevo cliente"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ana García"
                  />
                  {errors.name && <p className="text-[12px] text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Empresa</Label>
                  <Input
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="Acme S.A.C."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo / Sector *</Label>
                  <Select
                    value={form.client_type}
                    onValueChange={(v: string) => setForm({ ...form, client_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                      {CLIENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          <span className="inline-flex items-center gap-2">
                            <span>{CLIENT_TYPE_META[t].emoji}</span>
                            {CLIENT_TYPE_META[t].label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>País</Label>
                  <Input
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    placeholder="Perú, México, USA…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Industria específica</Label>
                  <Input
                    value={form.industry}
                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                    placeholder="Minería, Fintech, Logística…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Correo</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                  {errors.email && <p className="text-[12px] text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Teléfono</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>RUC / Tax ID</Label>
                  <Input value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado comercial</Label>
                  <Select
                    value={form.commercial_status}
                    onValueChange={(v: CommercialStatus) =>
                      setForm({ ...form, commercial_status: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">🟢 Activo</SelectItem>
                      <SelectItem value="pending">🟡 Pendiente</SelectItem>
                      <SelectItem value="no_followup">🔴 Sin seguimiento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Próxima acción</Label>
                  <Input
                    value={form.next_action}
                    onChange={(e) => setForm({ ...form, next_action: e.target.value })}
                    placeholder="Enviar propuesta · Llamar el viernes…"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Notas</Label>
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={upsert.isPending} className="fire-button">
                  {upsert.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? "Guardar cambios" : "Crear cliente"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="surface-card p-3 border-l-4 border-cost-positive">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">🟢 Activos</div>
          <div className="text-xl font-bold font-mono-data text-cost-positive">{stats.active}</div>
        </div>
        <div className="surface-card p-3 border-l-4 border-cost-warning">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">🟡 Pendientes</div>
          <div className="text-xl font-bold font-mono-data text-cost-warning">{stats.pending}</div>
        </div>
        <div className="surface-card p-3 border-l-4 border-cost-negative">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">🔴 Sin seguimiento</div>
          <div className="text-xl font-bold font-mono-data text-cost-negative">{stats.noFw}</div>
        </div>
        <div className="surface-card p-3 border-l-4 border-primary">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</div>
          <div className="text-xl font-bold font-mono-data fire-text">{clients.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nombre, empresa, país, industria…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] bg-secondary/50">
            <SelectValue placeholder="Sector" />
          </SelectTrigger>
          <SelectContent className="max-h-[280px]">
            <SelectItem value="all">Todos los sectores</SelectItem>
            {CLIENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {CLIENT_TYPE_META[t].emoji} {CLIENT_TYPE_META[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
          {(["all", "active", "pending", "no_followup"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setStatusFilter(t)}
              className={cn(
                "px-3 py-1.5 text-[12px] rounded-md transition-sf font-medium",
                statusFilter === t
                  ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(15_90%_55%/0.5)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "all" ? "Todos" : t === "active" ? "🟢 Activos" : t === "pending" ? "🟡 Pendientes" : "🔴 Sin seg."}
            </button>
          ))}
        </div>
        <Badge variant="outline" className="ml-auto font-mono-data">
          {filtered.length} de {clients.length}
        </Badge>
      </div>

      {/* Table */}
      <div className="surface-card overflow-hidden">
        {isLoading ? (
          <PageLoadingState title="Cargando clientes…" />
        ) : isError ? (
          <PageErrorState error={error} onRetry={() => refetch()} />
        ) : filtered.length === 0 ? (
          <PageEmptyState
            icon={<Users className="w-6 h-6 text-primary fire-icon" />}
            title={clients.length === 0 ? "Aún no tienes clientes" : "Sin resultados"}
            description={
              clients.length === 0
                ? "Empieza agregando tu primer cliente al sistema."
                : "Prueba con otros filtros o términos de búsqueda."
            }
            action={
              clients.length === 0 && canWrite ? (
                <Button onClick={openCreate} className="fire-button">
                  <Plus className="w-4 h-4" />
                  Agregar primer cliente
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-4 py-3">Cliente</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-4 py-3">Sector</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-4 py-3">Estado</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-4 py-3">Último contacto</th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-4 py-3">Próxima acción</th>
                  <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const meta = CLIENT_TYPE_META[c.client_type] || CLIENT_TYPE_META.other;
                  const badge = inferCommercialBadge(c);
                  const days = daysSince(c.last_contact_at);
                  const lastContactLabel = c.last_contact_at
                    ? days === 0
                      ? "Hoy"
                      : days === 1
                      ? "Ayer"
                      : `Hace ${days}d`
                    : "Nunca";
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-0 hover:bg-secondary/30 transition-sf group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg scorpion-gradient flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0 group-hover:fire-glow transition-all">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">{c.name}</div>
                            <div className="text-[12px] text-muted-foreground flex items-center gap-2 truncate">
                              {c.company && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="w-3 h-3 shrink-0" />
                                  {c.company}
                                </span>
                              )}
                              {c.country && (
                                <span className="flex items-center gap-1">
                                  <Globe className="w-3 h-3" />
                                  {c.country}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary text-[12px] font-medium",
                            meta.color
                          )}
                        >
                          <span>{meta.emoji}</span>
                          {meta.label}
                        </span>
                        {c.industry && (
                          <div className="text-[10px] text-muted-foreground mt-1">{c.industry}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold",
                            badge.color
                          )}
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", badge.dot)} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px]">
                        <div className={cn("flex items-center gap-1.5 font-mono-data", days > 14 ? "text-cost-negative" : days > 7 ? "text-cost-warning" : "text-foreground")}>
                          <CalendarClock className="w-3 h-3" />
                          {lastContactLabel}
                        </div>
                        {(c.email || c.phone) && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {c.email || c.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] max-w-[200px]">
                        {c.next_action ? (
                          <div className="flex items-start gap-1.5">
                            <Target className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                            <span className="text-foreground line-clamp-2">{c.next_action}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            onClick={() => contactNow.mutate(c)}
                            disabled={contactNow.isPending}
                            className="fire-button h-8 text-[11px] px-2"
                            title="Registrar contacto ahora"
                          >
                            <PhoneCall className="w-3 h-3" />
                            Contactar
                          </Button>
                          {canWrite && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEdit(c)}
                                className="h-8 w-8 hover:text-primary"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeleting(c)}
                                className="h-8 w-8 hover:text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará "{deleting?.name}" del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && remove.mutate(deleting.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpsellDialog
        open={showUpsell}
        onOpenChange={setShowUpsell}
        recommendedPlan="starter"
        reason={`Has alcanzado el límite de ${planLimits.limits.clients} clientes del plan ${planLimits.plan.toUpperCase()}`}
      />
    </div>
  );
}
