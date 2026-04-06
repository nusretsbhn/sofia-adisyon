export function formatTry(kurus) {
  if (kurus == null || Number.isNaN(kurus)) return "—";
  return `${(kurus / 100).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;
}
