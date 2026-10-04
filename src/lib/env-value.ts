/**
 * Hosting dashboards (Netlify, Vercel) store a value exactly as it was pasted,
 * so a line copied from a .env file can arrive wrapped in quotes. Trim spaces
 * and one pair of matching surrounding quotes, and treat empty as unset.
 */
export function cleanEnvValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  let v = value.trim();
  const first = v[0];
  if (v.length >= 2 && (first === '"' || first === "'") && v[v.length - 1] === first) {
    v = v.slice(1, -1).trim();
  }
  return v === "" ? undefined : v;
}
