"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "@/app/components/Nav";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { supabase } from "@/lib/supabase";
import { getProfile, Profile } from "@/lib/profile";
import { addDays, startOfDay, toDateKey } from "@/lib/utils";

type LogRow = {
  date: string;
  total_score: number;
};

function buildCalendar(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay(); // 0 Sunday
  const start = addDays(first, -startWeekday);
  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    days.push(addDays(start, i));
  }
  return days;
}

export default function HistoryPage() {
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
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-5xl">
        <header className="mb-10 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="text-gray-500 text-sm tracking-[0.3em]">ENKRATEIA</div>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              History
            </h1>
            <p className="text-gray-400">
              Review past logs and revisit any day.
            </p>
          </div>

          <Nav />
        </header>

        <section className="p-6 rounded-2xl border border-gray-800 bg-gray-900">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setMonthOffset((prev) => prev - 1)}
              className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition"
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
              className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition"
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
                    "p-3 rounded-xl border text-sm min-h-[80px] transition",
                    inMonth ? "border-gray-800 bg-black" : "border-gray-900 bg-gray-950",
                    row ? "text-white" : "text-gray-500",
                    row ? "hover:border-emerald-600" : "hover:border-gray-700",
                  ].join(" ")}
                >
                  <div className="text-xs text-gray-500">{date.getDate()}</div>
                  {row ? (
                    <div className="mt-2 font-semibold">
                      {row.total_score.toFixed(0)}/100
                    </div>
                  ) : (
                    <div className="mt-2 text-gray-600">No log</div>
                  )}
                </Link>
              );
            })}
          </div>

          {logsLoading ? (
            <div className="text-gray-500 mt-4">Loading month…</div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
