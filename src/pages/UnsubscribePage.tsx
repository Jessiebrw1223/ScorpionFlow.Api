import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Flame, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

type State = "loading" | "valid" | "already" | "invalid" | "success" | "error";

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/email-unsubscribe?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (!res.ok) {
          setState("invalid");
          return;
        }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setState("already");
        } else if (data.valid) {
          setState("valid");
        } else {
          setState("invalid");
        }
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_URL}/api/email-unsubscribe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }
      );
      const data = await res.json();
      if (data.success) setState("success");
      else if (data.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl scorpion-gradient flex items-center justify-center fire-glow">
            <Flame className="w-6 h-6 text-primary-foreground fire-icon" />
          </div>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            ScorpionFlow
          </span>
        </div>

        <div className="surface-card p-6 space-y-4 text-center">
          {state === "loading" && (
            <>
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Validando enlace…</p>
            </>
          )}

          {state === "valid" && (
            <>
              <h1 className="text-xl font-bold">¿Darte de baja?</h1>
              <p className="text-sm text-muted-foreground">
                Dejarás de recibir correos de ScorpionFlow en esta dirección.
              </p>
              <Button
                onClick={handleConfirm}
                disabled={submitting}
                className="scorpion-gradient text-primary-foreground border-0 w-full"
              >
                {submitting ? "Procesando…" : "Confirmar baja"}
              </Button>
            </>
          )}

          {state === "success" && (
            <>
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
              <h1 className="text-xl font-bold">Te diste de baja</h1>
              <p className="text-sm text-muted-foreground">
                No volverás a recibir correos en esta dirección.
              </p>
              <Button asChild variant="outline">
                <Link to="/">Ir al inicio</Link>
              </Button>
            </>
          )}

          {state === "already" && (
            <>
              <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto" />
              <h1 className="text-xl font-bold">Ya estabas dado de baja</h1>
              <p className="text-sm text-muted-foreground">
                Esta dirección ya no recibe correos nuestros.
              </p>
              <Button asChild variant="outline">
                <Link to="/">Ir al inicio</Link>
              </Button>
            </>
          )}

          {state === "invalid" && (
            <>
              <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
              <h1 className="text-xl font-bold">Enlace inválido</h1>
              <p className="text-sm text-muted-foreground">
                Este enlace no es válido o ha expirado.
              </p>
              <Button asChild variant="outline">
                <Link to="/">Ir al inicio</Link>
              </Button>
            </>
          )}

          {state === "error" && (
            <>
              <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
              <h1 className="text-xl font-bold">Algo falló</h1>
              <p className="text-sm text-muted-foreground">
                No pudimos procesar la solicitud. Intenta nuevamente.
              </p>
              <Button onClick={handleConfirm} disabled={submitting}>
                Reintentar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
