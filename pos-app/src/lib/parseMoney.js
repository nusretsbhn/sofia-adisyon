/** "12,50" veya "12.5" → kuruş (integer) */
export function tryToKurus(s) {
  if (s == null || String(s).trim() === "") return null;
  const n = parseFloat(String(s).replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
