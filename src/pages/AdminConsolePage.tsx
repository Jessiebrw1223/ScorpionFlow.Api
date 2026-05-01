import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Shield, Users, CreditCard, TrendingUp, History, Loader2, Search, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { formatPEN } from "@/lib/fx";

type Plan = "free" | "starter" | "pro" | "business";

// Precios estimados PEN/mes para MRR
const PLAN_PRICE_PEN: Record<Plan, number> = {
  free: 0,
  starter: 45,
  pro: 101,
  business: 225,
};

const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

const PLAN_BADGE: Record<Plan, string> = {
  free: "bg-zinc-800 text-zinc-300 border-zinc-700",
  starter: "bg-blue-900/40 text-blue-300 border-blue-700/50",
  pro: "bg-orange-900/40 text-orange-300 border-orange-700/50",
  business: "bg-purple-900/40 text-purple-300 border-purple-700/50",
};

interface SubscriptionRow {
  id: string;
  owner_id: string;
  plan: Plan;
  status: string;
  billing_cycle: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  started_at: string | null;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

export default function AdminConsolePage() {
  const { user, loading: authLoading } = useAuth();
  const { isSuperadmin, loading } = useIsSuperadmin();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/login" replace />;
  if (!isSuperadmin) return <AccessDenied />;

  return <AdminConsoleContent adminId={user.id} />;
}

function AccessDenied() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full bg-zinc-900/60 border-zinc-800">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-red-900/30 border border-red-800 flex items-center justify-center mb-2">
            <Lock className="w-6 h-6 text-red-400" />
          </div>
          <CardTitle className="text-zinc-100">Acceso restringido</CardTitle>
          <CardDescription className="text-zinc-400">
            Esta sección es exclusiva para administradores de la plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <a href="/">Volver al dashboard</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminConsoleContent({ adminId }: { adminId: string }) {
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-900/40">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Admin Console</h1>
            <p className="text-xs text-zinc-500">Panel interno de control de plataforma</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-orange-950/40 border-orange-800 text-orange-300">
          Superadmin
        </Badge>
      </header>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="overview"><TrendingUp className="w-4 h-4 mr-1.5" />Resumen</TabsTrigger>
          <TabsTrigger value="users"><Users className="w-4 h-4 mr-1.5" />Usuarios</TabsTrigger>
          <TabsTrigger value="subs"><CreditCard className="w-4 h-4 mr-1.5" />Suscripciones</TabsTrigger>
          <TabsTrigger value="audit"><History className="w-4 h-4 mr-1.5" />Auditoría</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
        <TabsContent value="subs" className="mt-4"><SubsTab adminId={adminId} /></TabsContent>
        <TabsContent value="audit" className="mt-4"><AuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Hooks compartidos ---------------- */

function useAllSubs() {
  return useQuery({
    queryKey: ["admin-subs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_subscriptions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SubscriptionRow[];
    },
  });
}

function useAllProfiles() {
  return useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });
}

/* ---------------- Resumen general ---------------- */

