"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Nav from "@/app/components/Nav";
import { supabase } from "@/lib/supabase";
import { DayData, ActivityType, WorkoutActivity } from "@/lib/types";
import { computeScores } from "@/lib/scoring";
import {
  clampInt,
  formatScore,
  intFromText,
  numFromText,
  textFromUnknown,
} from "@/lib/utils";

const DEFAULT_DATA: DayData = {
  workouts: { activities: [] },
  sleep: {},
  diet: {},
  reading: {},
};

function id() {
  return Math.random().toString(36).slice(2, 10);
}

function splitHoursToParts(raw?: string) {
  if (!raw) return { hoursText: undefined, minutesText: undefined };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { hoursText: raw, minutesText: undefined };
  const hours = Math.trunc(n);
  const minutes = Math.round((n - hours) * 60);
  return {
    hoursText: String(hours),
    minutesText: String(clampInt(minutes, 0, 59)),
  };
}

export default function DailyLog({
  dateKey,
  userId,
  title,
}: {
  dateKey: string;
  userId: string;
  title?: string;
}) {
  const [data, setData] = useState<DayData>(DEFAULT_DATA);
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    setHydrated(false);

    const load = async () => {
      const { data: row } = await supabase
        .from("daily_logs")
        .select("data")
        .eq("user_id", userId)
        .eq("date", dateKey)
        .maybeSingle();

      if (!mounted) return;

      if (row?.data) {
        const parsed = row.data as DayData;
        const legacySleep = textFromUnknown(
          (parsed as DayData & { sleep?: { hours?: number } }).sleep?.hours ??
            parsed?.sleep?.hoursText
        );
        const sleepParts = splitHoursToParts(legacySleep);
        setData({
          ...DEFAULT_DATA,
          ...parsed,
          workouts: {
            activities:
              parsed?.workouts?.activities?.map((activity) => ({
                id: activity.id ?? id(),
                type: activity.type ?? "Weight Lifting",
                minutesText: textFromUnknown(
                  (activity as WorkoutActivity & { minutes?: number }).minutes ??
                    activity.minutesText
                ),
                secondsText: textFromUnknown(
                  (activity as WorkoutActivity & { seconds?: number }).seconds ??
                    activity.secondsText
                ),
                caloriesText: textFromUnknown(
                  (activity as WorkoutActivity & { calories?: number }).calories ??
                    activity.caloriesText
                ),
                intensityText: textFromUnknown(
                  (activity as WorkoutActivity & { intensity?: number }).intensity ??
                    activity.intensityText
                ),
              })) ?? [],
          },
          sleep: {
            hoursText: parsed?.sleep?.hoursText ?? sleepParts.hoursText,
            minutesText: parsed?.sleep?.minutesText ?? sleepParts.minutesText,
            restingHrText: parsed?.sleep?.restingHrText,
          },
        });
      } else {
        setData(DEFAULT_DATA);
      }

      setHydrated(true);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [dateKey, userId]);

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      const scores = computeScores(data);
      const payload = {
        user_id: userId,
        date: dateKey,
        data,
        total_score: scores.totalScore,
        workout_score: scores.workoutScore,
        sleep_score: scores.sleepScore,
        diet_score: scores.dietScore,
        reading_score: scores.readingScore,
      };

      const { error } = await supabase
        .from("daily_logs")
        .upsert(payload, { onConflict: "user_id,date" });

      if (error) {
        setSaveError(error.message);
      } else if (saveError) {
        setSaveError(null);
      }
    }, 600);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, dateKey, hydrated, userId]);

  const totalWorkoutMinutes = useMemo(() => {
    return data.workouts.activities.reduce((sum, a) => {
      const minutes = intFromText(a.minutesText) ?? 0;
      const seconds = clampInt(intFromText(a.secondsText) ?? 0, 0, 59);
      return sum + minutes + seconds / 60;
    }, 0);
  }, [data.workouts.activities]);

  const sleepHours = numFromText(data.sleep.hoursText) ?? 0;
  const sleepMinutes = clampInt(intFromText(data.sleep.minutesText) ?? 0, 0, 59);
  const sleepTotalHours = sleepHours + sleepMinutes / 60;
  const cookedMeals = intFromText(data.diet.cookedMealsText) ?? 0;
  const restaurantMeals = intFromText(data.diet.restaurantMealsText) ?? 0;
  const totalMeals = cookedMeals + restaurantMeals;
  const pagesRead = intFromText(data.reading.pagesText) ?? 0;
  const scores = computeScores(data);
  const formKey = `${dateKey}-${hydrated ? "ready" : "loading"}`;

  const completedCount =
    (scores.workoutScore >= 25 ? 1 : 0) +
    (scores.sleepScore >= 25 ? 1 : 0) +
    (scores.dietScore >= 25 ? 1 : 0) +
    (scores.readingScore >= 25 ? 1 : 0);

  const addActivity = () => {
    setData((prev) => ({
      ...prev,
      workouts: {
        ...prev.workouts,
        activities: [
          ...prev.workouts.activities,
          { id: id(), type: "Weight Lifting" },
        ],
      },
    }));
  };

  const updateActivity = (
    activityId: string,
    patch: Partial<WorkoutActivity>
  ) => {
    setData((prev) => ({
      ...prev,
      workouts: {
        ...prev.workouts,
        activities: prev.workouts.activities.map((a) =>
          a.id === activityId ? { ...a, ...patch } : a
        ),
      },
    }));
  };

  const removeActivity = (activityId: string) => {
    setData((prev) => ({
      ...prev,
      workouts: {
        ...prev.workouts,
        activities: prev.workouts.activities.filter((a) => a.id !== activityId),
      },
    }));
  };

  const Card = ({
    title: cardTitle,
    subtitle,
    children,
    earned,
    hint,
  }: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
    earned: boolean;
    hint?: string;
  }) => (
    <div
      className={[
        "p-6 rounded-2xl border transition",
        earned ? "bg-emerald-950 border-emerald-700" : "bg-gray-900 border-gray-800",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xl font-semibold">{cardTitle}</div>
          <div className="text-gray-400 mt-1">{subtitle}</div>
          {hint ? <div className="text-gray-500 mt-2 text-sm">{hint}</div> : null}
        </div>
        <div
          className={[
            "shrink-0 w-10 h-10 rounded-full border flex items-center justify-center",
            earned ? "border-emerald-500 bg-emerald-900" : "border-gray-700 bg-black",
          ].join(" ")}
          aria-label={earned ? "Earned" : "Not earned"}
          title={earned ? "Earned" : "Not earned"}
        >
          {earned ? "✓" : ""}
        </div>
      </div>

      <div className="mt-5">{children}</div>
    </div>
  );

  const Label = ({ children }: { children: React.ReactNode }) => (
    <div className="text-gray-400 text-sm mb-1">{children}</div>
  );

  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...props}
      type={props.type ?? "text"}
      className={[
        "w-full px-3 py-2 rounded-xl bg-black border border-gray-700",
        "focus:outline-none focus:ring-2 focus:ring-gray-600",
        props.className ?? "",
      ].join(" ")}
    />
  );

  const TextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea
      {...props}
      className={[
        "w-full px-3 py-2 rounded-xl bg-black border border-gray-700",
        "focus:outline-none focus:ring-2 focus:ring-gray-600",
        props.className ?? "",
      ].join(" ")}
    />
  );

  const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
    <select
      {...props}
      className={[
        "w-full px-3 py-2 rounded-xl bg-black border border-gray-700",
        "focus:outline-none focus:ring-2 focus:ring-gray-600",
        props.className ?? "",
      ].join(" ")}
    />
  );

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center p-8">
      <div className="w-full max-w-4xl">
        <header className="mb-10 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="text-gray-500 text-sm tracking-[0.3em]">ENKRATEIA</div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-wide leading-none">
              {title ?? "Daily Log"}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-gray-900 border border-gray-800">
                <span className="text-gray-400">Score</span>{" "}
                <span className="font-semibold">{formatScore(scores.totalScore)}/100</span>
              </div>

              <div className="px-4 py-2 rounded-xl bg-gray-900 border border-gray-800">
                <span className="text-gray-400">Full points</span>{" "}
                <span className="font-semibold">{completedCount}/4</span>
              </div>

              <div className="px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400">
                {dateKey}
              </div>

              <div className="px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 min-w-[160px] text-center">
                Auto-save on
              </div>
            </div>
            <div className="min-h-[40px]">
              {saveError ? (
                <div className="px-4 py-2 rounded-xl bg-rose-950 border border-rose-800 text-rose-200 text-sm">
                  {saveError}
                </div>
              ) : null}
            </div>
          </div>

          <Nav />
        </header>

        <div key={formKey} className="grid grid-cols-1 gap-6">
          <Card
            title="Workout"
            subtitle="Log activities; earn up to 25 points at 60+ total minutes."
            hint={`Total minutes today: ${formatScore(
              totalWorkoutMinutes
            )} / 60  •  Score: ${formatScore(scores.workoutScore)}/25`}
            earned={scores.workoutScore >= 25}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={addActivity}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition"
              >
                Add activity
              </button>
            </div>

            {data.workouts.activities.length === 0 ? (
              <div className="text-gray-500 mt-4 text-sm">
                No activities yet. Add one to start logging.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {data.workouts.activities.map((a) => (
                  <div key={a.id} className="p-4 rounded-2xl bg-black border border-gray-800">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div className="md:col-span-1">
                        <Label>Activity</Label>
                        <Select
                          value={a.type}
                          onChange={(e) =>
                            updateActivity(a.id, { type: e.target.value as ActivityType })
                          }
                        >
                          <option>Running</option>
                          <option>Walking</option>
                          <option>Treadmill Walking</option>
                          <option>Weight Lifting</option>
                          <option>Cycling</option>
                          <option>HIIT</option>
                          <option>Yoga</option>
                        </Select>
                      </div>

                      <div>
                        <Label>Minutes</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="e.g., 45"
                          defaultValue={a.minutesText ?? ""}
                          onBlur={(e) =>
                            updateActivity(a.id, { minutesText: e.currentTarget.value })
                          }
                        />
                      </div>

                      <div>
                        <Label>Seconds</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="e.g., 30"
                          defaultValue={a.secondsText ?? ""}
                          onBlur={(e) =>
                            updateActivity(a.id, { secondsText: e.currentTarget.value })
                          }
                        />
                      </div>

                      <div>
                        <Label>Calories (optional)</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="e.g., 320"
                          defaultValue={a.caloriesText ?? ""}
                          onBlur={(e) =>
                            updateActivity(a.id, { caloriesText: e.currentTarget.value })
                          }
                        />
                      </div>

                      <div>
                        <Label>Intensity 1–9 (optional)</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="1–9"
                          defaultValue={a.intensityText ?? ""}
                          onBlur={(e) =>
                            updateActivity(a.id, { intensityText: e.currentTarget.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => removeActivity(a.id)}
                        className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Sleep"
            subtitle="Earn up to 25 points at 8+ hours."
            hint={`Hours today: ${formatScore(sleepTotalHours)} / 8  •  Score: ${formatScore(
              scores.sleepScore
            )}/25`}
            earned={scores.sleepScore >= 25}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Hours slept</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 7"
                  defaultValue={data.sleep.hoursText ?? ""}
                  onBlur={(e) =>
                    setData((prev) => ({
                      ...prev,
                      sleep: { ...prev.sleep, hoursText: e.currentTarget.value },
                    }))
                  }
                />
              </div>

              <div>
                <Label>Minutes slept</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 30"
                  defaultValue={data.sleep.minutesText ?? ""}
                  onBlur={(e) =>
                    setData((prev) => ({
                      ...prev,
                      sleep: { ...prev.sleep, minutesText: e.currentTarget.value },
                    }))
                  }
                />
              </div>

              <div>
                <Label>Resting heart rate (optional)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 52"
                  defaultValue={data.sleep.restingHrText ?? ""}
                  onBlur={(e) =>
                    setData((prev) => ({
                      ...prev,
                      sleep: {
                        ...prev.sleep,
                        restingHrText: e.currentTarget.value,
                      },
                    }))
                  }
                />
              </div>
            </div>
          </Card>

          <Card
            title="Diet"
            subtitle="Earn up to 25 points based on cooked percentage."
            hint={`Cooked: ${cookedMeals}  •  Restaurant: ${restaurantMeals}  •  Score: ${formatScore(
              scores.dietScore
            )}/25`}
            earned={scores.dietScore >= 25}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label># meals cooked</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 2"
                  defaultValue={data.diet.cookedMealsText ?? ""}
                  onBlur={(e) =>
                    setData((prev) => ({
                      ...prev,
                      diet: { ...prev.diet, cookedMealsText: e.currentTarget.value },
                    }))
                  }
                />
              </div>

              <div>
                <Label># meals from restaurants</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 1"
                  defaultValue={data.diet.restaurantMealsText ?? ""}
                  onBlur={(e) =>
                    setData((prev) => ({
                      ...prev,
                      diet: {
                        ...prev.diet,
                        restaurantMealsText: e.currentTarget.value,
                      },
                    }))
                  }
                />
              </div>
            </div>
          </Card>

          <Card
            title="Reading"
            subtitle="Log what you read; earn up to 25 points at 20 pages."
            hint={`Pages today: ${pagesRead} / 20  •  Score: ${formatScore(
              scores.readingScore
            )}/25`}
            earned={scores.readingScore >= 25}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Book title</Label>
                <Input
                  placeholder="e.g., Meditations"
                  defaultValue={data.reading.title ?? ""}
                  onBlur={(e) =>
                    setData((prev) => ({
                      ...prev,
                      reading: { ...prev.reading, title: e.currentTarget.value },
                    }))
                  }
                />
              </div>

              <div>
                <Label>Pages read</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 20"
                  defaultValue={data.reading.pagesText ?? ""}
                  onBlur={(e) =>
                    setData((prev) => ({
                      ...prev,
                      reading: { ...prev.reading, pagesText: e.currentTarget.value },
                    }))
                  }
                />
              </div>

              <div>
                <Label>Favorite quote (optional)</Label>
                <Input
                  placeholder="Paste a line that hit."
                  defaultValue={data.reading.quote ?? ""}
                  onBlur={(e) =>
                    setData((prev) => ({
                      ...prev,
                      reading: { ...prev.reading, quote: e.currentTarget.value },
                    }))
                  }
                />
              </div>

              <div className="md:col-span-2">
                <Label>Commentary (optional)</Label>
                <TextArea
                  rows={4}
                  placeholder="Quick thoughts, what you learned, what you’ll apply…"
                  defaultValue={data.reading.note ?? ""}
                  onBlur={(e) =>
                    setData((prev) => ({
                      ...prev,
                      reading: { ...prev.reading, note: e.currentTarget.value },
                    }))
                  }
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
