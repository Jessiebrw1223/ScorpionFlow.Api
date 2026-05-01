import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { useMoney } from "@/lib/format-money";
import {
  DollarSign,
  Plus,
  Loader2,
  Trash2,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Send,
  PhoneCall,
  Clock,
  Sparkles,
  AlertTriangle,
  MessageCircle,
  Mail,
  Copy,
  UserPlus,
  Info,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpsellDialog } from "@/components/billing/UpsellDialog";

type QuoteStatus = "pending" | "in_contact" | "quoted" | "won" | "lost";

interface QuoteItem {
  description: string;
  quantity: number;
  unit_price: number;
}
interface Quotation {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: QuoteStatus;
  currency: string;
  subtotal: number;
  tax_rate: number;
  total: number;
  converted_to_project: boolean;
  created_at: string;
  status_changed_at: string;
  close_probability: number;
  client?: { id: string; name: string; company: string | null; phone?: string | null; email?: string | null };
}

const STATUS_META: Record<
  QuoteStatus,
  { label: string; icon: typeof Clock; color: string; bg: string; border: string }
> = {
  pending: {
    label: "Pendiente",
    icon: Clock,
    color: "text-status-todo",
    bg: "bg-status-todo/10",
    border: "border-status-todo/30",
  },
  in_contact: {
    label: "En contacto",
    icon: PhoneCall,
    color: "text-status-progress",
    bg: "bg-status-progress/10",
    border: "border-status-progress/30",
  },
  quoted: {
    label: "Cotizado",
    icon: Send,
    color: "text-status-review",
    bg: "bg-status-review/10",
    border: "border-status-review/30",
  },
  won: {
    label: "Ganado",
    icon: CheckCircle2,
    color: "text-cost-positive",
    bg: "bg-cost-positive/10",
    border: "border-cost-positive/40",
  },
  lost: {
    label: "Perdido",
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
  },
};

const STAGE_ORDER: QuoteStatus[] = ["pending", "in_contact", "quoted", "won", "lost"];

const itemSchema = z.object({
  description: z.string().trim().min(1, "Requerido").max(200),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
});
const formSchema = z.object({
  client_id: z.string().uuid("Selecciona un cliente"),
  title: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
  description: z.string().max(500).optional().or(z.literal("")),
  currency: z.string().min(3).max(3),
  tax_rate: z.number().min(0).max(100),
  items: z.array(itemSchema).min(1, "Agrega al menos un ítem"),
});

