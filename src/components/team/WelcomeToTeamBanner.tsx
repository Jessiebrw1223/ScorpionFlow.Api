import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "scorpion.justJoinedTeam";

interface Payload {
  ownerName: string;
  at: number;
}

/**
 * Banner que aparece una sola vez tras aceptar una invitación a un workspace.
 * Lee el flag de sessionStorage que setea InviteAcceptPage y se borra al cerrar.
 */
export function WelcomeToTeamBanner() {
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Payload;
      // Mostrar solo si el flag es reciente (<10min)
      if (Date.now() - parsed.at < 10 * 60 * 1000) {
        setPayload(parsed);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* noop */
    }
  }, []);

  const dismiss = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setPayload(null);
  };

  if (!payload) return null;

  return (
    <div className="relative rounded-xl border border-primary/30 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-4 mb-4 fire-glow">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg scorpion-gradient flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">
            Has sido añadido al equipo de{" "}
            <span className="text-primary">{payload.ownerName}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ya puedes ver los proyectos, clientes y cotizaciones del workspace según tu
            rol. Tus permisos definen qué puedes editar.
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={dismiss}
          aria-label="Cerrar bienvenida"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
