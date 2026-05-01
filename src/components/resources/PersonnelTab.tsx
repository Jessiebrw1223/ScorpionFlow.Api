import { useState } from "react";
import { personnelResources, projectRoles, projects, costFormatter, type PersonnelResource } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

export default function PersonnelTab() {
  const [personnel, setPersonnel] = useState<PersonnelResource[]>(personnelResources);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", position: "", salary: "", projectRole: "" });

  const handleAdd = () => {
    if (!form.firstName || !form.lastName || !form.position || !form.salary || !form.projectRole) {
      toast({ title: "Campos requeridos", description: "Complete todos los campos obligatorios", variant: "destructive" });
      return;
    }
    const salary = parseFloat(form.salary);
    if (isNaN(salary) || salary <= 0) {
      toast({ title: "Salario inválido", description: "Ingrese un salario válido", variant: "destructive" });
      return;
    }
    const newPerson: PersonnelResource = {
      id: `per-${Date.now()}`,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      position: form.position.trim(),
      salary,
      projectRole: form.projectRole,
      utilization: 0,
      assignedProjects: [],
      status: "active",
    };
    setPersonnel(prev => [...prev, newPerson]);
    setForm({ firstName: "", lastName: "", position: "", salary: "", projectRole: "" });
    setDialogOpen(false);
    toast({ title: "Personal registrado", description: `${newPerson.firstName} ${newPerson.lastName} agregado exitosamente` });
  };

  const statusLabel = (s: string) => s === "active" ? "Activo" : s === "on_leave" ? "Permiso" : "Inactivo";
  const statusColor = (s: string) => s === "active" ? "text-cost-positive" : s === "on_leave" ? "text-cost-warning" : "text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-semibold text-foreground">Asignación de Personal</h2>
          <p className="text-[12px] text-muted-foreground">Gestión y registro de miembros del equipo</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 text-[12px]">
              <Plus className="w-3.5 h-3.5" /> Nuevo Personal
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Registrar Personal</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Nombre</Label>
                  <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Ana" className="h-8 text-[13px]" maxLength={50} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Apellido</Label>
                  <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="García" className="h-8 text-[13px]" maxLength={50} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Cargo</Label>
                <Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="Ingeniera de Software" className="h-8 text-[13px]" maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Salario (USD)</Label>
                <Input type="number" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} placeholder="4500" className="h-8 text-[13px] font-mono-data" min={0} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Rol en el Proyecto</Label>
                <Select value={form.projectRole} onValueChange={v => setForm(f => ({ ...f, projectRole: v }))}>
                  <SelectTrigger className="h-8 text-[13px]"><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
                  <SelectContent>
                    {projectRoles.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} className="w-full text-[13px]">Registrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Personnel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {personnel.map(p => {
          const isOverloaded = p.utilization > 90;
          return (
            <div key={p.id} className={cn("surface-card surface-card-hover p-4", isOverloaded && "scorpion-border-left-alert")}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-medium text-primary">{p.firstName[0]}{p.lastName[0]}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-medium text-foreground truncate">{p.firstName} {p.lastName}</h3>
                  <p className="text-[11px] text-muted-foreground">{p.position}</p>
                </div>
                <span className={cn("text-[10px] font-medium ml-auto", statusColor(p.status))}>{statusLabel(p.status)}</span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">Utilización</span>
                  <span className={cn("font-mono-data font-medium", isOverloaded ? "text-cost-negative" : p.utilization > 75 ? "text-cost-warning" : "text-foreground")}>{p.utilization}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-sf", isOverloaded ? "bg-cost-negative" : p.utilization > 75 ? "bg-cost-warning" : "bg-primary")} style={{ width: `${Math.min(p.utilization, 100)}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border text-[12px]">
                <div>
                  <span className="text-muted-foreground block">Salario</span>
                  <span className="font-mono-data font-medium text-foreground">{costFormatter.format(p.salary)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Rol</span>
                  <span className="font-medium text-foreground truncate block">{p.projectRole}</span>
                </div>
              </div>

              {p.assignedProjects.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  <span className="text-[11px] text-muted-foreground">Proyectos: </span>
                  {p.assignedProjects.map(pid => {
                    const proj = projects.find(pr => pr.id === pid);
                    return proj ? <span key={pid} className="text-[10px] bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 mr-1">{proj.code}</span> : null;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
