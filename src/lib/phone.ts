/**
 * Accepts the ways people usually type a Nigerian mobile number
 * ("0803 123 4567", "+234 803 123 4567", "234-803-123-4567") and returns it
 * in international format (+2348031234567), or null if it isn't one.
 */
export function normalizeNigerianPhone(input: string): string | null {
  const compact = input.replace(/[\s().-]/g, "");
  const match = /^(?:\+?234|0)([789][01]\d{8})$/.exec(compact);
  return match ? `+234${match[1]}` : null;
}

/** +2348031234567 → 0803 123 4567, the way Nigerians write it. */
export function formatNigerianPhone(international: string): string {
  const match = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(international);
  return match ? `0${match[1]} ${match[2]} ${match[3]}` : international;
}
