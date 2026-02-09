export function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function numFromText(value?: string): number | undefined {
  if (value === undefined) return undefined;
  const t = value.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

export function intFromText(value?: string): number | undefined {
  const n = numFromText(value);
  if (n === undefined) return undefined;
  return Math.trunc(n);
}

export function formatScore(n: number) {
  if (!Number.isFinite(n)) return "0";
  const fixed = n.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

export function normalizeIntText(
  value?: string,
  min?: number,
  max?: number
): string | undefined {
  const n = intFromText(value);
  if (n === undefined) return undefined;
  let v = n;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return String(v);
}

export function textFromUnknown(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value;
  return undefined;
}

export function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function toDateKey(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, count: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + count);
  return d;
}
