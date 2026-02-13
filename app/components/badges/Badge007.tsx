export default function Badge007({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
      role="img"
    >
      <circle
        cx="60"
        cy="60"
        r="50"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="2"
      />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="42" cy="60" r="12" />
        <circle cx="72" cy="60" r="12" />
        <path d="M92 48 H76 L88 48 L76 74" />
      </g>
    </svg>
  );
}
