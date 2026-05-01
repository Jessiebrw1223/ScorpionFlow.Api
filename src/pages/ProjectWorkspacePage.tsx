import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FolderKanban, LayoutDashboard, DollarSign, FileBarChart2, Receipt, Loader2, Users, CalendarRange, Clock, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getExecutionStatus, getFinancialHealth } from "@/lib/business-intelligence";
import { useUserSettings } from "@/hooks/useUserSettings";
import ProjectSummaryTab from "@/components/projects/workspace/ProjectSummaryTab";
import ProjectPlanningTab from "@/components/projects/workspace/ProjectPlanningTab";
import ProjectCostsTab from "@/components/projects/workspace/ProjectCostsTab";
import ProjectReportTab from "@/components/projects/workspace/ProjectReportTab";
import ProjectResourcesTab from "@/components/projects/workspace/ProjectResourcesTab";
import ProjectScheduleTab from "@/components/projects/workspace/ProjectScheduleTab";
import { usePremiumGate, type PremiumFeature } from "@/hooks/usePremiumGate";
import { UpsellDialog } from "@/components/billing/UpsellDialog";
import { useWorkspace } from "@/hooks/useWorkspace";
import { PageErrorState } from "@/components/state/PageStates";

type WorkspaceTab = "summary" | "planning" | "schedule" | "resources" | "costs" | "report";

const PREMIUM_TABS: Partial<Record<WorkspaceTab, PremiumFeature>> = {
  resources: "resources_management",
  costs: "cost_intelligence",
  report: "advanced_reports",
};

