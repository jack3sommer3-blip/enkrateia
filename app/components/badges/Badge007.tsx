export default function Badge007({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 24"
      className={className}
      aria-hidden="true"
      role="img"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="14" cy="12" r="7" />
        <circle cx="32" cy="12" r="7" />
        <path d="M42 6 H58 L50 20" />
      </g>
    </svg>
  );
}
