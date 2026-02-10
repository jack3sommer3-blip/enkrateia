export default function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 border-b border-white/10">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={[
            "relative pb-3 text-sm uppercase tracking-[0.2em] transition-colors",
            active === tab ? "text-white" : "text-gray-500 hover:text-white",
          ].join(" ")}
        >
          {tab}
          <span
            className={[
              "absolute left-0 right-0 -bottom-0.5 h-0.5 transition-all",
              active === tab ? "accent-underline" : "bg-transparent",
            ].join(" ")}
          />
        </button>
      ))}
    </div>
  );
}
