// Crockford's base32 alphabet: no I, L, O or U, so references survive being
// read out over the phone or copied into a bank transfer narration.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A short, human-friendly order reference such as "IA-7K3M9Q". */
export function generateOrderReference(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % 32];
  return `IA-${out}`;
}

export function isOrderReference(value: unknown): value is string {
  return typeof value === "string" && /^IA-[0-9A-HJKMNP-TV-Z]{6}$/.test(value);
}
