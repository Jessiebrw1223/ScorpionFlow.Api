import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  FolderKanban,
  Search,
  Receipt,
  ArrowRight,
  Info,
  Crown,
  Users,
  Share2,
  Eye,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getExecutionStatus,
  getFinancialHealth,
  getProjectHealth,
  type ProjectHealth,
} from "@/lib/business-intelligence";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useMoney } from "@/lib/format-money";
import { PageLoadingState, PageEmptyState, PageErrorState } from "@/components/state/PageStates";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace, type WorkspaceRole } from "@/hooks/useWorkspace";

type ProjectStatus = "on_track" | "at_risk" | "over_budget" | "completed" | "cancelled";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  progress: number;
  budget: number;
  actual_cost: number;
  start_date: string | null;
  end_date: string | null;
  client_id: string;
  quotation_id: string | null;
  owner_id: string;
  created_at: string;
  clients?: { id: string; name: string; company: string | null };
  quotations?: { id: string; title: string };
}

type ProjectScope = "own" | "shared" | "team";

type FilterKey =
  | "all"
  | "own"
  | "shared"
  | "team"
  | "healthy"
  | "risk"
  | "over_budget"
  | "completed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "own", label: "Mis proyectos" },
  { key: "shared", label: "Compartidos" },
  { key: "team", label: "Por equipo" },
  { key: "healthy", label: "🟢 Saludable" },
  { key: "risk", label: "🟡 En riesgo" },
  { key: "over_budget", label: "🔴 Sobrepresupuesto" },
  { key: "completed", label: "✓ Completados" },
];

