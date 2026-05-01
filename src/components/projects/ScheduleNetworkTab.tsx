import { useState } from "react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface NetworkNode {
  id: string;
  name: string;
  duration: number;
  es: number; // Early Start
  ef: number; // Early Finish
  ls: number; // Late Start
  lf: number; // Late Finish
  slack: number;
  isCritical: boolean;
  x: number;
  y: number;
  dependencies: string[];
}

const networkNodes: NetworkNode[] = [
  { id: "A", name: "Análisis", duration: 2, es: 0, ef: 2, ls: 0, lf: 2, slack: 0, isCritical: true, x: 0, y: 1, dependencies: [] },
  { id: "B", name: "Alcance", duration: 4, es: 2, ef: 6, ls: 2, lf: 6, slack: 0, isCritical: true, x: 1, y: 1, dependencies: ["A"] },
  { id: "C", name: "Diseño", duration: 10, es: 6, ef: 16, ls: 6, lf: 16, slack: 0, isCritical: true, x: 2, y: 1, dependencies: ["B"] },
  { id: "D", name: "Backend", duration: 4, es: 16, ef: 20, ls: 16, lf: 20, slack: 0, isCritical: true, x: 3, y: 1, dependencies: ["C"] },
  { id: "E", name: "Frontend", duration: 6, es: 16, ef: 22, ls: 22, lf: 28, slack: 6, isCritical: false, x: 3, y: 0, dependencies: ["C"] },
  { id: "F", name: "Pruebas QA", duration: 4, es: 16, ef: 23, ls: 20, lf: 27, slack: 4, isCritical: false, x: 3, y: 2, dependencies: ["C"] },
  { id: "G", name: "Integración", duration: 7, es: 20, ef: 27, ls: 20, lf: 27, slack: 0, isCritical: true, x: 4, y: 1, dependencies: ["D"] },
  { id: "H", name: "UI Testing", duration: 7, es: 22, ef: 29, ls: 28, lf: 35, slack: 6, isCritical: false, x: 4, y: 0, dependencies: ["E"] },
  { id: "I", name: "QA Final", duration: 8, es: 27, ef: 35, ls: 27, lf: 35, slack: 0, isCritical: false, x: 4, y: 2, dependencies: ["F"] },
  { id: "J", name: "Deploy", duration: 9, es: 29, ef: 38, ls: 35, lf: 44, slack: 6, isCritical: false, x: 5, y: 1, dependencies: ["G", "H"] },
  { id: "K", name: "Docs", duration: 4, es: 35, ef: 39, ls: 36, lf: 40, slack: 1, isCritical: false, x: 5, y: 0, dependencies: ["H"] },
  { id: "L", name: "Capacitación", duration: 5, es: 35, ef: 40, ls: 35, lf: 40, slack: 0, isCritical: true, x: 5, y: 2, dependencies: ["I"] },
  { id: "M", name: "Go-Live", duration: 2, es: 38, ef: 40, ls: 44, lf: 46, slack: 6, isCritical: false, x: 6, y: 1, dependencies: ["J"] },
  { id: "N", name: "Cierre", duration: 6, es: 40, ef: 46, ls: 40, lf: 46, slack: 0, isCritical: true, x: 6, y: 0, dependencies: ["K", "L"] },
];

const NODE_W = 160;
const NODE_H = 80;
const GAP_X = 60;
const GAP_Y = 30;
const PAD = 40;

function getNodePos(node: NetworkNode) {
  return {
    x: PAD + node.x * (NODE_W + GAP_X),
    y: PAD + node.y * (NODE_H + GAP_Y),
  };
}

