import { useState } from "react";
import { projects } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

const statusOptions = [
  { value: "on_track", label: "En Tiempo" },
  { value: "at_risk", label: "En Riesgo" },
  { value: "over_budget", label: "Sobre Presupuesto" },
];

const priorityOptions = ["Alta", "Media", "Baja", "Crítica"];
const scheduleFromOptions = ["Fecha de inicio", "Fecha de finalización"];
const calendarOptions = ["Estándar", "24 Horas", "Turno nocturno"];

interface CustomField {
  id: string;
  name: string;
  value: string;
}

export function ProjectReportTab() {
  const project = projects[0];
  const [customFields, setCustomFields] = useState<CustomField[]>([
    { id: "1", name: "Cliente", value: "Empresa X" },
    { id: "2", name: "Tipo de proyecto", value: "Industrial" },
  ]);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");

  const addCustomField = () => {
    if (newFieldName && newFieldValue) {
      setCustomFields([...customFields, { id: Date.now().toString(), name: newFieldName, value: newFieldValue }]);
      setNewFieldName("");
      setNewFieldValue("");
    }
  };

  const removeField = (id: string) => {
    setCustomFields(customFields.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="surface-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Información del Proyecto</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Nombre del proyecto</Label>
            <Input defaultValue={project.name} className="h-9 text-[13px] bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Estado del proyecto</Label>
            <Select defaultValue={project.status}>
              <SelectTrigger className="h-9 text-[13px] bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Fecha de inicio</Label>
            <Input type="date" defaultValue={project.startDate} className="h-9 text-[13px] bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Fecha actual del proyecto</Label>
            <Input type="date" defaultValue="2026-03-15" className="h-9 text-[13px] bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Fecha estimada de finalización</Label>
            <Input type="date" defaultValue={project.endDate} className="h-9 text-[13px] bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Código</Label>
            <Input defaultValue={project.code} className="h-9 text-[13px] bg-secondary border-border font-mono-data" />
          </div>
        </div>
      </div>

      {/* Scheduling Options */}
      <div className="surface-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Opciones de Programación</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Programar a partir de</Label>
            <Select defaultValue="Fecha de inicio">
              <SelectTrigger className="h-9 text-[13px] bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scheduleFromOptions.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Calendario del proyecto</Label>
            <Select defaultValue="Estándar">
              <SelectTrigger className="h-9 text-[13px] bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {calendarOptions.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Prioridad del proyecto</Label>
            <Select defaultValue="Alta">
              <SelectTrigger className="h-9 text-[13px] bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Departamento responsable</Label>
            <Input defaultValue="Ingeniería de Software" className="h-9 text-[13px] bg-secondary border-border" />
          </div>
        </div>
      </div>

      {/* Custom Fields */}
      <div className="surface-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Campos Personalizados</h3>
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-[12px]">Campo personalizado</TableHead>
              <TableHead className="text-[12px]">Valor</TableHead>
              <TableHead className="text-[12px] w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customFields.map((field) => (
              <TableRow key={field.id} className="border-border">
                <TableCell className="text-[13px] font-medium">{field.name}</TableCell>
                <TableCell className="text-[13px]">
                  <Badge variant="secondary" className="font-normal">{field.value}</Badge>
                </TableCell>
                <TableCell>
                  <button onClick={() => removeField(field.id)} className="text-muted-foreground hover:text-destructive transition-sf">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex gap-2 mt-3">
          <Input placeholder="Nombre del campo" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} className="h-8 text-[12px] bg-secondary border-border flex-1" />
          <Input placeholder="Valor" value={newFieldValue} onChange={(e) => setNewFieldValue(e.target.value)} className="h-8 text-[12px] bg-secondary border-border flex-1" />
          <Button size="sm" onClick={addCustomField} className="h-8 text-[12px]">
            <Plus className="w-3.5 h-3.5 mr-1" /> Agregar
          </Button>
        </div>
      </div>
    </div>
  );
}
