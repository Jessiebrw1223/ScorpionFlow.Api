import { useState, useCallback } from "react";
import { usePlan, type PremiumFeature, type PlanId } from "@/hooks/usePlan";

/**
 * Hook centralizado para gating premium.
 *
 * Devuelve:
 * - `locked(feature)`: boolean — true si el usuario actual NO puede acceder a esa feature
 * - `requestAccess(feature)`: si está bloqueado, abre el modal de upsell con esa feature.
 *   Si tiene acceso, ejecuta el callback opcional `onAllowed`.
 * - `dialog`: estado del modal (open + feature actual) listo para pasar a <UpsellDialog />
 *
 * Patrón de uso:
 *
 *   const gate = usePremiumGate();
 *   <button onClick={() => gate.requestAccess("resources_management", () => navigate(...))}>
 *     Recursos
 *   </button>
 *   <UpsellDialog open={gate.dialog.open} onOpenChange={gate.close} feature={gate.dialog.feature} />
 */
export function usePremiumGate() {
  const { canAccess, loading, plan } = usePlan();
  const [dialog, setDialog] = useState<{ open: boolean; feature?: PremiumFeature }>({
    open: false,
  });

  const locked = useCallback(
    (feature: PremiumFeature) => {
      if (loading) return false; // mientras carga, no bloqueamos para evitar parpadeos
      return !canAccess(feature);
    },
    [canAccess, loading]
  );

  const requestAccess = useCallback(
    (feature: PremiumFeature, onAllowed?: () => void) => {
      if (loading) return; // ignora clicks durante hidratación
      if (canAccess(feature)) {
        onAllowed?.();
      } else {
        setDialog({ open: true, feature });
      }
    },
    [canAccess, loading]
  );

  const open = useCallback(
    (feature: PremiumFeature) => setDialog({ open: true, feature }),
    []
  );

  const close = useCallback(
    (next: boolean) => setDialog((d) => ({ ...d, open: next })),
    []
  );

  return {
    plan,
    loading,
    locked,
    requestAccess,
    open,
    close,
    dialog,
  };
}

export type { PremiumFeature, PlanId };