export function ScheduleNetworkTab() {
  const [viewType, setViewType] = useState<"agile" | "traditional">("traditional");
  const maxX = Math.max(...networkNodes.map((n) => n.x));
  const maxY = Math.max(...networkNodes.map((n) => n.y));
  const svgW = PAD * 2 + (maxX + 1) * (NODE_W + GAP_X) - GAP_X + 120;
  const svgH = PAD * 2 + (maxY + 1) * (NODE_H + GAP_Y) - GAP_Y;

  const criticalCount = networkNodes.filter((n) => n.isCritical).length;
  const totalDuration = Math.max(...networkNodes.map((n) => n.lf));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(var(--accent))" }} />
            <span className="text-[11px] text-muted-foreground">Ruta Crítica</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-secondary border border-border" />
            <span className="text-[11px] text-muted-foreground">Actividad con Holgura</span>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono-data">
            Ruta Crítica: {criticalCount} actividades — {totalDuration} sem
          </Badge>
        </div>
        <Select value={viewType} onValueChange={(v: "agile" | "traditional") => setViewType(v)}>
          <SelectTrigger className="h-8 w-40 text-[12px] bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="agile">Ágil (2-4 sem)</SelectItem>
            <SelectItem value="traditional">Tradicional (4-8 sem)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Network Diagram */}
      <div className="surface-card p-4 overflow-x-auto">
        <svg width={svgW} height={svgH} className="min-w-full">
          {/* Arrows */}
          {networkNodes.map((node) =>
            node.dependencies.map((depId) => {
              const dep = networkNodes.find((n) => n.id === depId)!;
              const from = getNodePos(dep);
              const to = getNodePos(node);
              const x1 = from.x + NODE_W;
              const y1 = from.y + NODE_H / 2;
              const x2 = to.x;
              const y2 = to.y + NODE_H / 2;
              const bothCritical = dep.isCritical && node.isCritical;
              const midX = (x1 + x2) / 2;
              return (
                <g key={`${depId}-${node.id}`}>
                  <path
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={bothCritical ? "hsl(var(--accent))" : "hsl(var(--border))"}
                    strokeWidth={bothCritical ? 2 : 1}
                    strokeDasharray={bothCritical ? undefined : "4 4"}
                  />
                  <polygon
                    points={`${x2},${y2} ${x2 - 8},${y2 - 4} ${x2 - 8},${y2 + 4}`}
                    fill={bothCritical ? "hsl(var(--accent))" : "hsl(var(--border))"}
                  />
                </g>
              );
            })
          )}

          {/* START node */}
          <g>
            <rect x={PAD - 80} y={PAD + NODE_H / 2 + (NODE_H + GAP_Y) - 15} width={60} height={30} rx={6}
              fill="hsl(var(--primary))" opacity={0.2} stroke="hsl(var(--primary))" strokeWidth={1} />
            <text x={PAD - 50} y={PAD + NODE_H / 2 + (NODE_H + GAP_Y) + 5}
              textAnchor="middle" fill="hsl(var(--primary))" fontSize={11} fontWeight={700} fontFamily="IBM Plex Sans">
              INICIO
            </text>
          </g>

          {/* Arrow from START to A */}
          <line
            x1={PAD - 20} y1={PAD + NODE_H / 2 + (NODE_H + GAP_Y)}
            x2={PAD} y2={PAD + (NODE_H + GAP_Y) + NODE_H / 2}
            stroke="hsl(var(--accent))" strokeWidth={2}
          />

          {/* Nodes */}
          {networkNodes.map((node) => {
            const pos = getNodePos(node);
            return (
              <g key={node.id}>
                <rect
                  x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={6}
                  fill={node.isCritical ? "hsl(var(--card))" : "hsl(var(--secondary))"}
                  stroke={node.isCritical ? "hsl(var(--accent))" : "hsl(var(--border))"}
                  strokeWidth={node.isCritical ? 2 : 1}
                />
                {/* Top row: ES | Duration | EF */}
                <line x1={pos.x} y1={pos.y + 24} x2={pos.x + NODE_W} y2={pos.y + 24}
                  stroke={node.isCritical ? "hsl(var(--accent) / 0.3)" : "hsl(var(--border))"} />
                <line x1={pos.x} y1={pos.y + NODE_H - 24} x2={pos.x + NODE_W} y2={pos.y + NODE_H - 24}
                  stroke={node.isCritical ? "hsl(var(--accent) / 0.3)" : "hsl(var(--border))"} />
                {/* Vertical dividers top */}
                <line x1={pos.x + 45} y1={pos.y} x2={pos.x + 45} y2={pos.y + 24}
                  stroke={node.isCritical ? "hsl(var(--accent) / 0.3)" : "hsl(var(--border))"} />
                <line x1={pos.x + NODE_W - 45} y1={pos.y} x2={pos.x + NODE_W - 45} y2={pos.y + 24}
                  stroke={node.isCritical ? "hsl(var(--accent) / 0.3)" : "hsl(var(--border))"} />
                {/* Vertical dividers bottom */}
                <line x1={pos.x + 45} y1={pos.y + NODE_H - 24} x2={pos.x + 45} y2={pos.y + NODE_H}
                  stroke={node.isCritical ? "hsl(var(--accent) / 0.3)" : "hsl(var(--border))"} />
                <line x1={pos.x + NODE_W - 45} y1={pos.y + NODE_H - 24} x2={pos.x + NODE_W - 45} y2={pos.y + NODE_H}
                  stroke={node.isCritical ? "hsl(var(--accent) / 0.3)" : "hsl(var(--border))"} />

                {/* Top: ES */}
                <text x={pos.x + 22} y={pos.y + 16} textAnchor="middle"
                  fill="hsl(var(--foreground))" fontSize={11} fontFamily="IBM Plex Mono">{node.es}</text>
                {/* Top: Duration */}
                <text x={pos.x + NODE_W / 2} y={pos.y + 16} textAnchor="middle"
                  fill="hsl(var(--foreground))" fontSize={11} fontFamily="IBM Plex Mono">{node.duration}</text>
                {/* Top: EF */}
                <text x={pos.x + NODE_W - 22} y={pos.y + 16} textAnchor="middle"
                  fill="hsl(var(--foreground))" fontSize={11} fontFamily="IBM Plex Mono">{node.ef}</text>

                {/* Center: Activity name */}
                <text x={pos.x + NODE_W / 2} y={pos.y + NODE_H / 2 + 4} textAnchor="middle"
                  fill={node.isCritical ? "hsl(var(--accent))" : "hsl(var(--foreground))"} fontSize={12} fontWeight={600} fontFamily="IBM Plex Sans">
                  {node.name}
                </text>

                {/* Bottom: LS */}
                <text x={pos.x + 22} y={pos.y + NODE_H - 8} textAnchor="middle"
                  fill="hsl(var(--foreground))" fontSize={11} fontFamily="IBM Plex Mono">{node.ls}</text>
                {/* Bottom: Slack */}
                <text x={pos.x + NODE_W / 2} y={pos.y + NODE_H - 8} textAnchor="middle"
                  fill={node.slack === 0 ? "hsl(var(--accent))" : "hsl(var(--cost-positive))"} fontSize={11} fontWeight={700} fontFamily="IBM Plex Mono">
                  {node.slack}
                </text>
                {/* Bottom: LF */}
                <text x={pos.x + NODE_W - 22} y={pos.y + NODE_H - 8} textAnchor="middle"
                  fill="hsl(var(--foreground))" fontSize={11} fontFamily="IBM Plex Mono">{node.lf}</text>
              </g>
            );
          })}

          {/* FIN node */}
          {(() => {
            const finX = PAD + (maxX + 1) * (NODE_W + GAP_X);
            const finY = PAD + NODE_H / 2 + (NODE_H + GAP_Y) - 15;
            return (
              <g>
                <rect x={finX} y={finY} width={60} height={30} rx={6}
                  fill="hsl(var(--primary))" opacity={0.2} stroke="hsl(var(--primary))" strokeWidth={1} />
                <text x={finX + 30} y={finY + 20}
                  textAnchor="middle" fill="hsl(var(--primary))" fontSize={11} fontWeight={700} fontFamily="IBM Plex Sans">
                  FIN
                </text>
                <text x={finX + 30} y={finY + 44}
                  textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10} fontFamily="IBM Plex Mono">
                  Sem {totalDuration}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Activities Table */}
      <div className="surface-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Detalle de Actividades</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 px-2 font-medium">ID</th>
                <th className="text-left py-2 px-2 font-medium">Actividad</th>
                <th className="text-right py-2 px-2 font-medium">Dur.</th>
                <th className="text-right py-2 px-2 font-medium">ES</th>
                <th className="text-right py-2 px-2 font-medium">EF</th>
                <th className="text-right py-2 px-2 font-medium">LS</th>
                <th className="text-right py-2 px-2 font-medium">LF</th>
                <th className="text-right py-2 px-2 font-medium">Holgura</th>
                <th className="text-center py-2 px-2 font-medium">Crítica</th>
              </tr>
            </thead>
            <tbody>
              {networkNodes.map((n) => (
                <tr key={n.id} className={cn("border-b border-border/50", n.isCritical && "bg-accent/5")}>
                  <td className="py-2 px-2 font-mono-data font-bold text-primary">{n.id}</td>
                  <td className="py-2 px-2">{n.name}</td>
                  <td className="py-2 px-2 text-right font-mono-data">{n.duration}</td>
                  <td className="py-2 px-2 text-right font-mono-data">{n.es}</td>
                  <td className="py-2 px-2 text-right font-mono-data">{n.ef}</td>
                  <td className="py-2 px-2 text-right font-mono-data">{n.ls}</td>
                  <td className="py-2 px-2 text-right font-mono-data">{n.lf}</td>
                  <td className="py-2 px-2 text-right font-mono-data">
                    <span className={cn(n.slack === 0 ? "text-accent font-bold" : "text-cost-positive")}>{n.slack}</span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    {n.isCritical && <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/20">Sí</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