export default function CotizacionesPage() {
  const qc = useQueryClient();
  const PEN = useMoney();
  const navigate = useNavigate();
  const { ownerId, role } = useWorkspace();
  const canWrite = role === "owner" || role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedClientId = searchParams.get("clientId") || "";
  const [openForm, setOpenForm] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [deletingQuote, setDeletingQuote] = useState<Quotation | null>(null);
  const planLimits = usePlanLimits();

  const tryOpenForm = () => {
    if (planLimits.isAtLimit("quotations")) {
      setShowUpsell(true);
      return;
    }
    setOpenForm(true);
  };

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company, phone, email")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select("*, client:clients(id, name, company, phone, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Quotation[];
    },
  });

  const [form, setForm] = useState({
    client_id: preselectedClientId,
    title: "",
    description: "",
    currency: "PEN",
    tax_rate: 18,
    items: [{ description: "", quantity: 1, unit_price: 0 }] as QuoteItem[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Preseleccionar cliente y abrir form si viene desde Clientes (?clientId=...)
  useEffect(() => {
    if (preselectedClientId && clients.length > 0) {
      const exists = clients.find((c) => c.id === preselectedClientId);
      if (exists) {
        setForm((f) => ({ ...f, client_id: preselectedClientId }));
        setOpenForm(true);
      }
    }
  }, [preselectedClientId, clients]);

  const subtotal = useMemo(
    () => form.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0),
    [form.items]
  );
  const tax = subtotal * (form.tax_rate / 100);
  const total = subtotal + tax;

  const create = useMutation({
    mutationFn: async () => {
      const parsed = formSchema.safeParse({
        ...form,
        items: form.items.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
        })),
      });
      if (!parsed.success) {
        const fld = parsed.error.flatten().fieldErrors;
        const fe: Record<string, string> = {};
        Object.entries(fld).forEach(([k, v]) => {
          if (v && v[0]) fe[k] = v[0];
        });
        setErrors(fe);
        throw new Error("Datos inválidos");
      }
      setErrors({});

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No autenticado");
      if (!ownerId) throw new Error("Workspace no disponible");

      const { data: q, error } = await supabase
        .from("quotations")
        .insert({
          owner_id: ownerId,
          client_id: parsed.data.client_id,
          title: parsed.data.title,
          description: parsed.data.description || null,
          currency: parsed.data.currency,
          tax_rate: parsed.data.tax_rate,
          subtotal,
          total,
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;

      const items = parsed.data.items.map((i, idx) => ({
        quotation_id: q.id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        line_total: i.quantity * i.unit_price,
        position: idx,
      }));
      const { error: itemsErr } = await supabase.from("quotation_items").insert(items);
      if (itemsErr) throw itemsErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Cotización creada", { description: "Lista para gestionar en el pipeline." });
      setOpenForm(false);
      setForm({
        client_id: "",
        title: "",
        description: "",
        currency: "PEN",
        tax_rate: 18,
        items: [{ description: "", quantity: 1, unit_price: 0 }],
      });
      // Limpiar query param de cliente preseleccionado
      if (preselectedClientId) {
        searchParams.delete("clientId");
        setSearchParams(searchParams, { replace: true });
      }
    },
    onError: (e: Error) => {
      if (e.message !== "Datos inválidos") toast.error("Error", { description: e.message });
    },
  });

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: QuoteStatus }) => {
      const { error } = await supabase.from("quotations").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["quotations"] });
      toast.success(`Movido a "${STATUS_META[v.status].label}"`);
    },
  });

  const convertToProject = useMutation({
    mutationFn: async (q: Quotation) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No autenticado");
      if (!ownerId) throw new Error("Workspace no disponible");

      // 1. Crear proyecto real heredando datos de la cotización
      const { data: newProject, error: projErr } = await supabase
        .from("projects")
        .insert({
          owner_id: ownerId,
          client_id: q.client_id,
          quotation_id: q.id,
          name: q.title,
          description: q.description,
          budget: q.total,
          actual_cost: 0,
          progress: 0,
          status: "on_track",
          currency: q.currency,
        })
        .select("id")
        .single();
      if (projErr) throw projErr;

      // 2. Marcar la cotización como convertida + ganada
      const { error: updErr } = await supabase
        .from("quotations")
        .update({ converted_to_project: true, status: "won" })
        .eq("id", q.id);
      if (updErr) throw updErr;

      return newProject.id;
    },
    onSuccess: (projectId) => {
      qc.invalidateQueries({ queryKey: ["quotations"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects-dash"] });
      toast.success("Proyecto creado desde la cotización", {
        description: "Abriendo workspace del proyecto…",
        action: {
          label: "Abrir",
          onClick: () => navigate(`/projects/${projectId}`),
        },
      });
      // Auto-navegar al workspace recién creado
      setTimeout(() => navigate(`/projects/${projectId}`), 600);
    },
    onError: (e: Error) =>
      toast.error("No pudimos crear el proyecto", {
        description: `${e.message}. La cotización no fue marcada como ganada para evitar inconsistencias.`,
      }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Cotización eliminada");
    },
    onError: (e: Error) => toast.error("No se pudo eliminar", { description: e.message }),
  });

  const duplicate = useMutation({
    mutationFn: async (q: Quotation) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No autenticado");
      if (!ownerId) throw new Error("Workspace no disponible");

      // Traer items originales
      const { data: origItems, error: itemsErr } = await supabase
        .from("quotation_items")
        .select("description, quantity, unit_price, line_total, position")
        .eq("quotation_id", q.id);
      if (itemsErr) throw itemsErr;

      const { data: newQ, error } = await supabase
        .from("quotations")
        .insert({
          owner_id: ownerId,
          client_id: q.client_id,
          title: `${q.title} (copia)`,
          description: q.description,
          currency: q.currency,
          tax_rate: q.tax_rate,
          subtotal: q.subtotal,
          total: q.total,
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;

      if (origItems && origItems.length > 0) {
        const copyItems = origItems.map((it) => ({ ...it, quotation_id: newQ.id }));
        const { error: insErr } = await supabase.from("quotation_items").insert(copyItems);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Cotización duplicada");
    },
    onError: (e: Error) => toast.error("Error al duplicar", { description: e.message }),
  });

  const contactClient = (q: Quotation, channel: "whatsapp" | "email") => {
    if (channel === "whatsapp") {
      const phone = q.client?.phone?.replace(/\D/g, "");
      if (!phone) {
        toast.warning("Este cliente no tiene teléfono registrado");
        return;
      }
      const msg = encodeURIComponent(`Hola ${q.client?.name}, te escribo sobre la cotización "${q.title}".`);
      window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
    } else {
      const email = q.client?.email;
      if (!email) {
        toast.warning("Este cliente no tiene email registrado");
        return;
      }
      const subject = encodeURIComponent(`Cotización: ${q.title}`);
      window.open(`mailto:${email}?subject=${subject}`, "_blank");
    }
  };

  const grouped = useMemo(() => {
    const m: Record<QuoteStatus, Quotation[]> = {
      pending: [],
      in_contact: [],
      quoted: [],
      won: [],
      lost: [],
    };
    quotes.forEach((q) => m[q.status].push(q));
    return m;
  }, [quotes]);

  // Vendido este mes (won en el mes actual)
  const startOfMonth = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }, []);
  const soldThisMonth = quotes
    .filter((q) => q.status === "won" && new Date(q.status_changed_at).getTime() >= startOfMonth)
    .reduce((s, q) => s + Number(q.total), 0);
  const totalWon = quotes.filter((q) => q.status === "won").reduce((s, q) => s + Number(q.total), 0);
  const conversionRate =
    quotes.length > 0 ? (quotes.filter((q) => q.status === "won").length / quotes.length) * 100 : 0;
  const activeOpportunities = quotes.filter(
    (q) => q.status === "pending" || q.status === "in_contact" || q.status === "quoted"
  ).length;

  const updateItem = (idx: number, patch: Partial<QuoteItem>) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 fire-text">
            <DollarSign className="w-5 h-5 text-primary fire-icon" />
            Cotizaciones
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Gestiona tus oportunidades comerciales desde el primer contacto hasta el cierre.
          </p>
        </div>

        <Dialog open={openForm} onOpenChange={setOpenForm}>
          <Button
            className="fire-button font-semibold"
            disabled={clients.length === 0}
            title={clients.length === 0 ? "Crea un cliente primero" : ""}
            onClick={tryOpenForm}
          >
            <Plus className="w-4 h-4" />
            Nueva cotización
          </Button>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="fire-text">Nueva cotización</DialogTitle>
              <p className="text-[12px] text-muted-foreground mt-1">
                Define qué le vas a cobrar al cliente. El total se calcula automáticamente.
              </p>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Cliente *</Label>
                  <Select
                    value={form.client_id}
                    onValueChange={(v) => setForm({ ...form, client_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.company ? `· ${c.company}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.client_id && (
                    <p className="text-[12px] text-destructive">{errors.client_id}</p>
                  )}
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Título *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Ej: Implementación de sistema web"
                  />
                  {errors.title && <p className="text-[12px] text-destructive">{errors.title}</p>}
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Descripción</Label>
                  <Textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe el alcance del servicio o proyecto"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Moneda</Label>
                  <Select
                    value={form.currency}
                    onValueChange={(v) => setForm({ ...form, currency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PEN">PEN (Soles)</SelectItem>
                      <SelectItem value="USD">USD (Dólares)</SelectItem>
                      <SelectItem value="EUR">EUR (Euros)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>IGV / Impuesto (%)</Label>
                  <Input
                    type="number"
                    value={form.tax_rate}
                    onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>¿Qué le cobrarás al cliente? *</Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Agrega productos o servicios que el cliente recibirá.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        ...form,
                        items: [...form.items, { description: "", quantity: 1, unit_price: 0 }],
                      })
                    }
                  >
                    <Plus className="w-3 h-3" /> Agregar línea
                  </Button>
                </div>

                {/* Headers de columnas */}
                <div className="grid grid-cols-12 gap-2 px-2 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <div className="col-span-5">Servicio / Producto</div>
                  <div className="col-span-2">Cantidad</div>
                  <div className="col-span-2">Precio unitario</div>
                  <div className="col-span-2 text-right">Total</div>
                  <div className="col-span-1" />
                </div>

                <TooltipProvider delayDuration={200}>
                  <div className="space-y-2">
                    {form.items.map((it, idx) => {
                      const lineTotal = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
                      const placeholders = [
                        "Ej: Página web corporativa",
                        "Ej: Diseño logo premium",
                        "Ej: Soporte mensual",
                        "Ej: Capacitación al equipo",
                      ];
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-12 gap-2 items-start p-2 bg-secondary/30 rounded-md"
                        >
                          <div className="col-span-5">
                            <Input
                              placeholder={placeholders[idx % placeholders.length]}
                              value={it.description}
                              onChange={(e) => updateItem(idx, { description: e.target.value })}
                            />
                          </div>
                          <div className="col-span-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Input
                                  type="number"
                                  placeholder="1"
                                  value={it.quantity}
                                  onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Unidades simples. Ej: web=1, soporte 3 meses=3
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="col-span-2">
                            <CurrencyInput
                              value={Number(it.unit_price) || 0}
                              onValueChange={(v) => updateItem(idx, { unit_price: v })}
                              currency={form.currency}
                              showSymbol={false}
                            />
                          </div>
                          <div className="col-span-2 flex items-center justify-end h-9 px-2 text-[12px] font-mono-data text-foreground bg-background/40 rounded border border-border/50">
                            {PEN.format(lineTotal)}
                          </div>
                          <div className="col-span-1 flex justify-end">
                            {form.items.length > 1 && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })
                                }
                                className="h-9 w-9 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TooltipProvider>
                {errors.items && <p className="text-[12px] text-destructive">{errors.items}</p>}
              </div>

              <div className="surface-card p-4 space-y-2 fire-glow border-l-4 border-primary">
                <div className="flex justify-between text-[13px] text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono-data">{PEN.format(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[13px] text-muted-foreground">
                  <span>IGV ({form.tax_rate}%) <span className="text-[10px]">automático</span></span>
                  <span className="font-mono-data">{PEN.format(tax)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-border">
                  <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">Total a cobrar</span>
                  <span className="font-mono-data fire-text text-2xl font-bold">{PEN.format(total)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground text-right">
                  Esto es lo que el cliente paga. {form.items.length} concepto(s) incluidos.
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-[11px] text-muted-foreground sm:mr-auto">
                Podrás editarla luego.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setOpenForm(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => create.mutate()}
                  disabled={create.isPending}
                  className="fire-button"
                >
                  {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Crear cotización
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {quotes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="surface-card p-4 fire-glow">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Vendido este mes
            </div>
            <div className="font-mono-data fire-text text-2xl font-bold mt-1">
              {PEN.format(soldThisMonth)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Total ganado histórico: {PEN.format(totalWon)}
            </div>
          </div>
          <div className="surface-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Tasa de cierre
            </div>
            <div className="font-mono-data text-2xl font-bold text-foreground mt-1">
              {conversionRate.toFixed(0)}%
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {quotes.filter((q) => q.status === "won").length} de {quotes.length} cotizaciones
            </div>
          </div>
          <div className="surface-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Oportunidades activas
            </div>
            <div className="font-mono-data text-2xl font-bold text-foreground mt-1">
              {activeOpportunities}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              En pipeline (pendiente, en contacto, cotizado)
            </div>
          </div>
        </div>
      )}

      {clients.length === 0 && (
        <div className="surface-card border border-cost-warning/40 bg-cost-warning/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-cost-warning shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-foreground text-sm">
              ⚠️ Primero debes crear un cliente antes de cotizar
            </p>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              El flujo de ScorpionFlow es: <span className="text-primary font-medium">Cliente → Cotización → Proyecto → Tareas</span>.
            </p>
          </div>
          <Button asChild size="sm" className="fire-button shrink-0">
            <Link to="/clientes">
              <UserPlus className="w-4 h-4" /> Ir a Clientes
            </Link>
          </Button>
        </div>
      )}


      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
          Cargando pipeline…
        </div>
      ) : quotes.length === 0 ? (
        <div className="surface-card fire-border p-12 text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center fire-glow">
            <DollarSign className="w-7 h-7 text-primary fire-icon" />
          </div>
          <div className="text-base font-semibold text-foreground">
            {canWrite ? "Aún no tienes cotizaciones." : "No tienes cotizaciones disponibles"}
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {canWrite
              ? "Crea tu primera propuesta y empieza a vender hoy."
              : "Solo verás cotizaciones vinculadas a los proyectos que tienes asignados."}
          </p>
          {canWrite && clients.length > 0 && (
            <Button onClick={tryOpenForm} className="fire-button">
              <Plus className="w-4 h-4" />
              Nueva cotización
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {STAGE_ORDER.map((stage) => {
            const meta = STATUS_META[stage];
            const items = grouped[stage];
            const stageTotal = items.reduce((s, q) => s + Number(q.total), 0);
            const StageIcon = meta.icon;
            return (
              <div
                key={stage}
                className={cn(
                  "surface-card p-3 space-y-2 min-h-[300px] border-t-2",
                  meta.border
                )}
              >
                <div className="flex items-center justify-between">
                  <div className={cn("flex items-center gap-2 font-semibold text-[13px]", meta.color)}>
                    <StageIcon className="w-4 h-4" />
                    {meta.label}
                  </div>
                  <span className="text-[11px] font-mono-data text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    {items.length}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono-data uppercase tracking-wider">
                  {PEN.format(stageTotal)}
                </div>

                <div className="space-y-2 pt-1">
                  {items.length === 0 ? (
                    <div className="text-center text-[11px] text-muted-foreground py-6 border border-dashed border-border rounded-md">
                      Sin cotizaciones
                    </div>
                  ) : (
                    items.map((q) => {
                      const days = Math.floor((Date.now() - new Date(q.status_changed_at).getTime()) / 86400000);
                      const stale = days > 7 && stage !== "won" && stage !== "lost";
                      return (
                      <div
                        key={q.id}
                        className={cn(
                          "surface-card surface-card-hover fire-glow-hover p-2.5 space-y-2 cursor-pointer",
                          stale && "border-l-2 border-cost-warning"
                        )}
                      >
                        <div className="space-y-0.5">
                          <div className="font-medium text-[13px] text-foreground line-clamp-1">
                            {q.title}
                          </div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1">
                            {q.client?.name}
                            {q.client?.company ? ` · ${q.client.company}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-bold font-mono-data fire-text">
                            {PEN.format(Number(q.total))}
                          </span>
                          {q.converted_to_project && (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-cost-positive font-semibold bg-cost-positive/10 border border-cost-positive/30 rounded px-1.5 py-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              Proyecto creado
                            </span>
                          )}
                        </div>
                        {stage !== "won" && stage !== "lost" && (
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={cn("flex items-center gap-1 font-mono-data", stale ? "text-cost-warning font-semibold" : "text-muted-foreground")}>
                              <Clock className="w-3 h-3" />
                              {days === 0 ? "hoy" : `${days}d en estado`}
                              {stale && " · seguir"}
                            </span>
                            <span className="text-muted-foreground font-mono-data">
                              {q.close_probability ?? 50}% cierre
                            </span>
                          </div>
                        )}
                        <div className="space-y-1 pt-1 border-t border-border">
                          {/* Acciones rápidas: contactar / duplicar / eliminar */}
                          <TooltipProvider delayDuration={200}>
                            <div className="flex items-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => { e.stopPropagation(); contactClient(q, "whatsapp"); }}
                                    className="h-7 w-7 text-status-progress hover:bg-status-progress/10"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>WhatsApp · Contactar cliente</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => { e.stopPropagation(); contactClient(q, "email"); }}
                                    className="h-7 w-7 text-status-review hover:bg-status-review/10"
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Correo · Enviar propuesta</TooltipContent>
                              </Tooltip>
                              {canWrite && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={(e) => { e.stopPropagation(); duplicate.mutate(q); }}
                                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Duplicar · Reutilizar cotización</TooltipContent>
                                </Tooltip>
                              )}
                              <div className="flex-1" />
                              {canWrite && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={(e) => { e.stopPropagation(); setDeletingQuote(q); }}
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Eliminar · Borrar registro</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TooltipProvider>

                          {/* Cambio de estado + conversión a proyecto */}
                          {canWrite && (
                            <div className="flex items-center gap-1">
                              {stage !== "won" && stage !== "lost" && (
                                <Select
                                  value={q.status}
                                  onValueChange={(v: QuoteStatus) => {
                                    if (v === "won") {
                                      // Ganada implica crear proyecto: usar flujo transaccional
                                      convertToProject.mutate(q);
                                    } else {
                                      move.mutate({ id: q.id, status: v });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-[11px] flex-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STAGE_ORDER.map((s) => (
                                      <SelectItem key={s} value={s}>
                                        {STATUS_META[s].label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {stage === "won" && !q.converted_to_project && (
                                <Button
                                  size="sm"
                                  onClick={() => convertToProject.mutate(q)}
                                  disabled={convertToProject.isPending}
                                  className="h-7 fire-button text-[11px] flex-1"
                                >
                                  {convertToProject.isPending ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <ArrowRight className="w-3 h-3" />
                                  )}{" "}
                                  Convertir en Proyecto
                                </Button>
                              )}
                              {stage === "quoted" && !q.converted_to_project && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => convertToProject.mutate(q)}
                                  disabled={convertToProject.isPending}
                                  className="h-7 px-2 text-[11px]"
                                  title="Marcar como ganada y crear proyecto"
                                >
                                  {convertToProject.isPending ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <UpsellDialog
        open={showUpsell}
        onOpenChange={setShowUpsell}
        recommendedPlan="starter"
        reason={`Has alcanzado el límite de ${planLimits.limits.quotations} cotizaciones del plan ${planLimits.plan.toUpperCase()}`}
      />

      <AlertDialog open={!!deletingQuote} onOpenChange={(o) => !o && setDeletingQuote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cotización?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará "{deletingQuote?.title}" y sus líneas de detalle.
              {deletingQuote?.converted_to_project && " Esta cotización tiene un proyecto creado a partir de ella."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingQuote) {
                  remove.mutate(deletingQuote.id);
                  setDeletingQuote(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
