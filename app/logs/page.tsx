"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StoryLoading from "@/app/components/StoryLoading";
import DailyLog from "@/app/components/DailyLog";
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
  workout_score: number;
  sleep_score: number;
  diet_score: number;
  reading_score: number;
};

export default function LogsPage() {
  const router = useRouter();
  const { loading, userId } = useSession();
  const [profile, setProfile] = useState<Profile | undefined>();
  const [profileLoading, setProfileLoading] = useState(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const logRef = useRef<HTMLDivElement | null>(null);

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
      .select("date,total_score,workout_score,sleep_score,diet_score,reading_score")
      .eq("user_id", userId)
      .gte("date", startKey)
      .lte("date", endKey)
      .order("date", { ascending: true })
      .then(({ data }) => {
        const rows = (data ?? []).map((row) => ({
          date: row.date,
          total_score: Number(row.total_score ?? 0),
          workout_score: Number(row.workout_score ?? 0),
          sleep_score: Number(row.sleep_score ?? 0),
          diet_score: Number(row.diet_score ?? 0),
          reading_score: Number(row.reading_score ?? 0),
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
  const selectedRow = logMap.get(selectedDate);

  const weeklyAverage = useMemo(() => {
    const end = new Date(selectedDate);
    let sum = 0;
    let count = 0;
    for (let i = 0; i < 7; i += 1) {
      const key = toDateKey(addDays(end, -i));
      const row = logMap.get(key);
      if (row) {
        sum += row.total_score;
        count += 1;
      }
    }
    return count ? sum / count : 0;
  }, [logMap, selectedDate]);

  const readiness = selectedRow?.total_score ?? 0;
  const delta = readiness - weeklyAverage;

  const statusLabel = (score: number) => {
    if (score >= 25) return { label: "COMPLETE", color: "text-[color:var(--accent)]" };
    if (score >= 18) return { label: "ON TRACK", color: "text-[color:var(--accent)]" };
    if (score >= 10) return { label: "PARTIAL", color: "text-amber-400/80" };
    return { label: "DEFICIT", color: "text-rose-400/80" };
  };

  const chartPoints = selectedRow
    ? [
        selectedRow.workout_score,
        selectedRow.workout_score + selectedRow.sleep_score,
        selectedRow.workout_score + selectedRow.sleep_score + selectedRow.diet_score,
        selectedRow.total_score,
      ]
    : [];

  const chartPath = chartPoints.length
    ? chartPoints
        .map((value, index) => {
          const x = (index / (chartPoints.length - 1)) * 100;
          const y = 100 - Math.min(100, Math.max(0, value));
          return `${x},${y}`;
        })
        .join(" ")
    : "";

  return (
    <main className="min-h-screen text-white flex flex-col items-center p-8">
      <div className="w-full max-w-6xl pt-4 space-y-6">
        <section className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-6">
          <div className="rounded-md border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.04),_transparent_70%)] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.35em] text-gray-500">Logs</div>
                <div className="text-base font-semibold text-white">
                  {target.toLocaleString("default", {
                    month: "short",
                    year: "numeric",
                  }).toUpperCase()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMonthOffset((prev) => prev - 1)}
                  className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 text-[10px] uppercase tracking-[0.2em] text-gray-300"
                >
                  Previous
                </button>
                <button
                  onClick={() => setMonthOffset((prev) => prev + 1)}
                  className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 text-[10px] uppercase tracking-[0.2em] text-gray-300"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-[10px] uppercase tracking-[0.25em] text-gray-500 mb-2">
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
                const isSelected = key === selectedDate;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedDate(key);
                      requestAnimationFrame(() => {
                        logRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    }}
                    className={[
                      "relative h-[84px] rounded-md border transition text-left",
                      "bg-[#0b1220]/70",
                      inMonth ? "border-white/10" : "border-white/5 opacity-50",
                      row ? "hover:border-[color:var(--accent-60)]" : "hover:border-white/20",
                      isToday ? "border-[color:var(--accent-60)]" : "",
                      isSelected ? "shadow-[0_0_16px_rgba(31,122,79,0.35)]" : "",
                    ].join(" ")}
                  >
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:80px_80px] opacity-20" />
                    <div className="relative h-full p-2 flex flex-col">
                      <div className="text-xs text-gray-500">{date.getDate()}</div>
                      <div className="flex-1 flex flex-col items-center justify-center">
                        {row ? (
                          <>
                            <div className="text-2xl font-semibold text-white">
                              {row.total_score.toFixed(0)}
                            </div>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                              /100
                            </div>
                          </>
                        ) : (
                          <div className="text-[10px] uppercase tracking-[0.3em] text-gray-700">
                            No log
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {logsLoading ? <div className="text-gray-500 mt-3">Loading month…</div> : null}
          </div>

          <div className="rounded-md border border-white/10 bg-[#0b1220]/80 p-6">
            <div className="text-[11px] uppercase tracking-[0.35em] text-gray-500">
              Daily Intelligence
            </div>
            <div className="mt-4 text-sm text-gray-400">Readiness Index</div>
            <div className="text-4xl font-semibold text-white">
              {selectedRow ? readiness.toFixed(0) : "--"}{" "}
              <span className="text-base text-gray-500">/ 100</span>
            </div>
            <div className="mt-2 text-sm text-gray-400">
              {selectedRow ? `${delta >= 0 ? "+" : ""}${delta.toFixed(0)} vs weekly average` : "No activity logged for this date."}
            </div>

            <div className="mt-6">
              {selectedRow ? (
                <svg viewBox="0 0 100 100" className="w-full h-24">
                  <polyline
                    fill="none"
                    stroke="rgba(31,122,79,0.8)"
                    strokeWidth="2"
                    points={chartPath}
                  />
                </svg>
              ) : (
                <div className="text-sm text-gray-500">No activity logged for this date.</div>
              )}
            </div>

            <div className="mt-6 space-y-3 text-sm">
              {selectedRow ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Exercise</span>
                    <span className={statusLabel(selectedRow.workout_score).color}>
                      {statusLabel(selectedRow.workout_score).label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Sleep</span>
                    <span className={statusLabel(selectedRow.sleep_score).color}>
                      {statusLabel(selectedRow.sleep_score).label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Diet</span>
                    <span className={statusLabel(selectedRow.diet_score).color}>
                      {statusLabel(selectedRow.diet_score).label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Reading</span>
                    <span className={statusLabel(selectedRow.reading_score).color}>
                      {statusLabel(selectedRow.reading_score).label}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-gray-500 text-sm">No category data yet.</div>
              )}
            </div>
          </div>
        </section>

        <section ref={logRef} className="command-surface rounded-md p-6">
          <div className="text-sm uppercase tracking-[0.3em] text-gray-500">
            {selectedDate === toDateKey(new Date()) ? "Today’s Log" : "Selected Date Log"}
          </div>
          <div className="mt-4">
            <DailyLog
              dateKey={selectedDate}
              userId={userId}
              title={`Daily Log — ${selectedDate}`}
              embedded
            />
          </div>
        </section>
      </div>
    </main>
  );
}
