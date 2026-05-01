import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  NODE_TYPE_META,
  TASK_IMPACT_META,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
} from "@/lib/business-intelligence";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  ownerId?: string | null;
  parentId: string | null;
  nodeType: string;
  canCreate?: boolean;
}

export default function QuickCreateNodeDialog({ open, onOpenChange, projectId, ownerId, parentId, nodeType, canCreate = true }: Props) {
  const qc = useQueryClient();
  const meta = NODE_TYPE_META[nodeType] || NODE_TYPE_META.task;
  const isLeaf = meta.level === 2; // tarea / actividad → necesita más detalle

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [impact, setImpact] = useState("delivery");
  const [assignee, setAssignee] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [blocks, setBlocks] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setImpact("delivery");
      setAssignee("");
      setStartDate("");
      setDueDate("");
      setBlocks(false);
    }
  }, [open, nodeType, parentId]);

  const create = useMutation({
    mutationFn: async () => {
      if (!canCreate) throw new Error("No tienes permiso para editar esta sección.");
      if (!title.trim()) throw new Error("El nombre es obligatorio");
      if (!ownerId) throw new Error("Workspace no disponible");

      const { error } = await supabase.from("tasks").insert({
        project_id: projectId,
        owner_id: ownerId,
        parent_id: parentId,
        node_type: nodeType as any,
        title: title.trim(),
        description: description.trim() || null,
        status: status as any,
        priority: priority as any,
        impact: impact as any,
        assignee_name: assignee.trim() || null,
        start_date: startDate || null,
        due_date: dueDate || null,
        blocks_project: blocks,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-tasks-hierarchy", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-timeline", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks-summary", projectId] });
      toast.success(`${meta.label} creada`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("No se pudo crear", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{meta.emoji}</span>
            Nueva {meta.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nombre *</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Ej: ${meta.label} principal`}
            />
          </div>

          {isLeaf && (
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Descripción</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalle breve…"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_STATUS_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_PRIORITY_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Inicio</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Fin</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Responsable</Label>
            <Input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Nombre o equipo"
            />
          </div>

          {isLeaf && (
            <>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Impacto en negocio</Label>
                <Select value={impact} onValueChange={setImpact}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_IMPACT_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-2 pt-1">
                <Checkbox id="blocks-create" checked={blocks} onCheckedChange={(v) => setBlocks(!!v)} />
                <Label htmlFor="blocks-create" className="text-[12px] leading-tight cursor-pointer">
                  Esta tarea bloquea la entrega del proyecto
                </Label>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !canCreate} className="fire-button">
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Crear {meta.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
