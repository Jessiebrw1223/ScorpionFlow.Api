import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { humanizeError } from "@/lib/humanize-error";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Si cambia, se resetea el estado de error (útil al cambiar de ruta) */
  resetKey?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Política "Cero Pantalla Negra": cualquier error de render queda atrapado aquí
 * y se muestra un estado claro con botón de reintento. Nunca dejamos al usuario
 * frente a una pantalla en blanco.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Útil para debug en consola del usuario
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="surface-card p-8 max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold">Algo salió mal en esta vista</h2>
            <p className="text-[13px] text-muted-foreground">
              Encontramos un error inesperado al cargar este contenido. Tu información sigue segura.
            </p>
            {this.state.error && (
              <p className="text-[12px] text-muted-foreground/90 bg-muted/30 rounded px-3 py-2 mt-2">
                {humanizeError(this.state.error, "No pudimos cargar esta sección. Reintenta en unos segundos.")}
              </p>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button onClick={this.reset} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Reintentar
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <a href="/">
                <Home className="w-4 h-4" /> Ir al inicio
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
