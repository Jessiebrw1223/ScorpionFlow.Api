import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  ChevronLeft,
  ChevronRight,
  Settings,
  Flame,
  LogOut,
  Receipt,
  Contact2,
  Users,
  FileBarChart2,
  Building2,
  ShieldAlert,
  Lock,
  HelpCircle,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { usePremiumGate, type PremiumFeature } from "@/hooks/usePremiumGate";
import { UpsellDialog } from "@/components/billing/UpsellDialog";
import { useWorkspace, type WorkspaceRole } from "@/hooks/useWorkspace";
import { usePlan } from "@/hooks/usePlan";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  group?: string;
  /** Si está definido, el item requiere esa feature; si el usuario no tiene acceso, abre el upsell. */
  feature?: PremiumFeature;
  /** Roles que pueden ver este item. Si no se define, lo ven todos. */
  visibleFor?: WorkspaceRole[];
  /** Si es true, el item solo se muestra cuando el plan es Business. */
  businessOnly?: boolean;
}

// Acceso comercial / financiero solo para owner y admin del workspace.
// Colaboradores y visualizadores no ven Clientes ni Cotizaciones globales.
const ADMIN_ONLY: WorkspaceRole[] = ["owner", "admin"];

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/", group: "Visión" },
  { label: "Clientes", icon: Contact2, path: "/clientes", group: "Comercial", visibleFor: ADMIN_ONLY },
  { label: "Cotizaciones", icon: Receipt, path: "/cotizaciones", group: "Comercial", visibleFor: ADMIN_ONLY },
  { label: "Proyectos", icon: FolderKanban, path: "/projects", group: "Ejecución" },
  { label: "Equipo", icon: Users, path: "/team", group: "Ejecución" },
  // Finanzas empresariales: solo plan Business y solo owner/admin.
  // En Pro, recursos/costos/informe siguen disponibles dentro del workspace del proyecto.
  // Centro Financiero Corporativo = visión global de empresa, NO entra a un proyecto.
  { label: "Resumen Ejecutivo", icon: Building2, path: "/finanzas", group: "Finanzas empresariales", feature: "executive_dashboard", visibleFor: ADMIN_ONLY, businessOnly: true },
  { label: "Recursos", icon: Users, path: "/resources", group: "Finanzas empresariales", feature: "resources_management", visibleFor: ADMIN_ONLY, businessOnly: true },
  { label: "Informes", icon: FileBarChart2, path: "/reports", group: "Finanzas empresariales", feature: "advanced_reports", visibleFor: ADMIN_ONLY, businessOnly: true },
  { label: "Riesgos", icon: ShieldAlert, path: "/riesgos", group: "Finanzas empresariales", feature: "executive_dashboard", visibleFor: ADMIN_ONLY, businessOnly: true },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const gate = usePremiumGate();
  const { role } = useWorkspace();
  const { isBusiness } = usePlan();
  const { isSuperadmin } = useIsSuperadmin();

  const handleLogout = async () => {
    await signOut();
    toast.success("Sesión cerrada");
    navigate("/", { replace: true });
  };

  // Filtrar nav items según rol del workspace activo y plan.
  // Las "Finanzas empresariales" (Recursos/Costos/Informes globales) solo
  // aparecen en plan Business. En Pro siguen vivas dentro del proyecto.
  const visibleNavItems = navItems.filter((it) => {
    if (it.visibleFor && (!role || !it.visibleFor.includes(role))) return false;
    if (it.businessOnly && !isBusiness) return false;
    return true;
  });

  const groups = visibleNavItems.reduce<Record<string, NavItem[]>>((acc, it) => {
    const g = it.group || "General";
    (acc[g] = acc[g] || []).push(it);
    return acc;
  }, {});

  const userInitial = (user?.user_metadata?.full_name || user?.email || "?").charAt(0).toUpperCase();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuario";

  return (
    <>
      <aside
        className={cn(
          "fixed top-0 left-0 h-screen bg-sidebar flex flex-col z-50 transition-sf border-r border-sidebar-border",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-sidebar-border relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 pointer-events-none" />
          <div className="w-8 h-8 rounded-lg scorpion-gradient flex items-center justify-center shrink-0 shadow-lg fire-glow relative z-10">
            <Flame className="w-4 h-4 text-primary-foreground fire-icon" />
          </div>
          {!collapsed && (
            <div className="flex flex-col relative z-10">
              <span className="font-bold text-sm tracking-wide truncate fire-text">ScorpionFlow</span>
              <span className="text-[10px] text-sidebar-muted tracking-widest uppercase">
                Project Control
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-3 overflow-y-auto">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className="space-y-0.5">
              {!collapsed && (
                <div className="px-3 pb-1 text-[9px] uppercase tracking-[0.2em] text-sidebar-muted/60 font-semibold">
                  {group}
                </div>
              )}
              {items.map((item) => {
                const isActive =
                  item.path === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.path);
                const isLocked = item.feature ? gate.locked(item.feature) : false;

                const baseClasses = cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-sf group relative overflow-hidden w-full",
                  isActive && !isLocked
                    ? "bg-sidebar-accent text-primary font-medium fire-glow"
                    : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                );

                const inner = (
                  <>
                    {isActive && !isLocked && (
                      <>
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary shadow-[0_0_8px_hsl(15_90%_55%)]" />
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
                      </>
                    )}
                    <item.icon
                      className={cn(
                        "w-4 h-4 shrink-0 transition-all",
                        isActive && !isLocked
                          ? "text-primary fire-icon"
                          : "group-hover:text-primary group-hover:drop-shadow-[0_0_6px_hsl(15_90%_55%)]"
                      )}
                    />
                    {!collapsed && (
                      <span className="truncate relative z-10 flex-1 text-left">{item.label}</span>
                    )}
                    {isLocked && !collapsed && (
                      <Lock className="w-3 h-3 shrink-0 text-primary/70" aria-label="Premium" />
                    )}
                    {isLocked && collapsed && (
                      <Lock className="absolute top-1 right-1 w-2.5 h-2.5 text-primary/80" aria-label="Premium" />
                    )}
                  </>
                );

                if (isLocked && item.feature) {
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => gate.requestAccess(item.feature!)}
                      className={baseClasses}
                      title={`${item.label} · Requiere plan superior`}
                    >
                      {inner}
                    </button>
                  );
                }

                return (
                  <NavLink key={item.path} to={item.path} className={baseClasses}>
                    {inner}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User card */}
        {!collapsed && user && (
          <div className="px-2 pb-2">
            <div className="px-3 py-2 rounded-lg bg-sidebar-accent/40 flex items-center gap-2.5 border border-sidebar-border">
              <div className="w-8 h-8 rounded-full scorpion-gradient flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0 fire-glow">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-sidebar-foreground truncate">
                  {displayName}
                </div>
                <div className="text-[10px] text-sidebar-muted truncate">{user.email}</div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-2 py-2 border-t border-sidebar-border space-y-0.5">
          {isSuperadmin && (
            <NavLink
              to="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-sf",
                location.pathname.startsWith("/admin")
                  ? "bg-orange-950/40 text-orange-300 border border-orange-900/40"
                  : "text-orange-400/80 hover:text-orange-300 hover:bg-orange-950/30"
              )}
            >
              <Shield className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Admin Console</span>}
            </NavLink>
          )}
          <NavLink
            to="/settings"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-sf",
              location.pathname === "/settings"
                ? "bg-sidebar-accent text-primary"
                : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Configuración</span>}
          </NavLink>
          <NavLink
            to="/learn"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-sf",
              location.pathname.startsWith("/learn")
                ? "bg-sidebar-accent text-primary"
                : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}
          >
            <HelpCircle className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Centro de Ayuda</span>}
          </NavLink>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-sidebar-muted hover:text-destructive hover:bg-destructive/10 transition-sf w-full"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-sf w-full"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span>Contraer</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <UpsellDialog
        open={gate.dialog.open}
        onOpenChange={gate.close}
        feature={gate.dialog.feature}
      />
    </>
  );
}
