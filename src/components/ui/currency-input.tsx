import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useUserSettings } from "@/hooks/useUserSettings";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number;
  onValueChange: (val: number) => void;
  currency?: string;          // PEN, USD, EUR — si no se pasa, usa el setting global del usuario
  locale?: string;            // se infiere por moneda si no se pasa
  min?: number;
  max?: number;
  error?: string | null;
  showSymbol?: boolean;       // muestra "S/" delante
}

const SYMBOL_MAP: Record<string, string> = {
  PEN: "S/",
  USD: "$",
  EUR: "€",
};

const LOCALE_MAP: Record<string, string> = {
  PEN: "es-PE",
  USD: "en-US",
  EUR: "es-ES",
};

/**
 * Input monetario reutilizable:
 * - Solo acepta números (y un punto decimal)
 * - Formatea en vivo: 1200 → "S/ 1,200.00" cuando pierde el foco
 * - Muestra error claro si el valor no es válido
 * - Sin ceros a la izquierda, sin texto
 * - Por defecto respeta la moneda configurada en Configuración → Trabajo
 */
export function CurrencyInput({
  value,
  onValueChange,
  currency,
  locale,
  min = 0,
  max,
  error,
  showSymbol = true,
  className,
  onFocus,
  onBlur,
  ...rest
}: CurrencyInputProps) {
  const { settings } = useUserSettings();
  const effectiveCurrency = currency || settings.currency;
  const effectiveLocale = locale || LOCALE_MAP[effectiveCurrency] || "es-PE";
  const symbol = SYMBOL_MAP[effectiveCurrency] || effectiveCurrency;
  const formatter = React.useMemo(
    () => new Intl.NumberFormat(effectiveLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [effectiveLocale]
  );

  const [focused, setFocused] = React.useState(false);
  const [raw, setRaw] = React.useState<string>(() =>
    Number.isFinite(value) && value !== 0 ? String(value) : ""
  );
  const [internalError, setInternalError] = React.useState<string | null>(null);

  // Sincroniza si el valor externo cambia mientras NO estamos editando
  React.useEffect(() => {
    if (!focused) {
      setRaw(Number.isFinite(value) && value !== 0 ? String(value) : "");
    }
  }, [value, focused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Permitir vacío
    if (input === "") {
      setRaw("");
      setInternalError(null);
      onValueChange(0);
      return;
    }
    // Quitar todo lo que no sea dígito o punto
    const cleaned = input.replace(/[^\d.]/g, "");
    // Solo un punto decimal
    const parts = cleaned.split(".");
    const normalized = parts.length > 2
      ? `${parts[0]}.${parts.slice(1).join("")}`
      : cleaned;
    // Quitar ceros a la izquierda (pero permitir "0." )
    const noLeadingZeros = normalized.replace(/^0+(?=\d)/, "");
    setRaw(noLeadingZeros);

    const num = Number(noLeadingZeros);
    if (!Number.isFinite(num)) {
      setInternalError("Ingrese un monto válido");
      return;
    }
    if (num < min) {
      setInternalError(`Debe ser al menos ${formatter.format(min)}`);
    } else if (max !== undefined && num > max) {
      setInternalError(`Máximo permitido: ${formatter.format(max)}`);
    } else {
      setInternalError(null);
    }
    onValueChange(num);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    // Al salir, normaliza el raw a número limpio (sin formato — el formato lo aporta el placeholder visual)
    const num = Number(raw);
    if (raw !== "" && Number.isFinite(num)) {
      setRaw(String(num));
    }
    onBlur?.(e);
  };

  const displayed = focused
    ? raw
    : raw === ""
      ? ""
      : formatter.format(Number(raw) || 0);

  const showError = error || internalError;

  return (
    <div className="space-y-1">
      <div className="relative">
        {showSymbol && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-mono-data text-muted-foreground pointer-events-none">
            {symbol}
          </span>
        )}
        <Input
          {...rest}
          inputMode="decimal"
          value={displayed}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={focused ? "0" : `${symbol} 0.00`}
          className={cn(
            "font-mono-data",
            showSymbol && "pl-8",
            showError && "border-destructive focus-visible:ring-destructive",
            className
          )}
        />
      </div>
      {showError && (
        <p className="text-[11px] text-destructive font-medium">{showError}</p>
      )}
    </div>
  );
}
