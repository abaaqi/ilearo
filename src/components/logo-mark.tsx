/** A single tied oniko "moon": the mark that sits beside the wordmark. */
export function LogoMark({ className }: { className?: string }) {
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const x1 = 16 + Math.cos(a) * 6.2;
    const y1 = 16 + Math.sin(a) * 6.2;
    const x2 = 16 + Math.cos(a) * 11.2;
    const y2 = 16 + Math.sin(a) * 11.2;
    return `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }).join("");
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="14" fill="currentColor" />
      <circle cx="16" cy="16" r="12.4" fill="none" stroke="var(--color-starch)" strokeWidth="1.8" />
      <path d={rays} stroke="var(--color-starch)" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="4.2" fill="var(--color-starch)" />
      <circle cx="16" cy="16" r="1.4" fill="currentColor" />
    </svg>
  );
}
