/**
 * NoDataMetric — F8 (Métricas creíbles).
 *
 * Usar cuando una métrica no tiene datos suficientes para ser mostrada honestamente.
 * Reemplaza valores fake (0, "—", "N/A") con un mensaje contextual y, si aplica,
 * un CTA para que el usuario complete los datos faltantes.
 */
import { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface NoDataMetricProps {
  /** Etiqueta corta de la métrica (ej: "Ganancia real") */
  label?: string;
  /** Mensaje honesto sobre por qué no hay datos */
  message: string;
  /** CTA opcional para configurar lo faltante */
  hint?: string | ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function NoDataMetric({
  label,
  message,
  hint,
  size = "md",
  className,
}: NoDataMetricProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border/70 bg-muted/20",
        size === "sm" ? "p-2.5" : size === "lg" ? "p-5" : "p-3.5",
        className
      )}
    >
      {label && (
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          {label}
        </div>
      )}
      <div className="flex items-start gap-2">
        <Info
          className={cn(
            "text-muted-foreground shrink-0 mt-0.5",
            size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"
          )}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-muted-foreground leading-snug",
              size === "sm" ? "text-[12px]" : "text-[13px]"
            )}
          >
            {message}
          </p>
          {hint && (
            <div className="text-[11px] text-muted-foreground/80 mt-1 leading-snug">
              {hint}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
