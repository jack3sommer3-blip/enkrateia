"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/profile";
import type { Profile } from "@/lib/types";
import { addDays, startOfDay, toDateKey } from "@/lib/utils";

function buildCalendar(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const start = addDays(first, -startWeekday);
  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    days.push(addDays(start, i));
  }
  return days;
}

type LogRow = {
  date: string;
  total_score: number;
};

export default function LogsPage() {
  const router = useRouter();
  const { loading, userId } = useSession();
  const [profile, setProfile] = useState<Profile | undefined>();
  const [profileLoading, setProfileLoading] = useState(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      router.replace("/login");
      return;
    }
    setProfileLoading(true);
    getProfile(userId).then((data) => {
      setProfile(data);
      setProfileLoading(false);
      if (!data) router.replace("/onboarding");
    });
  }, [loading, router, userId]);

  useEffect(() => {
    if (!userId) return;
    setLogsLoading(true);
    const base = new Date();
    const target = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
    const start = startOfDay(new Date(target.getFullYear(), target.getMonth(), 1));
    const end = startOfDay(new Date(target.getFullYear(), target.getMonth() + 1, 0));
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);

    supabase
      .from("daily_logs")
      .select("date,total_score")
      .eq("user_id", userId)
      .gte("date", startKey)
      .lte("date", endKey)
      .order("date", { ascending: true })
      .then(({ data }) => {
        const rows = (data ?? []).map((row) => ({
          date: row.date,
          total_score: Number(row.total_score ?? 0),
        })) as LogRow[];
        setLogs(rows);
        setLogsLoading(false);
      });
  }, [monthOffset, userId]);

  const logMap = useMemo(() => {
    const map = new Map<string, LogRow>();
    logs.forEach((row) => map.set(row.date, row));
    return map;
  }, [logs]);

  if (loading || profileLoading) {
    return <StoryLoading name={profile?.first_name} />;
  }

  if (!userId || !profile) return null;

  const base = new Date();
  const target = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const calendarDays = buildCalendar(target.getFullYear(), target.getMonth());

  return (
    <main className="min-h-screen text-white flex flex-col items-center p-8">
      <div className="w-full max-w-6xl pt-4">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.4em] text-gray-500">Logs</div>
            <div className="text-lg font-semibold text-white">
              {target.toLocaleString("default", { month: "short", year: "numeric" }).toUpperCase()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonthOffset((prev) => prev - 1)}
              className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 text-xs uppercase tracking-[0.2em] text-gray-300"
            >
              Previous
            </button>
            <button
              onClick={() => setMonthOffset((prev) => prev + 1)}
              className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 text-xs uppercase tracking-[0.2em] text-gray-300"
            >
              Next
            </button>
          </div>
        </header>

        <section className="rounded-md border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.04),_transparent_70%)] p-4">
          <div className="grid grid-cols-7 text-[11px] uppercase tracking-[0.25em] text-gray-500 mb-3">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="px-2 py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((date) => {
              const key = toDateKey(date);
              const row = logMap.get(key);
              const inMonth = date.getMonth() === target.getMonth();
              const isToday = key === toDateKey(new Date());
              return (
                <Link
                  key={key}
                  href={`/day/${key}`}
                  className={[
                    "relative h-[96px] rounded-md border transition",
                    "bg-[#0b1220]/70",
                    inMonth ? "border-white/10" : "border-white/5 opacity-50",
                    row ? "hover:border-[color:var(--accent-60)]" : "hover:border-white/20",
                    isToday ? "border-[color:var(--accent-60)] shadow-[0_0_12px_rgba(31,122,79,0.35)]" : "",
                  ].join(" ")}
                >
                  <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:80px_80px] opacity-20" />
                  <div className="relative h-full p-2 flex flex-col justify-between">
                    <div className="text-xs text-gray-500">{date.getDate()}</div>
                    {row ? (
                      <div className="text-right">
                        <div className="text-2xl font-semibold text-white">
                          {row.total_score.toFixed(0)}
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                          /100
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-700">
                        No log
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {logsLoading ? <div className="text-gray-500 mt-4">Loading month…</div> : null}
        </section>
      </div>
    </main>
  );
}
