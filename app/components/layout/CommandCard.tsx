export default function CommandCard({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "command-surface rounded-md p-6 transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(0,0,0,0.35)]",
        className ?? "",
      ].join(" ")}
    >
      {title ? (
        <div className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3">
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}
