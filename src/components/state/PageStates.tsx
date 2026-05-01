/**
 * Componentes de estado reutilizables para todas las páginas.
 * Garantizan una experiencia visual consistente, calmada y profesional
 * cuando los datos están cargando, vacíos o han fallado.
 */
import { ReactNode } from "react";
import { Loader2, AlertTriangle, Inbox, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { humanizeError } from "@/lib/humanize-error";

interface PageLoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function PageLoadingState({
  title = "Cargando…",
  description,
  className,
}: PageLoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-center animate-in fade-in duration-300",
        className
      )}
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" />
        <Loader2 className="relative w-7 h-7 text-primary animate-spin" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

interface PageEmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PageEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: PageEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 px-4 text-center animate-in fade-in duration-300",
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-muted/40 border border-border flex items-center justify-center">
        {icon ?? <Inbox className="w-6 h-6 text-muted-foreground" />}
      </div>
      <div className="space-y-1 max-w-md">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface PageErrorStateProps {
  error?: unknown;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function PageErrorState({
  error,
  title = "No pudimos cargar esta sección",
  description,
  onRetry,
  retryLabel = "Reintentar",
  className,
}: PageErrorStateProps) {
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const message = description ?? (error ? humanizeError(error) : undefined);
  const Icon = isOffline ? WifiOff : AlertTriangle;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 px-4 text-center animate-in fade-in duration-300",
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
        <Icon className="w-6 h-6 text-destructive" />
      </div>
      <div className="space-y-1 max-w-md">
        <p className="text-sm font-semibold text-foreground">
          {isOffline ? "Sin conexión a internet" : title}
        </p>
        {message && (
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            {isOffline
              ? "Verifica tu conexión y vuelve a intentarlo."
              : message}
          </p>
        )}
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-2 gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

interface InlineErrorNoticeProps {
  error?: unknown;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function InlineErrorNotice({
  error,
  message,
  onRetry,
  className,
}: InlineErrorNoticeProps) {
  const text = message ?? (error ? humanizeError(error) : "Algo salió mal");
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-[13px]",
        className
      )}
    >
      <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-foreground/90 leading-snug">{text}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 text-xs text-primary hover:underline font-medium"
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}
