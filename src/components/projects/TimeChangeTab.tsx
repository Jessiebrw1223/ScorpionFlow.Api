import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, Zap, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  name: string;
  originalDuration: number;
  currentDuration: number;
  hoursAssigned: number;
  priority: "high" | "medium" | "low";
  impact: string;
}

const initialActivities: Activity[] = [
  { id: "A", name: "Análisis inicial", originalDuration: 2, currentDuration: 2, hoursAssigned: 16, priority: "medium", impact: "Sin cambio" },
  { id: "B", name: "Definición de alcance", originalDuration: 4, currentDuration: 4, hoursAssigned: 32, priority: "high", impact: "Sin cambio" },
  { id: "C", name: "Diseño técnico", originalDuration: 10, currentDuration: 10, hoursAssigned: 80, priority: "high", impact: "Sin cambio" },
  { id: "D", name: "Desarrollo Backend", originalDuration: 4, currentDuration: 4, hoursAssigned: 32, priority: "high", impact: "Sin cambio" },
  { id: "E", name: "Desarrollo Frontend", originalDuration: 6, currentDuration: 6, hoursAssigned: 48, priority: "medium", impact: "Sin cambio" },
  { id: "F", name: "Pruebas", originalDuration: 4, currentDuration: 4, hoursAssigned: 32, priority: "medium", impact: "Sin cambio" },
  { id: "G", name: "Integración", originalDuration: 7, currentDuration: 7, hoursAssigned: 56, priority: "high", impact: "Sin cambio" },
];

const priorityConfig = {
  high: { label: "Alta", className: "bg-accent/15 text-accent border-accent/20" },
  medium: { label: "Media", className: "bg-cost-warning/15 text-cost-warning border-cost-warning/20" },
  low: { label: "Baja", className: "bg-muted text-muted-foreground border-border" },
};

export function TimeChangeTab() {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [selectedId, setSelectedId] = useState<string>("C");

  const selected = activities.find((a) => a.id === selectedId)!;
  const totalOriginal = activities.reduce((s, a) => s + a.originalDuration, 0);
  const totalCurrent = activities.reduce((s, a) => s + a.currentDuration, 0);
  const timeSaved = totalOriginal - totalCurrent;

  const updateActivity = (id: string, newDuration: number, newHours: number) => {
    setActivities(activities.map((a) => {
      if (a.id !== id) return a;
      const diff = a.originalDuration - newDuration;
      const impact = diff > 0 ? `Reducción de ${diff} sem` : diff < 0 ? `Extensión de ${Math.abs(diff)} sem` : "Sin cambio";
      return { ...a, currentDuration: newDuration, hoursAssigned: newHours, impact };
    }));
  };

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="surface-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-[11px] text-muted-foreground">Duración Original</span>
          </div>
          <span className="font-mono-data text-lg font-bold text-foreground">{totalOriginal} sem</span>
        </div>
        <div className="surface-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-cost-warning" />
            <span className="text-[11px] text-muted-foreground">Duración Actual</span>
          </div>
          <span className="font-mono-data text-lg font-bold text-foreground">{totalCurrent} sem</span>
        </div>
        <div className="surface-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-cost-positive" />
            <span className="text-[11px] text-muted-foreground">Tiempo Ahorrado</span>
          </div>
          <span className={cn("font-mono-data text-lg font-bold", timeSaved > 0 ? "text-cost-positive" : timeSaved < 0 ? "text-cost-negative" : "text-foreground")}>
            {timeSaved > 0 ? "+" : ""}{timeSaved} sem
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activities List */}
        <div className="surface-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Actividades del Proyecto</h3>
          <div className="space-y-1">
            {activities.map((a) => {
              const changed = a.currentDuration !== a.originalDuration;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-sf",
                    selectedId === a.id ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/50 border border-transparent"
                  )}
                >
                  <span className="font-mono-data text-[11px] text-primary font-bold w-6">{a.id}</span>
                  <span className="text-[13px] flex-1 text-foreground">{a.name}</span>
                  {changed && (
                    <span className="flex items-center gap-1 text-[11px] font-mono-data">
                      <span className="text-muted-foreground line-through">{a.originalDuration}</span>
                      <ArrowRight className="w-3 h-3 text-primary" />
                      <span className={cn(a.currentDuration < a.originalDuration ? "text-cost-positive" : "text-cost-negative")}>
                        {a.currentDuration}
                      </span>
                    </span>
                  )}
                  {!changed && (
                    <span className="font-mono-data text-[11px] text-muted-foreground">{a.currentDuration} sem</span>
                  )}
                  <Badge variant="outline" className={cn("text-[10px]", priorityConfig[a.priority].className)}>
                    {priorityConfig[a.priority].label}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Edit Panel */}
        <div className="surface-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Modificar Actividad</h3>
          <p className="text-[12px] text-muted-foreground mb-4">Ajustar duración y recursos de la actividad seleccionada</p>

          <div className="space-y-4">
            <div className="surface-card p-3 bg-secondary/30">
              <span className="text-[11px] text-muted-foreground">Actividad seleccionada</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono-data text-primary font-bold text-sm">{selected.id}</span>
                <span className="text-[13px] font-semibold text-foreground">{selected.name}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">Duración original</Label>
                <Input value={`${selected.originalDuration} semanas`} disabled className="h-9 text-[13px] bg-secondary/50 border-border font-mono-data" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">Nueva duración (semanas)</Label>
                <Input
                  type="number"
                  min={1}
                  value={selected.currentDuration}
                  onChange={(e) => updateActivity(selected.id, Number(e.target.value), selected.hoursAssigned)}
                  className="h-9 text-[13px] bg-secondary border-border font-mono-data"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Horas de trabajo asignadas</Label>
              <Input
                type="number"
                min={1}
                value={selected.hoursAssigned}
                onChange={(e) => updateActivity(selected.id, selected.currentDuration, Number(e.target.value))}
                className="h-9 text-[13px] bg-secondary border-border font-mono-data"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Prioridad</Label>
              <Select defaultValue={selected.priority}>
                <SelectTrigger className="h-9 text-[13px] bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="surface-card p-3 bg-secondary/30">
              <span className="text-[11px] text-muted-foreground">Impacto en el cronograma</span>
              <p className={cn(
                "text-[13px] font-semibold mt-1",
                selected.impact.includes("Reducción") ? "text-cost-positive" :
                selected.impact.includes("Extensión") ? "text-cost-negative" : "text-muted-foreground"
              )}>
                {selected.impact}
              </p>
            </div>

            <Button className="w-full h-9 text-[13px]">
              <Zap className="w-3.5 h-3.5 mr-1.5" /> Recalcular Cronograma
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
