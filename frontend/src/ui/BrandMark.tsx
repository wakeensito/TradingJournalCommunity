/** The logo mark: a four-tick session tape in the brand gradient. The only place (besides + Log) the gradient appears. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="bm-g" gradientUnits="userSpaceOnUse" x1="12" y1="16" x2="52" y2="44">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset=".55" stopColor="#06b6d4" />
          <stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="62" height="62" rx="14" fill="var(--surface-1)" stroke="var(--line-strong)" />
      <path d="M12 34h40" stroke="var(--ink-4)" strokeWidth="1.5" />
      <g stroke="url(#bm-g)" strokeWidth="5" strokeLinecap="round">
        <path d="M19 34v-9" />
        <path d="M27 34v6" />
        <path d="M35 34v-15" />
        <path d="M43 34v-6" />
      </g>
    </svg>
  );
}
