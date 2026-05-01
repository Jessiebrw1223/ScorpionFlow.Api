import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HandCoins, Plus, Trash2, AlertTriangle, Loader2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useMoney } from "@/lib/format-money";

interface Props {
  projectId: string;
  budget: number;
  actualCost: number;
}

export default function ProjectContributionsSection({ projectId, budget, actualCost }: Props) {
  const PEN = useMoney();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");

  const { data: contributions = [], isLoading } = useQuery({
    queryKey: ["project-contributions", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_contributions")
        .select("*")
        .eq("project_id", projectId)
        .order("contributed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalContributions = contributions.reduce((s, c: any) => s + Number(c.amount || 0), 0);
  const overBudget = actualCost > budget;
  const deficit = Math.max(0, actualCost - budget);
  const realProfit = budget - actualCost - totalContributions;

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("No autenticado");
      const { data: proj } = await supabase
        .from("projects").select("owner_id").eq("id", projectId).maybeSingle();
      const ownerId = proj?.owner_id ?? u.user.id;
      const { error } = await supabase.from("project_contributions").insert({
        project_id: projectId,
        owner_id: ownerId,
        amount,
        reason: reason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-contributions", projectId] });
      toast.success("Aporte registrado");
      setOpen(false);
      setAmount(0);
      setReason("");
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_contributions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-contributions", projectId] });
      toast.success("Aporte eliminado");
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  return (
    <div className="space-y-3">
      {/* Banner sugerencia inteligente */}
      {overBudget && totalContributions === 0 && (
        <div className="surface-card border border-cost-warning/40 bg-cost-warning/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-cost-warning shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-foreground text-sm">Este proyecto está excediendo el presupuesto</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Llevas {PEN.format(deficit)} de sobrecosto. Si pones dinero propio para continuar, regístralo como aporte adicional para que tu ganancia real refleje la verdad.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { setAmount(deficit); setOpen(true); }}>
            <Plus className="w-3.5 h-3.5" /> Agregar aporte
          </Button>
        </div>
      )}

      {/* Bloque principal de aportes */}
      <div className="surface-card p-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h3 className="section-header inline-flex items-center gap-1.5">
              <HandCoins className="w-3.5 h-3.5 text-primary" /> Aporte adicional propio
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Dinero que pusiste de tu bolsillo para sostener el proyecto. NO es ganancia, es inversión tuya.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Registrar aporte
            </Button>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar aporte adicional</DialogTitle>
                <p className="text-[12px] text-muted-foreground">
                  Este monto NO modifica el presupuesto cobrado al cliente. Se descuenta de tu ganancia real.
                </p>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Monto del aporte</Label>
                  <CurrencyInput value={amount} onValueChange={setAmount} />
                </div>
                <div className="space-y-1.5">
                  <Label>Motivo (opcional)</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ej. Cubrir hosting extra, pago a freelancer urgente…"
                  />
                </div>
                <div className="surface-card p-3 bg-muted/20">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Ganancia real tras este aporte</div>
                  <div className={cn(
                    "text-lg font-bold font-mono-data mt-0.5",
                    (realProfit - amount) < 0 ? "text-cost-negative" : "text-cost-positive"
                  )}>
                    {(realProfit - amount) >= 0 ? "+" : ""}{PEN.format(realProfit - amount)}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending || amount <= 0} className="fire-button">
                  {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Guardar aporte
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Total + lista */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div className="surface-card p-3 border-l-4 border-primary bg-primary/5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
              <Wallet className="w-3 h-3" /> Total aportado por ti
            </div>
            <div className="text-xl font-bold font-mono-data text-primary mt-1">
              {PEN.format(totalContributions)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {contributions.length} aporte{contributions.length !== 1 ? "s" : ""} registrado{contributions.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className={cn(
            "surface-card p-3 border-l-4",
            realProfit < 0 ? "border-cost-negative bg-cost-negative/5" : "border-cost-positive bg-cost-positive/5"
          )}>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Ganancia real (descontando aporte)</div>
            <div className={cn(
              "text-xl font-bold font-mono-data mt-1",
              realProfit < 0 ? "text-cost-negative" : "text-cost-positive"
            )}>
              {realProfit >= 0 ? "+" : ""}{PEN.format(realProfit)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 font-mono-data">
              {PEN.format(budget)} − {PEN.format(actualCost)} − {PEN.format(totalContributions)}
            </div>
          </div>
        </div>

        {/* Listado */}
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground text-[12px]">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" /> Cargando aportes…
          </div>
        ) : contributions.length === 0 ? (
          <div className="text-center py-6 text-[12px] text-muted-foreground border border-dashed border-border rounded-lg">
            Sin aportes registrados. {overBudget && "Considera registrar uno si has cubierto el sobrecosto con dinero propio."}
          </div>
        ) : (
          <div className="space-y-1">
            {contributions.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-2 px-2 border-b border-border last:border-0 text-[12px] hover:bg-muted/30 rounded">
                <div className="flex-1 min-w-0">
                  <div className="font-mono-data font-semibold text-foreground">{PEN.format(Number(c.amount))}</div>
                  {c.reason && <div className="text-muted-foreground text-[11px] truncate">{c.reason}</div>}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono-data">
                  {new Date(c.contributed_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-cost-negative"
                  onClick={() => {
                    if (confirm("¿Eliminar este aporte?")) remove.mutate(c.id);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Alerta diferencial: proyecto sostenido con inversión propia */}
        {totalContributions > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/30 flex items-start gap-2">
            <HandCoins className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[12px] text-foreground">
              <span className="font-semibold">Este proyecto se sostuvo con inversión propia.</span>{" "}
              <span className="text-muted-foreground">
                Aportaste {PEN.format(totalContributions)} para cubrir sobrecostos. No todo proyecto que se termina es rentable.
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
