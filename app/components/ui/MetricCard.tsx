export default function MetricCard({
  label,
  value,
  delta,
  positive,
  subtext,
  deltaLabel = "from prior period",
}: {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  subtext?: string;
  deltaLabel?: string;
}) {
  return (
    <div className="command-surface rounded-md p-6 transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
      <div className="text-xs uppercase tracking-[0.3em] text-gray-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      {delta ? (
        <div className="mt-2 text-sm">
          <span
            className={positive ? "text-[color:var(--accent)]" : "text-red-400"}
          >
            {delta}
          </span>
          <span className="text-gray-500"> {deltaLabel}</span>
        </div>
      ) : subtext ? (
        <div className="mt-2 text-sm text-gray-500">{subtext}</div>
      ) : null}
    </div>
  );
}
