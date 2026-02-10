"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/profile";
import type { Profile } from "@/lib/types";
import { addDays, formatScore, startOfDay, toDateKey, todayKey } from "@/lib/utils";
import MetricCard from "@/app/components/ui/MetricCard";
import Timeline from "@/app/components/ui/Timeline";
import CommandCard from "@/app/components/layout/CommandCard";

type LogRow = {
  date: string;
  total_score: number;
  workout_score: number;
  sleep_score: number;
  diet_score: number;
  reading_score: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const { loading, userId } = useSession();
  const [profile, setProfile] = useState<Profile | undefined>();
  const [profileLoading, setProfileLoading] = useState(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

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
    const today = startOfDay(new Date());
    const start = addDays(today, -29);
    const startKey = toDateKey(start);

    supabase
      .from("daily_logs")
      .select(
        "date,total_score,workout_score,sleep_score,diet_score,reading_score"
      )
      .eq("user_id", userId)
      .gte("date", startKey)
      .order("date", { ascending: false })
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
  }, [userId]);

  const logMap = useMemo(() => {
    const map = new Map<string, LogRow>();
    logs.forEach((row) => map.set(row.date, row));
    return map;
  }, [logs]);

  const { avg7, avg30, count7, count30 } = useMemo(() => {
    const today = startOfDay(new Date());
    let sum7 = 0;
    let sum30 = 0;
    let c7 = 0;
    let c30 = 0;

    for (let i = 0; i < 30; i += 1) {
      const key = toDateKey(addDays(today, -i));
      const row = logMap.get(key);
      if (row) {
        sum30 += row.total_score ?? 0;
        c30 += 1;
        if (i < 7) {
          sum7 += row.total_score ?? 0;
          c7 += 1;
        }
      }
    }

    return {
      avg7: c7 ? sum7 / c7 : 0,
      avg30: c30 ? sum30 / c30 : 0,
      count7: c7,
      count30: c30,
    };
  }, [logMap]);

  const consistencyStreak = useMemo(() => {
    const today = startOfDay(new Date());
    let streak = 0;
    for (let i = 0; i < 365; i += 1) {
      const key = toDateKey(addDays(today, -i));
      if (logMap.get(key)) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  }, [logMap]);

  const mostImproved = useMemo(() => {
    if (logs.length < 8) return "Not enough data yet";

    const today = startOfDay(new Date());
    const buckets = {
      workout: { recent: 0, prior: 0, r: 0, p: 0 },
      sleep: { recent: 0, prior: 0, r: 0, p: 0 },
      diet: { recent: 0, prior: 0, r: 0, p: 0 },
      reading: { recent: 0, prior: 0, r: 0, p: 0 },
    };

    for (let i = 0; i < 14; i += 1) {
      const key = toDateKey(addDays(today, -i));
      const row = logMap.get(key);
      if (!row) continue;
      const target = i < 7 ? "recent" : "prior";
      buckets.workout[target] += row.workout_score ?? 0;
      buckets.workout[target === "recent" ? "r" : "p"] += 1;
      buckets.sleep[target] += row.sleep_score ?? 0;
      buckets.sleep[target === "recent" ? "r" : "p"] += 1;
      buckets.diet[target] += row.diet_score ?? 0;
      buckets.diet[target === "recent" ? "r" : "p"] += 1;
      buckets.reading[target] += row.reading_score ?? 0;
      buckets.reading[target === "recent" ? "r" : "p"] += 1;
    }

    const diffs = [
      {
        label: "Workout",
        diff:
          (buckets.workout.r ? buckets.workout.recent / buckets.workout.r : 0) -
          (buckets.workout.p ? buckets.workout.prior / buckets.workout.p : 0),
      },
      {
        label: "Sleep",
        diff:
          (buckets.sleep.r ? buckets.sleep.recent / buckets.sleep.r : 0) -
          (buckets.sleep.p ? buckets.sleep.prior / buckets.sleep.p : 0),
      },
      {
        label: "Diet",
        diff:
          (buckets.diet.r ? buckets.diet.recent / buckets.diet.r : 0) -
          (buckets.diet.p ? buckets.diet.prior / buckets.diet.p : 0),
      },
      {
        label: "Reading",
        diff:
          (buckets.reading.r ? buckets.reading.recent / buckets.reading.r : 0) -
          (buckets.reading.p ? buckets.reading.prior / buckets.reading.p : 0),
      },
    ];

    diffs.sort((a, b) => b.diff - a.diff);
    if (diffs[0].diff <= 0.5) return "Holding steady";
    return diffs[0].label;
  }, [logMap, logs.length]);

  if (loading || profileLoading) {
    return <StoryLoading name={profile?.first_name} />;
  }

  if (!userId || !profile) return null;

  const timelineItems = logs.slice(0, 8).map((row) => ({
    date: row.date,
    score: Number(row.total_score ?? 0),
  }));

  return (
    <main className="min-h-screen text-white flex flex-col items-center px-6 pb-16">
      <div className="w-full max-w-6xl pt-10">
        <header className="mb-10">
          <div className="text-xs uppercase tracking-[0.3em] text-gray-500">
            Operator Overview
          </div>
          <h1 className="mt-3 text-4xl md:text-6xl font-bold leading-tight">
            Hello, {profile.first_name}.
          </h1>
          <p className="mt-2 text-sm text-gray-400">Recent performance metrics:</p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MetricCard label="7-Day Avg" value={formatScore(avg7)} delta="+4.2" positive />
          <MetricCard label="30-Day Avg" value={formatScore(avg30)} delta="+1.1" positive />
          <MetricCard label="Most Improved" value={mostImproved} subtext="Last 14 days" />
          <MetricCard
            label="Consistency"
            value={`${consistencyStreak} days`}
            subtext="Consecutive logs"
          />
        </section>

        <section className="mt-10">
          {logsLoading ? (
            <div className="text-gray-500">Loading history…</div>
          ) : (
            <Timeline items={timelineItems} />
          )}
        </section>

        <section className="mt-8">
          <CommandCard>
            <div className="text-sm text-gray-500">Next Action</div>
            <div className="mt-2 text-xl text-white">
              Continue today’s log to maintain streak integrity.
            </div>
            <a
              href={`/day/${todayKey()}`}
              className="mt-4 inline-flex items-center px-4 py-2 rounded-md border border-[color:var(--accent-40)] text-[color:var(--accent)] hover:text-white hover:border-[color:var(--accent-60)] transition"
            >
              Open Daily Log
            </a>
          </CommandCard>
        </section>
      </div>
    </main>
  );
}
