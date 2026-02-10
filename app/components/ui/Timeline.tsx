export default function Timeline({
  items,
}: {
  items: { date: string; score: number }[];
}) {
  return (
    <div className="command-surface rounded-md">
      <div className="border-b border-white/10 px-6 py-4 text-xs uppercase tracking-[0.3em] text-gray-500">
        Recent Days
      </div>
      <div className="divide-y divide-white/5">
        {items.map((item) => (
          <div
            key={item.date}
            className="group flex items-center justify-between px-6 py-4 transition-colors hover:bg-white/5"
          >
            <div className="text-sm text-gray-300">{item.date}</div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-white">{item.score.toFixed(1)}</div>
              <div className="h-1 w-24 bg-white/5">
                <div
                  className="h-1 bg-emerald-500/70"
                  style={{ width: `${Math.min(100, item.score)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
