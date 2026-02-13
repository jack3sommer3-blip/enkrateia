export default function Badge007({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
      role="img"
    >
      <defs>
        <linearGradient id="badge007Stroke" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
        </linearGradient>
      </defs>
      <circle
        cx="60"
        cy="60"
        r="52"
        fill="rgba(10,10,12,0.9)"
        stroke="url(#badge007Stroke)"
        strokeWidth="2"
      />
      <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(255,255,255,0.08)" />
      <g
        fill="none"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="40" cy="60" r="14" />
        <circle cx="70" cy="60" r="14" />
        <path d="M96 44 L84 60 L92 60 L80 76" />
        <path d="M84 60 L106 60" />
      </g>
    </svg>
  );
}