const ROLE_BADGE: Record<NonNullable<WorkspaceRole>, { label: string; icon: React.ElementType; cls: string }> = {
  owner: { label: "Propietario", icon: Crown, cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  admin: { label: "Admin", icon: Shield, cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  collaborator: { label: "Colaborador", icon: Users, cls: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  viewer: { label: "Visualizador", icon: Eye, cls: "bg-muted text-muted-foreground" },
};

const SCOPE_BADGE: Record<ProjectScope, { label: string; cls: string }> = {
  own: { label: "Propio", cls: "bg-primary/15 text-primary" },
  shared: { label: "Compartido", cls: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  team: { label: "Equipo", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
};

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const PEN = useMoney();
  const { settings } = useUserSettings();
  const { user } = useAuth();
  const { guestWorkspaces } = useWorkspace();
  // Set de owner_ids de equipos ajenos donde soy miembro (para clasificar "team" vs "shared").
  const guestOwnerIds = useMemo(
    () => new Set(guestWorkspaces.map((g) => g.ownerId)),
    [guestWorkspaces],
  );

  const { data: projects = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["projects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(id, name, company), quotations(id, title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Project[];
    },
  });

  // Clasificar cada proyecto en su sección visual + calcular salud
  const enriched = useMemo(() => {
    return projects.map((p) => {
      const execution = getExecutionStatus({
        status: p.status,
        startDate: p.start_date,
        endDate: p.end_date,
        progress: Number(p.progress) || 0,
        inferSchedule: settings.auto_behavior.inferSchedule,
      });
      const financial = getFinancialHealth({
        budget: Number(p.budget),
        actualCost: Number(p.actual_cost),
        targetMargin: settings.target_margin,
      });
      const health = getProjectHealth({ execution, financial });

      // Clasificación:
      //   own    = yo soy el owner del proyecto (workspace personal).
      //   team   = el proyecto pertenece a un workspace ajeno donde soy miembro del equipo.
      //   shared = el proyecto fue compartido conmigo vía project_members
      //            (no soy miembro del workspace owner, solo del proyecto).
      let scope: ProjectScope = "own";
      if (p.owner_id === user?.id) scope = "own";
      else if (guestOwnerIds.has(p.owner_id)) scope = "team";
      else scope = "shared";

      return { project: p, execution, financial, health, scope };
    });
  }, [projects, settings.auto_behavior.inferSchedule, settings.target_margin, user?.id, guestOwnerIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter(({ project: p, health, scope }) => {
      // Filtro por categoría
      if (filter === "own" && scope !== "own") return false;
      if (filter === "shared" && scope !== "shared") return false;
      if (filter === "team" && scope !== "team") return false;
      if (filter === "healthy" && health.key !== "healthy") return false;
      if (filter === "risk" && health.key !== "risk") return false;
      if (filter === "over_budget" && health.key !== "over_budget" && health.key !== "critical") return false;
      if (filter === "completed" && health.key !== "completed") return false;

      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (p.clients?.name || "").toLowerCase().includes(q)
      );
    });
  }, [enriched, search, filter]);

  const sections = useMemo(() => {
    return {
      own: filtered.filter((x) => x.scope === "own"),
      shared: filtered.filter((x) => x.scope === "shared"),
      team: filtered.filter((x) => x.scope === "team"),
    };
  }, [filtered]);

  const stats = useMemo(() => {
    const healthy = enriched.filter((x) => x.health.key === "healthy").length;
    const risk = enriched.filter((x) => x.health.key === "risk").length;
    const overBudget = enriched.filter(
      (x) => x.health.key === "over_budget" || x.health.key === "critical",
    ).length;
    // Solo agregamos métricas financieras de proyectos propios para no exponer datos de otros workspaces como rentabilidad propia.
    const ownProjects = enriched.filter((x) => x.scope === "own").map((x) => x.project);
    const totalBudget = ownProjects.reduce((s, p) => s + Number(p.budget), 0);
    const totalCost = ownProjects.reduce((s, p) => s + Number(p.actual_cost), 0);
    const profit = totalBudget - totalCost;
    return { healthy, risk, overBudget, totalBudget, totalCost, profit };
  }, [enriched]);

  const hasOwn = enriched.some((x) => x.scope === "own");
  const hasAny = enriched.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 fire-text">
            <FolderKanban className="w-5 h-5 text-primary fire-icon" />
            Proyectos
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {hasOwn
              ? <>¿Cómo va lo que vendí? · {projects.length} proyectos en tu vista</>
              : hasAny
                ? <>Estos son los proyectos donde colaboras. · {projects.length} en total</>
                : <>Aún no tienes proyectos · cada uno es un workspace aislado</>
            }
          </p>
        </div>
      </div>

      {/* Aviso de flujo solo si tiene proyectos propios o ninguno */}
      {hasOwn || !hasAny ? (
        <div className="surface-card p-3 bg-primary/5 border border-primary/20 flex items-start gap-3">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[12px] text-muted-foreground flex-1">
            Los proyectos se crean automáticamente al ganar una cotización. Tu flujo natural es{" "}
            <span className="text-primary font-medium">Cliente → Cotización → Proyecto</span>.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/cotizaciones"><Receipt className="w-3.5 h-3.5" /> Ir a Cotizaciones</Link>
          </Button>
        </div>
      ) : null}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="surface-card p-3 border-l-4 border-cost-positive">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">🟢 Saludables</div>
          <div className="text-xl font-bold font-mono-data text-cost-positive">{stats.healthy}</div>
        </div>
        <div className="surface-card p-3 border-l-4 border-cost-warning">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">🟡 En riesgo</div>
          <div className="text-xl font-bold font-mono-data text-cost-warning">{stats.risk}</div>
        </div>
        <div className="surface-card p-3 border-l-4 border-cost-negative">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">🔴 Sobrepresupuesto</div>
          <div className="text-xl font-bold font-mono-data text-cost-negative">{stats.overBudget}</div>
        </div>
        <div className="surface-card p-3 border-l-4 border-primary">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Rentabilidad (mis proyectos)
          </div>
          <div className={cn("text-xl font-bold font-mono-data", stats.profit >= 0 ? "text-cost-positive" : "text-cost-negative")}>
            {PEN.format(stats.profit)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar proyecto, cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50"
          />
        </div>
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 text-[12px] rounded-md transition-sf font-medium",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <PageLoadingState title="Cargando proyectos…" />
      ) : isError ? (
        <PageErrorState error={error} onRetry={() => refetch()} />
      ) : !hasAny ? (
        <div className="surface-card fire-border p-8 text-center space-y-3">
          <FolderKanban className="w-10 h-10 text-primary fire-icon mx-auto" />
          <div>
            <p className="font-semibold text-foreground">Aún no tienes proyectos</p>
            <p className="text-[13px] text-muted-foreground mt-1">
              Tu primer proyecto nacerá cuando ganes una cotización. Ve a Cotizaciones, marca una como{" "}
              <span className="text-primary">Ganada</span> y conviértela en proyecto con un clic.
            </p>
          </div>
          <Button asChild className="fire-button">
            <Link to="/cotizaciones"><Receipt className="w-4 h-4" /> Ir a Cotizaciones</Link>
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <PageEmptyState
          icon={<Search className="w-6 h-6 text-muted-foreground" />}
          title="Sin resultados"
          description="Ningún proyecto coincide con esos filtros. Prueba ajustando la búsqueda."
        />
      ) : (
        <div className="space-y-6">
          <ProjectSection
            title="Mis proyectos"
            icon={<Crown className="w-3.5 h-3.5" />}
            description="Proyectos creados por ti."
            items={sections.own}
            scope="own"
            workspaceRole="owner"
            PEN={PEN}
          />
          <ProjectSection
            title="Compartidos conmigo"
            icon={<Share2 className="w-3.5 h-3.5" />}
            description="Proyectos donde te asignaron acceso específico."
            items={sections.shared}
            scope="shared"
            workspaceRole="collaborator"
            PEN={PEN}
          />
          <ProjectSection
            title={
              guestWorkspaces.length === 1 && guestWorkspaces[0].ownerName
                ? `Equipo · ${guestWorkspaces[0].ownerName}`
                : "Equipos / Workspaces"
            }
            icon={<Users className="w-3.5 h-3.5" />}
            description="Proyectos de los workspaces donde colaboras."
            items={sections.team}
            scope="team"
            workspaceRole={guestWorkspaces[0]?.role ?? "collaborator"}
            PEN={PEN}
          />
        </div>
      )}
    </div>
  );
}

