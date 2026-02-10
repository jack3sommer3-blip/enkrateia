export default function MetricCard({
  label,
  value,
  delta,
  positive,
}: {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
}) {
  return (
    <div className="command-surface rounded-md p-6">
      <div className="text-xs uppercase tracking-[0.3em] text-gray-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      {delta ? (
        <div className="mt-2 text-sm">
          <span className={positive ? "text-emerald-400" : "text-red-400"}>
            {delta}
          </span>
          <span className="text-gray-500"> from last week</span>
        </div>
      ) : null}
    </div>
  );
}