function OverviewTab() {
  const subs = useAllSubs();
  const profiles = useAllProfiles();

  const stats = useMemo(() => {
    const list = subs.data ?? [];
    const byPlan: Record<Plan, number> = { free: 0, starter: 0, pro: 0, business: 0 };
    let active = 0;
    let canceled = 0;
    let mrr = 0;
    for (const s of list) {
      byPlan[s.plan] = (byPlan[s.plan] || 0) + 1;
      if (s.status === "active") active++;
      if (s.status === "canceled" || s.cancel_at_period_end) canceled++;
      // MRR: solo planes pagos activos
      if (s.plan !== "free" && s.status === "active") {
        const monthly = PLAN_PRICE_PEN[s.plan];
        mrr += s.billing_cycle === "annual" ? monthly * 0.9 : monthly;
      }
    }
    const totalUsers = profiles.data?.length ?? 0;
    const paid = (byPlan.starter + byPlan.pro + byPlan.business);
    const conversion = totalUsers > 0 ? (paid / totalUsers) * 100 : 0;
    const arpu = paid > 0 ? mrr / paid : 0;
    return { byPlan, active, canceled, mrr, totalUsers, paid, conversion, arpu };
  }, [subs.data, profiles.data]);

  if (subs.isLoading || profiles.isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-orange-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox label="Usuarios totales" value={stats.totalUsers} />
        <KpiBox label="Suscripciones activas" value={stats.active} accent="text-emerald-400" />
        <KpiBox label="Canceladas / programadas" value={stats.canceled} accent="text-amber-400" />
        <KpiBox label="MRR estimado" value={formatPEN(stats.mrr)} accent="text-orange-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-100">Distribución por plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(["free", "starter", "pro", "business"] as Plan[]).map((p) => {
              const count = stats.byPlan[p];
              const pct = stats.totalUsers > 0 ? (count / stats.totalUsers) * 100 : 0;
              return (
                <div key={p}>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-300">{PLAN_LABEL[p]}</span>
                    <span className="text-zinc-400">{count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-red-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-100">Métricas SaaS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="ARPU (ingreso medio por usuario pago)" value={formatPEN(stats.arpu)} />
            <Row label="Tasa de conversión a pago" value={`${stats.conversion.toFixed(1)}%`} />
            <Row label="Usuarios free activos" value={String(stats.byPlan.free)} />
            <Row label="Usuarios pagos" value={String(stats.paid)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiBox({ label, value, accent = "text-zinc-100" }: { label: string; value: string | number; accent?: string }) {
  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${accent}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-zinc-800 pb-2">
      <span className="text-zinc-400">{label}</span>
      <span className="text-zinc-100 font-medium">{value}</span>
    </div>
  );
}

/* ---------------- Usuarios ---------------- */

function UsersTab() {
  const profiles = useAllProfiles();
  const subs = useAllSubs();
  const [q, setQ] = useState("");

  const subByOwner = useMemo(() => {
    const map = new Map<string, SubscriptionRow>();
    for (const s of subs.data ?? []) map.set(s.owner_id, s);
    return map;
  }, [subs.data]);

  const filtered = useMemo(() => {
    const list = profiles.data ?? [];
    if (!q.trim()) return list;
    const ql = q.toLowerCase();
    return list.filter(p =>
      (p.email ?? "").toLowerCase().includes(ql) ||
      (p.full_name ?? "").toLowerCase().includes(ql)
    );
  }, [profiles.data, q]);

  if (profiles.isLoading) return <Loader2 className="w-5 h-5 animate-spin text-orange-500" />;

  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
        <div>
          <CardTitle className="text-zinc-100">Usuarios registrados</CardTitle>
          <CardDescription>{filtered.length} usuarios</CardDescription>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por email o nombre"
            className="pl-9 bg-zinc-950 border-zinc-800"
          />
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800">
              <TableHead className="text-zinc-400">Nombre</TableHead>
              <TableHead className="text-zinc-400">Email</TableHead>
              <TableHead className="text-zinc-400">Plan</TableHead>
              <TableHead className="text-zinc-400">Estado</TableHead>
              <TableHead className="text-zinc-400">Registro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => {
              const sub = subByOwner.get(p.user_id);
              return (
                <TableRow key={p.user_id} className="border-zinc-800">
                  <TableCell className="text-zinc-200">{p.full_name ?? "—"}</TableCell>
                  <TableCell className="text-zinc-300 text-sm">{p.email ?? "—"}</TableCell>
                  <TableCell>
                    {sub ? (
                      <Badge variant="outline" className={PLAN_BADGE[sub.plan]}>{PLAN_LABEL[sub.plan]}</Badge>
                    ) : <span className="text-zinc-600 text-xs">sin sub</span>}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-zinc-400">{sub?.status ?? "—"}</span>
                  </TableCell>
                  <TableCell className="text-zinc-500 text-xs">
                    {new Date(p.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-zinc-500 py-8">Sin resultados</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------------- Suscripciones + Control manual ---------------- */

function SubsTab({ adminId }: { adminId: string }) {
  const subs = useAllSubs();
  const profiles = useAllProfiles();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<SubscriptionRow | null>(null);
  const [newPlan, setNewPlan] = useState<Plan>("free");
  const [newStatus, setNewStatus] = useState<string>("active");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const profileByOwner = useMemo(() => {
    const map = new Map<string, ProfileRow>();
    for (const p of profiles.data ?? []) map.set(p.user_id, p);
    return map;
  }, [profiles.data]);

  const updateSub = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Sin selección");
      const updates = {
        plan: newPlan,
        status: newStatus,
        cancel_at_period_end: newStatus === "canceled" ? true : editing.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      };
      const { error: e1 } = await supabase
        .from("account_subscriptions")
        .update(updates)
        .eq("id", editing.id);
      if (e1) throw e1;

      // Auditoría
      const { error: e2 } = await supabase.from("admin_audit_logs").insert({
        admin_user_id: adminId,
        target_user_id: editing.owner_id,
        action: "manual_subscription_update",
        details: {
          from: { plan: editing.plan, status: editing.status },
          to: { plan: newPlan, status: newStatus },
        },
      });
      if (e2) console.warn("audit log:", e2.message);

      // Evento de suscripción
      await supabase.from("subscription_events").insert({
        owner_id: editing.owner_id,
        event_type: "admin_manual_change",
        from_plan: editing.plan,
        to_plan: newPlan,
        billing_cycle: editing.billing_cycle,
        metadata: { admin_id: adminId, new_status: newStatus },
      });
    },
    onSuccess: () => {
      toast.success("Suscripción actualizada");
      qc.invalidateQueries({ queryKey: ["admin-subs"] });
      qc.invalidateQueries({ queryKey: ["admin-audit"] });
      setEditing(null);
      setConfirmOpen(false);
    },
    onError: (err: Error) => toast.error(err.message ?? "No se pudo actualizar"),
  });

  if (subs.isLoading) return <Loader2 className="w-5 h-5 animate-spin text-orange-500" />;

  return (
    <>
      <Card className="bg-zinc-900/60 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Suscripciones</CardTitle>
          <CardDescription>{subs.data?.length ?? 0} registros</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800">
                <TableHead className="text-zinc-400">Usuario</TableHead>
                <TableHead className="text-zinc-400">Plan</TableHead>
                <TableHead className="text-zinc-400">Estado</TableHead>
                <TableHead className="text-zinc-400">Ciclo</TableHead>
                <TableHead className="text-zinc-400">Stripe Cust</TableHead>
                <TableHead className="text-zinc-400">Renueva</TableHead>
                <TableHead className="text-zinc-400">Cancela al fin</TableHead>
                <TableHead className="text-zinc-400 text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(subs.data ?? []).map((s) => {
                const prof = profileByOwner.get(s.owner_id);
                return (
                  <TableRow key={s.id} className="border-zinc-800">
                    <TableCell className="text-zinc-200 text-sm">
                      <div>{prof?.full_name ?? "—"}</div>
                      <div className="text-xs text-zinc-500">{prof?.email ?? s.owner_id.slice(0, 8)}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className={PLAN_BADGE[s.plan]}>{PLAN_LABEL[s.plan]}</Badge></TableCell>
                    <TableCell className="text-xs text-zinc-300">{s.status}</TableCell>
                    <TableCell className="text-xs text-zinc-400">{s.billing_cycle}</TableCell>
                    <TableCell className="text-[11px] text-zinc-500 font-mono">{s.stripe_customer_id?.slice(0, 14) ?? "—"}</TableCell>
                    <TableCell className="text-xs text-zinc-400">
                      {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      {s.cancel_at_period_end ? <Badge className="bg-amber-900/40 text-amber-300 border border-amber-700">Sí</Badge> : <span className="text-zinc-600 text-xs">No</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(s);
                          setNewPlan(s.plan);
                          setNewStatus(s.status);
                        }}
                      >
                        Cambiar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(subs.data?.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-zinc-500">Sin suscripciones</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Cambio manual de plan</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Esta acción modifica el plan local del usuario. <strong>No</strong> sincroniza con Stripe automáticamente.
              Quedará registrada en auditoría.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="text-zinc-500 text-xs">Usuario</div>
                <div className="text-zinc-200">{profileByOwner.get(editing.owner_id)?.email ?? editing.owner_id}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Plan</label>
                  <Select value={newPlan} onValueChange={(v: Plan) => setNewPlan(v)}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Estado</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="past_due">past_due</SelectItem>
                      <SelectItem value="canceled">canceled</SelectItem>
                      <SelectItem value="incomplete">incomplete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => setConfirmOpen(true)}
            >
              Aplicar cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cambio manual?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Cambiarás el plan a <strong className="text-zinc-200">{PLAN_LABEL[newPlan]}</strong> y estado a{" "}
              <strong className="text-zinc-200">{newStatus}</strong>. Quedará en el log de auditoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => updateSub.mutate()}
              disabled={updateSub.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {updateSub.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ---------------- Auditoría ---------------- */

function AuditTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin text-orange-500" />;

  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100">Historial de acciones</CardTitle>
        <CardDescription>Últimas 200 acciones manuales del admin</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800">
              <TableHead className="text-zinc-400">Fecha</TableHead>
              <TableHead className="text-zinc-400">Acción</TableHead>
              <TableHead className="text-zinc-400">Usuario afectado</TableHead>
              <TableHead className="text-zinc-400">Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((row: any) => (
              <TableRow key={row.id} className="border-zinc-800">
                <TableCell className="text-xs text-zinc-400">{new Date(row.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-zinc-200 text-sm">{row.action}</TableCell>
                <TableCell className="text-xs text-zinc-400 font-mono">{row.target_user_id?.slice(0, 12) ?? "—"}</TableCell>
                <TableCell className="text-xs text-zinc-400">
                  <pre className="whitespace-pre-wrap font-mono max-w-md">{JSON.stringify(row.details, null, 0)}</pre>
                </TableCell>
              </TableRow>
            ))}
            {(data?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-zinc-500">Sin acciones registradas</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
