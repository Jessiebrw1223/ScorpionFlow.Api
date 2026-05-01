import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Flame, CheckCircle2, AlertTriangle, Clock, LogIn, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { humanizeFunctionError } from "@/lib/humanize-error";

interface InvitationInfo {
  id: string;
  email: string;
  role: "admin" | "collaborator" | "viewer";
  status: "pending" | "accepted" | "rejected" | "cancelled" | "expired";
  expires_at: string;
  invited_by_name: string | null;
  owner_id: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin · Control total",
  collaborator: "Colaborador · Acceso operativo",
  viewer: "Visualizador · Solo lectura",
};

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [emailMatches, setEmailMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Cargar info de invitación cuando hay sesión
  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setError("Token no proporcionado");
      setLoading(false);
      return;
    }
    if (!user) {
      // Si no hay sesión, no podemos consultar la edge function (verify_jwt=true).
      // Mostramos pantalla de "inicia sesión" sin hacer fetch.
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: fnErr } = await supabase.functions.invoke(
        "accept-team-invitation",
        { body: { token, action: "lookup" } }
      );
      if (cancelled) return;
      if (fnErr || !data) {
        setError(
          humanizeFunctionError(
            fnErr,
            data,
            "No pudimos abrir esta invitación. Verifica el enlace e intenta de nuevo.",
          ),
        );
      } else if ((data as any).error) {
        setError(
          humanizeFunctionError(
            null,
            data,
            "Esta invitación no está disponible.",
          ),
        );
      } else {
        setInfo((data as any).invitation);
        setEmailMatches(!!(data as any).emailMatches);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [token, user, authLoading]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    const { data, error: fnErr } = await supabase.functions.invoke(
      "accept-team-invitation",
      { body: { token, action: "accept" } }
    );
    setAccepting(false);
    if (fnErr) {
      toast.error(
        humanizeFunctionError(
          fnErr,
          data,
          "No pudimos procesar la invitación. Intenta de nuevo.",
        ),
      );
      return;
    }
    if ((data as any)?.error) {
      toast.error(
        humanizeFunctionError(
          null,
          data,
          "Esta invitación ya no es válida.",
        ),
      );
      return;
    }
    // Marca bienvenida para que el Dashboard muestre el banner.
    try {
      const ownerName = info?.invited_by_name ?? "tu equipo";
      sessionStorage.setItem(
        "scorpion.justJoinedTeam",
        JSON.stringify({ ownerName, at: Date.now() }),
      );
    } catch {
      /* sessionStorage puede no estar disponible */
    }
    toast.success("¡Te uniste al equipo!");
    navigate("/", { replace: true });
  };

  // ---- Render ----
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl scorpion-gradient flex items-center justify-center fire-glow">
            <Flame className="w-6 h-6 text-primary-foreground fire-icon" />
          </div>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            ScorpionFlow
          </span>
        </div>

        {/* Loading */}
        {(authLoading || loading) && (
          <div className="surface-card p-8 text-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Cargando invitación…</p>
          </div>
        )}

        {/* Sin sesión */}
        {!authLoading && !loading && !user && (
          <div className="surface-card p-6 space-y-4">
            <h1 className="text-xl font-bold">Tienes una invitación</h1>
            <p className="text-sm text-muted-foreground">
              Para aceptar esta invitación, inicia sesión o crea una cuenta con el
              email al que llegó la invitación.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline">
                <Link
                  to="/auth/login"
                  state={{ from: { pathname: `/invite/${token}` } }}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Iniciar sesión
                </Link>
              </Button>
              <Button
                asChild
                className="scorpion-gradient text-primary-foreground border-0"
              >
                <Link
                  to="/auth/register"
                  state={{ from: { pathname: `/invite/${token}` } }}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Crear cuenta
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && user && error && (
          <div className="surface-card p-6 space-y-3 text-center">
            <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
            <h1 className="text-lg font-bold">No se pudo abrir la invitación</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button asChild variant="outline">
              <Link to="/">Ir al inicio</Link>
            </Button>
          </div>
        )}

        {/* Info cargada */}
        {!loading && user && info && !error && (
          <div className="surface-card p-6 space-y-4">
            <div className="space-y-1">
              <h1 className="text-xl font-bold">
                {info.invited_by_name
                  ? `${info.invited_by_name} te invitó a colaborar`
                  : "Te invitaron a colaborar"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Rol asignado:{" "}
                <span className="font-medium text-foreground">
                  {ROLE_LABEL[info.role]}
                </span>
              </p>
            </div>

            <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs space-y-1">
              <div>
                Invitación para:{" "}
                <span className="font-mono text-foreground">{info.email}</span>
              </div>
              <div className="text-muted-foreground">
                Expira:{" "}
                {new Date(info.expires_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>

            {info.status === "expired" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex gap-2">
                <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  Esta invitación ha expirado. Pide al administrador que te envíe
                  una nueva.
                </div>
              </div>
            )}

            {(info.status === "cancelled" ||
              info.status === "rejected" ||
              info.status === "accepted") && (
              <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                {info.status === "accepted"
                  ? "Esta invitación ya fue aceptada."
                  : "Esta invitación ya no está disponible."}
              </div>
            )}

            {info.status === "pending" && !emailMatches && (
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-600 dark:text-orange-400 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  Estás conectado con otra cuenta. Esta invitación es para{" "}
                  <strong>{info.email}</strong>. Cierra sesión e inicia con esa
                  cuenta para aceptarla.
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button asChild variant="outline">
                <Link to="/">Cancelar</Link>
              </Button>
              {info.status === "pending" && emailMatches && (
                <Button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="scorpion-gradient text-primary-foreground border-0"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uniéndote…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Aceptar invitación
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
