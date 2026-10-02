/**
 * Money is stored and calculated in kobo (₦1 = 100 kobo) as integers.
 * Formatting is done by hand rather than with Intl so the server and the
 * browser always produce exactly the same string.
 */
export function formatNaira(kobo: number): string {
  const sign = kobo < 0 ? "-" : "";
  const abs = Math.abs(Math.round(kobo));
  const naira = Math.floor(abs / 100);
  const remainder = abs % 100;
  const whole = naira.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = remainder === 0 ? "" : `.${remainder.toString().padStart(2, "0")}`;
  return `${sign}₦${whole}${fraction}`;
}
