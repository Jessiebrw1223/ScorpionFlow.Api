import { useState } from "react";
import { ChevronDown, ChevronRight, Circle, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface WBSNode {
  id: string;
  name: string;
  duration: string;
  responsible: string;
  progress: number;
  status: "pending" | "in_progress" | "done";
  children?: WBSNode[];
}

const wbsData: WBSNode[] = [
  {
    id: "1", name: "Planificación", duration: "4 sem", responsible: "Luis Ramírez", progress: 100, status: "done",
    children: [
      { id: "1.1", name: "Análisis inicial", duration: "2 sem", responsible: "Luis Ramírez", progress: 100, status: "done" },
      { id: "1.2", name: "Definición de alcance", duration: "2 sem", responsible: "Luis Ramírez", progress: 100, status: "done" },
    ],
  },
  {
    id: "2", name: "Diseño", duration: "6 sem", responsible: "María Torres", progress: 75, status: "in_progress",
    children: [
      { id: "2.1", name: "Diseño técnico", duration: "3 sem", responsible: "María Torres", progress: 100, status: "done" },
      { id: "2.2", name: "Arquitectura del sistema", duration: "3 sem", responsible: "Ana García", progress: 50, status: "in_progress" },
    ],
  },
  {
    id: "3", name: "Implementación", duration: "10 sem", responsible: "Ana García", progress: 40, status: "in_progress",
    children: [
      { id: "3.1", name: "Desarrollo Backend", duration: "6 sem", responsible: "Carlos López", progress: 55, status: "in_progress" },
      { id: "3.2", name: "Desarrollo Frontend", duration: "5 sem", responsible: "Ana García", progress: 30, status: "in_progress" },
      { id: "3.3", name: "Pruebas unitarias", duration: "3 sem", responsible: "Elena Martín", progress: 10, status: "in_progress" },
    ],
  },
  {
    id: "4", name: "Cierre", duration: "2 sem", responsible: "Luis Ramírez", progress: 0, status: "pending",
    children: [
      { id: "4.1", name: "Entrega final", duration: "1 sem", responsible: "Luis Ramírez", progress: 0, status: "pending" },
      { id: "4.2", name: "Evaluación del proyecto", duration: "1 sem", responsible: "Luis Ramírez", progress: 0, status: "pending" },
    ],
  },
];

const statusIcon = {
  pending: <Circle className="w-3.5 h-3.5 text-muted-foreground" />,
  in_progress: <Clock className="w-3.5 h-3.5 text-status-progress" />,
  done: <CheckCircle2 className="w-3.5 h-3.5 text-status-done" />,
};

function WBSNodeRow({ node, level = 0 }: { node: WBSNode; level?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 border-b border-border hover:bg-secondary/50 transition-sf",
          level === 0 && "bg-secondary/30"
        )}
        style={{ paddingLeft: `${16 + level * 24}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground transition-sf">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {statusIcon[node.status]}

        <span className="font-mono-data text-[11px] text-primary font-medium w-8">{node.id}</span>
        <span className={cn("text-[13px] flex-1", level === 0 ? "font-semibold text-foreground" : "text-foreground/90")}>
          {node.name}
        </span>
        <span className="text-[12px] text-muted-foreground w-16 text-right">{node.duration}</span>
        <span className="text-[12px] text-muted-foreground w-32 text-right truncate">{node.responsible}</span>
        <div className="w-24 flex items-center gap-2">
          <Progress value={node.progress} className="h-1.5 flex-1" />
          <span className="font-mono-data text-[11px] text-muted-foreground w-8 text-right">{node.progress}%</span>
        </div>
      </div>
      {expanded && hasChildren && node.children!.map((child) => (
        <WBSNodeRow key={child.id} node={child} level={level + 1} />
      ))}
    </>
  );
}

export function WBSTab() {
  return (
    <div className="space-y-4">
      <div className="surface-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Estructura de Desglose del Trabajo</h3>
          <span className="text-[11px] text-muted-foreground font-mono-data">Project Alpha — ALPHA</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border text-[11px] section-header">
          <span className="w-4" />
          <span className="w-3.5" />
          <span className="w-8">ID</span>
          <span className="flex-1">Actividad</span>
          <span className="w-16 text-right">Duración</span>
          <span className="w-32 text-right">Responsable</span>
          <span className="w-24 text-right">Avance</span>
        </div>

        {/* Tree */}
        {wbsData.map((node) => (
          <WBSNodeRow key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}
