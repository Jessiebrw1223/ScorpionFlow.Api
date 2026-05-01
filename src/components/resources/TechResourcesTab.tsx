import { useState } from "react";
import { techResources, techTypes, projects, type TechResource } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Plus, Cpu, Server, Brain, Cloud, Code, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

const typeIcons: Record<string, React.ElementType> = {
  "Base de datos relacional": Server,
  "Base de datos NoSQL": Server,
  "Inteligencia artificial": Brain,
  "Máquina virtual": Cloud,
  "Servidor": Server,
  "Servicio cloud": Cloud,
  "Herramienta de desarrollo": Code,
  "API externa": Workflow,
  "Plataforma de automatización": Workflow,
  "Computadora personal": Cpu,
};

export default function TechResourcesTab() {
  const [techs, setTechs] = useState<TechResource[]>(techResources);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "", technology: "", provider: "", responsible: "", projectId: "" });

  const handleAdd = () => {
    if (!form.name || !form.type || !form.technology || !form.provider || !form.responsible) {
      toast({ title: "Campos requeridos", description: "Complete todos los campos obligatorios", variant: "destructive" });
      return;
    }
    const newTech: TechResource = {
      id: `tech-${Date.now()}`,
      name: form.name.trim(),
      type: form.type,
      technology: form.technology.trim(),
      provider: form.provider.trim(),
      status: "active",
      projectId: form.projectId || "",
      responsible: form.responsible.trim(),
      implementationDate: new Date().toISOString().split("T")[0],
      utilization: 0,
    };
    setTechs(prev => [...prev, newTech]);
    setForm({ name: "", type: "", technology: "", provider: "", responsible: "", projectId: "" });
    setDialogOpen(false);
    toast({ title: "Recurso registrado", description: `${newTech.name} agregado exitosamente` });
  };

  const statusLabel = (s: string) => s === "active" ? "Activo" : s === "maintenance" ? "Mantenimiento" : "Inactivo";
  const statusColor = (s: string) => s === "active" ? "text-cost-positive" : s === "maintenance" ? "text-cost-warning" : "text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-semibold text-foreground">Recursos Tecnológicos</h2>
          <p className="text-[12px] text-muted-foreground">Infraestructura y herramientas tecnológicas del proyecto</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 text-[12px]">
              <Plus className="w-3.5 h-3.5" /> Nuevo Recurso
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Registrar Recurso Tecnológico</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Nombre del Recurso</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Base de Datos Principal" className="h-8 text-[13px]" maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Tipo de Tecnología</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="h-8 text-[13px]"><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                  <SelectContent>
                    {techTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Tecnología</Label>
                  <Input value={form.technology} onChange={e => setForm(f => ({ ...f, technology: e.target.value }))} placeholder="PostgreSQL" className="h-8 text-[13px]" maxLength={50} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Proveedor</Label>
                  <Input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} placeholder="AWS" className="h-8 text-[13px]" maxLength={50} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Responsable</Label>
                <Input value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} placeholder="Carlos López" className="h-8 text-[13px]" maxLength={100} />
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
        {techs.map(t => {
          const Icon = typeIcons[t.type] || Cpu;
          const proj = projects.find(p => p.id === t.projectId);
          return (
            <div key={t.id} className="surface-card surface-card-hover p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] font-medium text-foreground truncate">{t.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{t.type}</p>
                </div>
                <span className={cn("text-[10px] font-medium", statusColor(t.status))}>{statusLabel(t.status)}</span>
              </div>

              <div className="space-y-1.5 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tecnología</span>
                  <span className="font-medium text-foreground">{t.technology}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proveedor</span>
                  <span className="font-medium text-foreground">{t.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Responsable</span>
                  <span className="font-medium text-foreground">{t.responsible}</span>
                </div>
                {t.utilization > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Utilización</span>
                    <span className="font-mono-data font-medium text-foreground">{t.utilization}%</span>
                  </div>
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
