/**
 * Muestra un precio para el usuario final.
 * - Si existe priceStr (string crudo de la DB), lo devuelve directo — ya tiene el símbolo y el formato correcto.
 * - Si no, formatea el número con el locale del navegador (sin símbolo de moneda).
 */
export function fmtPrice(numericPrice: number | null | undefined, priceStr?: string | null): string {
  if (priceStr) return priceStr;
  if (numericPrice == null || isNaN(numericPrice)) return '—';
  return new Intl.NumberFormat(navigator.language, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericPrice);
}
