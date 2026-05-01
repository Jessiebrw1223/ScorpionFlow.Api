import { useState } from "react";
import { machineryResources, machineryCategories, projects, type MachineryResource } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Plus, Cog, Factory, Truck, ScanLine, Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

const categoryIcons: Record<string, React.ElementType> = {
  "Maquinaria de producción": Factory,
  "Robot industrial": Cog,
  "Sistema de transporte logístico": Truck,
  "Maquinaria de control de calidad": ScanLine,
  "Maquinaria de corte industrial": Hammer,
  "Maquinaria pesada": Factory,
};

export default function MachineryTab() {
  const [machinery, setMachinery] = useState<MachineryResource[]>(machineryResources);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", area: "", location: "", responsible: "", capacity: "", projectId: "" });

  const handleAdd = () => {
    if (!form.name || !form.category || !form.area || !form.location || !form.responsible) {
      toast({ title: "Campos requeridos", description: "Complete todos los campos obligatorios", variant: "destructive" });
      return;
    }
    const cap = parseInt(form.capacity) || 100;
    const newMachine: MachineryResource = {
      id: `maq-${Date.now()}`,
      name: form.name.trim(),
      category: form.category,
      area: form.area.trim(),
      operationalStatus: "available",
      location: form.location.trim(),
      responsible: form.responsible.trim(),
      capacity: Math.min(Math.max(cap, 0), 100),
      projectId: form.projectId || "",
      utilization: 0,
    };
    setMachinery(prev => [...prev, newMachine]);
    setForm({ name: "", category: "", area: "", location: "", responsible: "", capacity: "", projectId: "" });
    setDialogOpen(false);
    toast({ title: "Maquinaria registrada", description: `${newMachine.name} agregada exitosamente` });
  };

  const statusLabel = (s: string) => s === "active" ? "Activo" : s === "maintenance" ? "Mantenimiento" : s === "available" ? "Disponible" : "Inactivo";
  const statusColor = (s: string) => s === "active" ? "bg-cost-positive/15 text-cost-positive" : s === "maintenance" ? "bg-cost-warning/15 text-cost-warning" : s === "available" ? "bg-status-progress/15 text-status-progress" : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-semibold text-foreground">Maquinaria Industrial</h2>
          <p className="text-[12px] text-muted-foreground">Equipos y maquinaria de producción, logística y operaciones</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 text-[12px]">
              <Plus className="w-3.5 h-3.5" /> Nueva Maquinaria
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Registrar Maquinaria</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Nombre de la Máquina</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Robot de Ensamblaje XR-21" className="h-8 text-[13px]" maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Categoría</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-8 text-[13px]"><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                  <SelectContent>
                    {machineryCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Área de Operación</Label>
                  <Input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="Producción" className="h-8 text-[13px]" maxLength={50} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Ubicación</Label>
                  <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Planta A - Sector 3" className="h-8 text-[13px]" maxLength={100} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Responsable</Label>
                  <Input value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} placeholder="Roberto Sánchez" className="h-8 text-[13px]" maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Capacidad (%)</Label>
                  <Input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="100" className="h-8 text-[13px] font-mono-data" min={0} max={100} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Proyecto Asociado</Label>
                <Select value={form.projectId} onValueChange={v => setForm(f => ({ ...f, projectId: v }))}>
                  <SelectTrigger className="h-8 text-[13px]"><SelectValue placeholder="Seleccionar proyecto" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} className="w-full text-[13px]">Registrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {machinery.map(m => {
          const Icon = categoryIcons[m.category] || Cog;
          const proj = projects.find(p => p.id === m.projectId);
          return (
            <div key={m.id} className="surface-card surface-card-hover p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] font-medium text-foreground truncate">{m.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{m.category}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className={cn("text-[10px] font-medium rounded-full px-2 py-0.5", statusColor(m.operationalStatus))}>
                  {statusLabel(m.operationalStatus)}
                </span>
              </div>

              <div className="space-y-1.5 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Área</span>
                  <span className="font-medium text-foreground">{m.area}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ubicación</span>
                  <span className="font-medium text-foreground truncate ml-4">{m.location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Responsable</span>
                  <span className="font-medium text-foreground">{m.responsible}</span>
                </div>
                {m.utilization > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Utilización</span>
                      <span className="font-mono-data font-medium text-foreground">{m.utilization}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-sf", m.utilization > 85 ? "bg-cost-warning" : "bg-primary")}
                        style={{ width: `${m.utilization}%` }}
                      />
                    </div>
                  </>
                )}
              </div>

              {proj && (
                <div className="mt-3 pt-2 border-t border-border">
                  <span className="text-[10px] bg-secondary text-secondary-foreground rounded px-1.5 py-0.5">{proj.code}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
