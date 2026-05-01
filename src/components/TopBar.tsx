import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Home, Users, Eye, Shield, Crown, HelpCircle } from "lucide-react";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Link as RouterLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace, WORKSPACE_ROLE_LABEL } from "@/hooks/useWorkspace";
import { Badge } from "@/components/ui/badge";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Centro de Control",
  "/clientes": "Clientes",
  "/cotizaciones": "Cotizaciones",
  "/projects": "Proyectos",
  "/team": "Equipo",
  "/settings": "Configuración",
  "/learn": "Centro de Ayuda",
};

interface Crumb {
  label: string;
  to?: string;
}

/**
 * Bloque 7: Navegación consistente.
 * Construye breadcrumbs claros y predecibles a partir del pathname actual.
 * Para rutas tipo /projects/:id muestra: Inicio › Proyectos › <Nombre del proyecto>.
 */
function useBreadcrumbs(): Crumb[] {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  // Detecta /projects/:id para resolver el nombre del proyecto
  const isProjectWorkspace = segments[0] === "projects" && segments.length >= 2;
  const projectId = isProjectWorkspace ? segments[1] : null;

  const { data: project } = useQuery({
    queryKey: ["breadcrumb-project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .eq("id", projectId!)
        .maybeSingle();
      return data;
    },
  });

  if (location.pathname === "/") {
    return [{ label: ROUTE_TITLES["/"] }];
  }

  const crumbs: Crumb[] = [{ label: "Inicio", to: "/" }];

  if (isProjectWorkspace) {
    crumbs.push({ label: "Proyectos", to: "/projects" });
    crumbs.push({ label: project?.name || "Proyecto" });
    return crumbs;
  }

  const root = `/${segments[0]}`;
  crumbs.push({ label: ROUTE_TITLES[root] || segments[0] });
  return crumbs;
}

export function TopBar() {
  const crumbs = useBreadcrumbs();
  const { isGuest, role, ownerName } = useWorkspace();

  const RoleIcon =
    role === "owner" ? Crown
    : role === "admin" ? Shield
    : role === "viewer" ? Eye
    : Users;

  return (
    <div className="flex items-center justify-between mb-4 sticky top-0 z-30 -mx-6 px-6 py-3 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <div key={`${c.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />}
              {c.to && !isLast ? (
                <Link
                  to={c.to}
                  className="text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-sf font-semibold inline-flex items-center gap-1"
                >
                  {i === 0 && <Home className="w-3 h-3" />}
                  {c.label}
                </Link>
              ) : (
                <span className="text-[11px] uppercase tracking-widest text-foreground font-semibold truncate max-w-[40ch]">
                  {c.label}
                </span>
              )}
            </div>
          );
        })}
      </nav>
      <div className="flex items-center gap-2">
        {isGuest && role && (
          <Badge
            variant="outline"
            className="hidden sm:inline-flex items-center gap-1.5 border-primary/30 bg-primary/5 text-foreground text-[10px] uppercase tracking-wider font-semibold px-2 py-1"
            title={ownerName ? `Workspace de ${ownerName}` : undefined}
          >
            <RoleIcon className="w-3 h-3 text-primary" />
            {WORKSPACE_ROLE_LABEL[role]}
            {ownerName && (
              <span className="text-muted-foreground normal-case tracking-normal font-normal">
                · {ownerName}
              </span>
            )}
          </Badge>
        )}
        <RouterLink
          to="/learn"
          title="Centro de Ayuda"
          aria-label="Centro de Ayuda"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted/50 transition-sf"
        >
          <HelpCircle className="w-4 h-4" />
        </RouterLink>
        <NotificationsBell />
      </div>
    </div>
  );
}