interface ProjectSectionProps {
  title: string;
  icon: React.ReactNode;
  description: string;
  items: Array<{
    project: Project;
    health: ReturnType<typeof getProjectHealth>;
    scope: ProjectScope;
  }>;
  scope: ProjectScope;
  workspaceRole: WorkspaceRole | null;
  PEN: { format: (n: number) => string };
}

function ProjectSection({ title, icon, description, items, scope, workspaceRole, PEN }: ProjectSectionProps) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          {icon} {title}
        </h2>
        <span className="text-[11px] text-muted-foreground">· {items.length}</span>
      </div>
      <p className="text-[12px] text-muted-foreground -mt-1">{description}</p>
      <div className="space-y-2 pt-1">
        {items.map(({ project: p, health, scope: itemScope }) => (
          <CompactProjectCard
            key={p.id}
            project={p}
            health={health}
            scope={itemScope}
            workspaceRole={workspaceRole}
            PEN={PEN}
          />
        ))}
      </div>
    </section>
  );
}

interface CompactCardProps {
  project: Project;
  health: ReturnType<typeof getProjectHealth>;
  scope: ProjectScope;
  workspaceRole: WorkspaceRole | null;
  PEN: { format: (n: number) => string };
}

function CompactProjectCard({ project: p, health, scope, workspaceRole, PEN }: CompactCardProps) {
  const margin = Number(p.budget) - Number(p.actual_cost);
  const marginPct = Number(p.budget) > 0 ? ((margin / Number(p.budget)) * 100).toFixed(0) : "0";
  const overBudget = Number(p.actual_cost) > Number(p.budget);
  const progressClamped = Math.max(0, Math.min(100, Number(p.progress) || 0));

  // El rol mostrado en la tarjeta:
  // - own → siempre owner
  // - team/shared → rol efectivo en el workspace
  const effectiveRole: NonNullable<WorkspaceRole> =
    scope === "own" ? "owner" : workspaceRole ?? "viewer";
  const RoleIcon = ROLE_BADGE[effectiveRole].icon;
  const scopeMeta = SCOPE_BADGE[scope];

  return (
    <Link
      to={`/projects/${p.id}`}
      className={cn(
        "block surface-card surface-card-hover px-3 py-2.5 border-l-4 group cursor-pointer",
        health.border,
      )}
    >
      <div className="flex items-center gap-3">
        {/* Bloque principal: nombre + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h3 className="font-semibold text-[13px] text-foreground group-hover:text-primary transition-sf truncate max-w-[260px]">
              {p.name}
            </h3>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded",
                scopeMeta.cls,
              )}
            >
              {scopeMeta.label}
            </span>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1",
                ROLE_BADGE[effectiveRole].cls,
              )}
            >
              <RoleIcon className="w-2.5 h-2.5" /> {ROLE_BADGE[effectiveRole].label}
            </span>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded",
                health.bg,
                health.color,
              )}
              title={health.description}
            >
              {health.emoji} {health.label}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {p.clients?.name ?? "Sin cliente"}
            {p.clients?.company ? <span> · {p.clients.company}</span> : null}
          </div>
        </div>

        {/* KPIs en línea */}
        <div className="hidden md:flex items-center gap-5 text-[11px] shrink-0">
          <KPI label="Avance" value={`${progressClamped}%`} />
          <KPI label="Presup." value={PEN.format(Number(p.budget))} />
          <KPI
            label="Gastado"
            value={PEN.format(Number(p.actual_cost))}
            valueClass={overBudget ? "text-cost-negative" : ""}
          />
          <KPI
            label={margin >= 0 ? "Rentab." : "Pérdida"}
            value={`${margin >= 0 ? "+" : ""}${PEN.format(margin)} (${marginPct}%)`}
            valueClass={margin >= 0 ? "text-cost-positive" : "text-cost-negative"}
          />
        </div>

        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-sf shrink-0" />
      </div>

      {/* KPIs en mobile (compactos en grid) */}
      <div className="grid grid-cols-4 gap-2 mt-2 text-[11px] md:hidden">
        <KPI label="Avance" value={`${progressClamped}%`} />
        <KPI label="Presup." value={PEN.format(Number(p.budget))} />
        <KPI
          label="Gastado"
          value={PEN.format(Number(p.actual_cost))}
          valueClass={overBudget ? "text-cost-negative" : ""}
        />
        <KPI
          label={margin >= 0 ? "Rentab." : "Pérdida"}
          value={`${margin >= 0 ? "+" : ""}${PEN.format(margin)}`}
          valueClass={margin >= 0 ? "text-cost-positive" : "text-cost-negative"}
        />
      </div>
    </Link>
  );
}

function KPI({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground text-[9px] uppercase tracking-wider">{label}</div>
      <div className={cn("font-mono-data font-semibold text-[12px] truncate", valueClass)}>
        {value}
      </div>
    </div>
  );
}