export default function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<WorkspaceTab>("planning");
  const { settings } = useUserSettings();
  const gate = usePremiumGate();
  const { ownerId, role, loading: workspaceLoading } = useWorkspace();

  // IMPORTANTE: NO filtrar por owner_id aquí. La RLS ya garantiza que el
  // usuario solo verá proyectos a los que tiene acceso (sus propios proyectos
  // como dueño, proyectos del workspace donde es miembro, o proyectos
  // compartidos via project_members). Filtrar por ownerId rompe el caso del
  // dueño que también es miembro de OTRO workspace: useWorkspace prioriza el
  // workspace ajeno y sus propios proyectos quedarían invisibles.
  const { data: project, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["project", id],
    enabled: !!id && !workspaceLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(id, name, company), quotations(id, title)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["project-tasks-summary", id],
    enabled: !!id && !workspaceLoading && !!project,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, status, due_date, blocks_project, node_type, weight")
        .eq("project_id", id!);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const required = PREMIUM_TABS[tab];
    if (required && gate.locked(required)) {
      setTab("planning");
    }
  }, [tab, gate]);

  if (workspaceLoading || isLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" /> Abriendo workspace del proyecto…
      </div>
    );
  }

  if (isError) {
    return (
      <PageErrorState
        error={error}
        title="No pudimos cargar el proyecto"
        description="Verifica que sigas activo en este workspace o intenta recargar."
        onRetry={() => refetch()}
      />
    );
  }

  if (!project) {
    // RLS oculta el proyecto si el usuario no tiene acceso (collaborator sin
    // membership). También cubre el caso de un id inexistente. En ambos
    // mostramos un mensaje claro en lugar de un error técnico.
    const isCollaborator = role === "collaborator";
    return (
      <div className="surface-card p-8 text-center space-y-3 max-w-lg mx-auto">
        <Lock className="w-10 h-10 text-muted-foreground mx-auto" />
        <div>
          <p className="font-semibold text-foreground">
            {isCollaborator ? "No tienes acceso a este proyecto" : "Proyecto no encontrado"}
          </p>
          <p className="text-[13px] text-muted-foreground mt-1">
            {isCollaborator
              ? "Tu rol no incluye este proyecto. Pide al propietario del workspace que te asigne acceso."
              : "Es posible que el proyecto haya sido eliminado o que no pertenezca a tu workspace actual."}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/projects"><ArrowLeft className="w-4 h-4" /> Volver a proyectos</Link>
        </Button>
      </div>
    );
  }

  const today = new Date();
  const overdueCount = tasks.filter(
    (t: any) => t.status !== "done" && t.due_date && new Date(t.due_date) < today
  ).length;
  const execution = getExecutionStatus({
    status: project.status,
    startDate: project.start_date,
    endDate: project.end_date,
    progress: Number(project.progress) || 0,
    hasOverdueTasks: overdueCount > 0,
    taskDates: tasks.map((t: any) => t.due_date),
    inferSchedule: settings.auto_behavior.inferSchedule,
  });
  const financial = getFinancialHealth({
    budget: Number(project.budget),
    actualCost: Number(project.actual_cost),
    targetMargin: settings.target_margin,
  });

  /**
   * Intercepta el cambio de tab: si el destino es premium y el usuario no
   * tiene acceso, abrimos el upsell SIN cambiar el tab actual (no rompemos vista).
   */
  const handleTabChange = (next: string) => {
    const nextTab = next as WorkspaceTab;
    const required = PREMIUM_TABS[nextTab];
    if (required && gate.locked(required)) {
      gate.open(required);
      return;
    }
    setTab(nextTab);
  };

  const renderTrigger = (value: WorkspaceTab, Icon: React.ElementType, label: string) => {
    const required = PREMIUM_TABS[value];
    const isLocked = required ? gate.locked(required) : false;
    return (
      <TabsTrigger
        value={value}
        className={cn(
          "gap-1.5 text-[12px] data-[state=active]:bg-card",
          isLocked && "opacity-80"
        )}
        title={isLocked ? `${label} · Requiere PRO` : label}
      >
        <Icon className="w-3.5 h-3.5" /> {label}
        {isLocked && <Lock className="w-3 h-3 text-primary/70 ml-0.5" />}
      </TabsTrigger>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header del workspace */}
      <div className="space-y-3">
        <button
          onClick={() => navigate("/projects")}
          className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-sf"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Todos los proyectos
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <FolderKanban className="w-5 h-5 text-primary fire-icon shrink-0" />
              <h1 className="text-xl font-bold fire-text truncate">{project.name}</h1>
              <span className={cn("text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded inline-flex items-center gap-1", financial.bg, financial.color)}>
                💰 {financial.label}
              </span>
              <span className={cn("text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded", execution.bg, execution.color)}>
                {execution.key === "not_evaluable" ? "⚠️" : "📅"} {execution.label}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground mt-1 ml-7">
              <span>Cliente: </span>
              <span className="text-foreground font-medium">{project.clients?.name || "—"}</span>
              {project.clients?.company ? (
                <span> · {project.clients.company}</span>
              ) : null}
              {project.quotations ? (
                <span>
                  {" · "}
                  <Link to="/cotizaciones" className="text-primary hover:underline inline-flex items-center gap-1">
                    <Receipt className="w-3 h-3" /> Origen: {project.quotations.title}
                  </Link>
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      {/* Workspace tabs */}
      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="bg-secondary border border-border w-full justify-start overflow-x-auto">
          {renderTrigger("summary", LayoutDashboard, "Resumen")}
          {renderTrigger("planning", CalendarRange, "Planificación")}
          {renderTrigger("schedule", Clock, "Cronograma")}
          {renderTrigger("resources", Users, "Recursos")}
          {renderTrigger("costs", DollarSign, "Costos")}
          {renderTrigger("report", FileBarChart2, "Informe")}
        </TabsList>

        <TabsContent value="summary">
          <ProjectSummaryTab project={project} tasks={tasks} onTabChange={(t) => handleTabChange(t)} />
        </TabsContent>
        <TabsContent value="planning">
          <ProjectPlanningTab projectId={project.id} planningMode={(project as any).planning_mode || "agile"} role={role} ownerId={ownerId} />
        </TabsContent>
        <TabsContent value="schedule">
          <ProjectScheduleTab project={project} role={role} />
        </TabsContent>
        {/* Los tabs premium ya no se renderizan para Free porque handleTabChange impide
            que el usuario llegue a ellos. Pro+ los ve de forma normal. */}
        <TabsContent value="resources">
          <ProjectResourcesTab project={project} />
        </TabsContent>
        <TabsContent value="costs">
          <ProjectCostsTab project={project} />
        </TabsContent>
        <TabsContent value="report">
          <ProjectReportTab project={project} />
        </TabsContent>
      </Tabs>

      <UpsellDialog
        open={gate.dialog.open}
        onOpenChange={gate.close}
        feature={gate.dialog.feature}
      />
    </div>
  );
}
