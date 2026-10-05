/**
 * Prices are whole kobo (₦1 = 100 kobo), as everywhere in the shop. Formatted
 * by hand, exactly like the website, so both show the same string.
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

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
