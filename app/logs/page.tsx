"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DailyLog from "@/app/components/DailyLog";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/profile";
import type { Profile } from "@/lib/types";
import { addDays, startOfDay, toDateKey, todayKey } from "@/lib/utils";

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

  const recentLogs = useMemo(() => {
    const sorted = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1));
    return sorted.slice(0, 8);
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
      <div className="w-full max-w-6xl pt-10">
        <header className="mb-10">
          <div className="text-xs uppercase tracking-[0.3em] text-gray-500">Logs</div>
          <h1 className="mt-3 text-4xl md:text-5xl font-bold leading-tight">Logs</h1>
          <p className="mt-2 text-sm text-gray-400">Today, history, and recent entries.</p>
        </header>

        <section className="command-surface rounded-md p-6">
          <div className="text-sm uppercase tracking-[0.3em] text-gray-500">Today’s Log</div>
          <div className="mt-4">
            <DailyLog dateKey={todayKey()} userId={userId} title={`Daily Log — ${todayKey()}`} embedded />
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
          <div className="command-surface rounded-md p-6">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setMonthOffset((prev) => prev - 1)}
                className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 text-gray-300"
              >
                Previous
              </button>
              <div className="text-xl font-semibold">
                {target.toLocaleString("default", {
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <button
                onClick={() => setMonthOffset((prev) => prev + 1)}
                className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 text-gray-300"
              >
                Next
              </button>
            </div>

            <div className="grid grid-cols-7 text-gray-400 text-sm mb-3">
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
                return (
                  <Link
                    key={key}
                    href={`/day/${key}`}
                    className={[
                      "p-3 rounded-md border text-sm min-h-[80px] transition",
                      inMonth ? "border-white/10 bg-black/40" : "border-white/5 bg-black/20",
                      row ? "text-white" : "text-gray-500",
                      row ? "hover:border-[color:var(--accent-60)]" : "hover:border-white/20",
                    ].join(" ")}
                  >
                    <div className="text-xs text-gray-500">{date.getDate()}</div>
                    {row ? (
                      <div className="mt-2 font-semibold">{row.total_score.toFixed(0)}/100</div>
                    ) : (
                      <div className="mt-2 text-gray-600">No log</div>
                    )}
                  </Link>
                );
              })}
            </div>

            {logsLoading ? <div className="text-gray-500 mt-4">Loading month…</div> : null}
          </div>

          <div className="command-surface rounded-md p-6">
            <div className="text-sm uppercase tracking-[0.3em] text-gray-500">Recent Entries</div>
            <div className="mt-4 space-y-3">
              {recentLogs.length === 0 ? (
                <div className="text-gray-500">No recent entries yet.</div>
              ) : (
                recentLogs.map((row) => (
                  <div
                    key={row.date}
                    className="flex items-center justify-between rounded-md border border-white/10 bg-black/40 px-4 py-3"
                  >
                    <div>
                      <div className="text-white font-semibold">{row.date}</div>
                      <div className="text-gray-500 text-sm">Score {row.total_score.toFixed(0)}/100</div>
                    </div>
                    <Link
                      href={`/day/${row.date}`}
                      className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 text-sm"
                    >
                      Open
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
