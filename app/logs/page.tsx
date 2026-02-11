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
import { addDays, startOfDay, toDateKey, todayKey } from "@/lib/utils";

function buildCalendar(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const slots = Math.min(35, Math.ceil((startWeekday + daysInMonth) / 7) * 7);
  const days: Array<Date | null> = Array(slots).fill(null);
  for (let i = 0; i < daysInMonth; i += 1) {
    days[startWeekday + i] = new Date(year, month, i + 1);
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
        const todayKeyValue = todayKey();
        const rows = (data ?? [])
          .filter((row) => {
            const isFuture = row.date > todayKeyValue;
            const total = Number(row.total_score ?? 0);
            const workout = Number(row.workout_score ?? 0);
            const sleep = Number(row.sleep_score ?? 0);
            const diet = Number(row.diet_score ?? 0);
            const reading = Number(row.reading_score ?? 0);
            if (isFuture && total === 0 && workout === 0 && sleep === 0 && diet === 0 && reading === 0) {
              return false;
            }
            return true;
          })
          .map((row) => ({
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

  if (loading || profileLoading) {
    return <StoryLoading name={profile?.first_name} />;
  }

  if (!userId || !profile) return null;

  const base = new Date();
  const target = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const calendarDays = buildCalendar(target.getFullYear(), target.getMonth());
  const selectedRow = logMap.get(selectedDate);
  const todayKeyValue = todayKey();

  const readiness = selectedRow?.total_score ?? 0;
  const delta = readiness - weeklyAverage;

  const statusLabel = (score: number) => {
    if (score >= 25) return { label: "COMPLETE", color: "text-[color:var(--accent)]" };
    if (score >= 18) return { label: "ON TRACK", color: "text-[color:var(--accent)]" };
    if (score >= 10) return { label: "PARTIAL", color: "text-amber-400/80" };
    return { label: "DEFICIT", color: "text-rose-400/80" };
  };

  return (
    <main className="min-h-screen text-white flex flex-col items-center p-8">
      <div className="w-full max-w-6xl pt-3 space-y-4">
        <section className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-5">
          <div className="rounded-md border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.04),_transparent_70%)] p-3">
            <div className="mb-2 flex items-center justify-between">
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
              {calendarDays.map((date, index) => {
                if (!date) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="aspect-square rounded-md border border-white/5 bg-black/20"
                    />
                  );
                }
                const key = toDateKey(date);
                const row = logMap.get(key);
                const isToday = key === toDateKey(new Date());
                const isSelected = key === selectedDate;
                const isFuture = key > todayKeyValue;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (isFuture) return;
                      setSelectedDate(key);
                      requestAnimationFrame(() => {
                        logRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    }}
                    disabled={isFuture}
                    className={[
                      "relative aspect-square rounded-md border transition text-left",
                      "bg-[#0b1220]/70",
                      "border-white/10",
                      row ? "hover:border-[color:var(--accent-60)]" : "hover:border-white/20",
                      isToday ? "border-[color:var(--accent-60)]" : "",
                      isSelected ? "shadow-[0_0_16px_rgba(31,122,79,0.35)]" : "",
                      isFuture ? "opacity-40 cursor-not-allowed hover:border-white/10" : "",
                    ].join(" ")}
                  >
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:80px_80px] opacity-20" />
                    <div className="relative h-full p-2">
                      <div className="absolute left-2 top-2 text-xs text-gray-500">
                        {date.getDate()}
                      </div>
                      {row ? (
                        <div className="h-full flex flex-col items-center justify-center pb-2 pt-4">
                          <div className="text-xl font-semibold text-white">
                            {row.total_score.toFixed(0)}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {logsLoading ? <div className="text-gray-500 mt-3">Loading month…</div> : null}
          </div>

          <div className="relative rounded-md border border-white/10 bg-[#0b1220]/80 p-4 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(transparent_0%,rgba(255,255,255,0.12)_50%,transparent_100%)]" />
            <div className="absolute inset-0 pointer-events-none opacity-15 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100%_6px]" />
            <div className="relative">
              <div className="text-[11px] uppercase tracking-[0.35em] text-gray-500">
                Daily Progress
              </div>
              <div className="mt-2 h-px bg-white/10" />
              {selectedRow ? (
                <div className="mt-3 space-y-3 text-sm">
                {[
                  { label: "Exercise", score: selectedRow.workout_score },
                  { label: "Sleep", score: selectedRow.sleep_score },
                  { label: "Diet", score: selectedRow.diet_score },
                  { label: "Reading", score: selectedRow.reading_score },
                ].map((category) => {
                    const percent = Math.min(100, Math.max(0, (category.score / 25) * 100));
                    return (
                      <div
                        key={category.label}
                        className="relative rounded-md border border-white/10 px-3 py-2 hover:border-[color:var(--accent-60)] transition"
                      >
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/5">
                          <div
                            className="h-full bg-[color:var(--accent-60)]"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">{category.label}</span>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white">
                              {category.score.toFixed(0)} / 25
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 text-sm text-gray-500">No activity logged for this date.</div>
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
              showLabel={false}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
