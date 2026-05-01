/**
 * Tipo de cambio USD → PEN (configurable centralizado).
 *
 * Estrategia: valor fijo editable. Sin dependencias externas, sin latencia.
 * Para actualizar, modificar la constante FX_USD_TO_PEN.
 *
 * Última actualización: 2026-04 (referencial).
 */
export const FX_USD_TO_PEN = 3.75;

/** Convierte un monto en USD a PEN (Soles). */
export function usdToPen(usd: number): number {
  return usd * FX_USD_TO_PEN;
}

/** Formato: "S/ 45" o "S/ 45.50" si decimal relevante. */
export function formatPEN(amount: number, options: { withDecimals?: boolean } = {}): string {
  const rounded = options.withDecimals ? amount : Math.round(amount);
  if (Number.isInteger(rounded)) return `S/ ${rounded}`;
  return `S/ ${rounded.toFixed(2)}`;
}

/** Formato: "$ 12" sin decimales si entero. */
export function formatUSD(amount: number): string {
  if (Number.isInteger(amount)) return `$ ${amount}`;
  return `$ ${amount.toFixed(2)}`;
}
