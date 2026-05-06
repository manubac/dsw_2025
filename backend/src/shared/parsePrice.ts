/**
 * Parsea un string de precio en cualquier formato numérico:
 * - Anglosajón (USD): "$4.99", "$12,500.75"
 * - Europeo/LatAm: "$ 6.238" (ARS sin decimales), "$ 6.237,50", "R$ 25,00", "€ 4,99"
 *
 * Regla: si la última coma aparece DESPUÉS del último punto → coma es decimal.
 * En caso contrario → punto es decimal (o no hay decimal).
 */
export function parsePrice(priceStr: string | null | undefined): number {
  if (!priceStr) return 0;
  const s = priceStr.replace(/[^0-9.,]/g, '');
  if (!s) return 0;

  const lastComma = s.lastIndexOf(',');
  const lastDot   = s.lastIndexOf('.');

  if (lastComma > lastDot) {
    // Formato europeo/LatAm: "6.238" → quitar puntos de miles, coma → punto decimal
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }

  // Formato anglosajón o sin separador decimal: quitar comas de miles
  return parseFloat(s.replace(/,/g, '')) || 0;
}
