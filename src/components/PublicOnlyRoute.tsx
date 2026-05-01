import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Flame } from "lucide-react";

/**
 * Envuelve rutas públicas (login/register/forgot/reset).
 * Si el usuario YA está autenticado, lo manda al destino solicitado
 * (state.from) o al dashboard. Esto evita pantallas en negro al
 * recargar /auth/* con sesión activa, y deja que LoginPage haga
 * la redirección final cuando el login se completa desde la propia página.
 */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl scorpion-gradient flex items-center justify-center fire-glow">
            <Flame className="w-6 h-6 text-primary-foreground fire-icon" />
          </div>
          <span className="text-xs text-muted-foreground uppercase tracking-widest">
            Cargando…
          </span>
        </div>
      </div>
    );
  }

  if (user) {
    const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
    return <Navigate to={from && !from.startsWith("/auth") ? from : "/"} replace />;
  }

  return <>{children}</>;
}
