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
  normalizeIntText,
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

type SaveState = "idle" | "saving" | "saved" | "error";

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
  const [saveState, setSaveState] = useState<SaveState>("idle");
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

    setSaveState("saving");
    setSaveError(null);
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
        setSaveState("error");
        setSaveError(error.message);
      } else {
        setSaveState("saved");
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
  const cookedMeals = intFromText(data.diet.cookedMealsText) ?? 0;
  const restaurantMeals = intFromText(data.diet.restaurantMealsText) ?? 0;
  const totalMeals = cookedMeals + restaurantMeals;
  const pagesRead = intFromText(data.reading.pagesText) ?? 0;
  const scores = computeScores(data);

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

              <div className="px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400">
                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "saved"
                    ? "Saved"
                    : saveState === "error"
                      ? "Save failed"
                      : "Ready"}
              </div>
              {saveState === "error" && saveError ? (
                <div className="px-4 py-2 rounded-xl bg-rose-950 border border-rose-800 text-rose-200 text-sm">
                  {saveError}
                </div>
              ) : null}
            </div>
          </div>

          <Nav />
        </header>

        <div className="grid grid-cols-1 gap-6">
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
                          value={a.minutesText ?? ""}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) =>
                            updateActivity(a.id, { minutesText: e.target.value })
                          }
                          onBlur={(e) =>
                            updateActivity(a.id, {
                              minutesText: normalizeIntText(e.target.value, 0),
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label>Seconds</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="e.g., 30"
                          value={a.secondsText ?? ""}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) =>
                            updateActivity(a.id, { secondsText: e.target.value })
                          }
                          onBlur={(e) =>
                            updateActivity(a.id, {
                              secondsText: normalizeIntText(e.target.value, 0, 59),
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label>Calories (optional)</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="e.g., 320"
                          value={a.caloriesText ?? ""}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) =>
                            updateActivity(a.id, { caloriesText: e.target.value })
                          }
                          onBlur={(e) =>
                            updateActivity(a.id, {
                              caloriesText: normalizeIntText(e.target.value, 0),
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label>Intensity 1–9 (optional)</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="1–9"
                          value={a.intensityText ?? ""}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) =>
                            updateActivity(a.id, { intensityText: e.target.value })
                          }
                          onBlur={(e) =>
                            updateActivity(a.id, {
                              intensityText: normalizeIntText(e.target.value, 1, 9),
                            })
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
            hint={`Hours today: ${formatScore(sleepHours)} / 8  •  Score: ${formatScore(
              scores.sleepScore
            )}/25`}
            earned={scores.sleepScore >= 25}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Hours slept</Label>
                <Input
                  inputMode="decimal"
                  pattern="^\\d*(\\.\\d*)?$"
                  placeholder="e.g., 7.5"
                  value={data.sleep.hoursText ?? ""}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      sleep: { ...prev.sleep, hoursText: e.target.value },
                    }))
                  }
                />
              </div>

              <div>
                <Label>Resting heart rate (optional)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 52"
                  value={data.sleep.restingHrText ?? ""}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      sleep: { ...prev.sleep, restingHrText: e.target.value },
                    }))
                  }
                  onBlur={(e) =>
                    setData((prev) => ({
                      ...prev,
                      sleep: {
                        ...prev.sleep,
                        restingHrText: normalizeIntText(e.target.value, 0),
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
                  value={data.diet.cookedMealsText ?? ""}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      diet: { ...prev.diet, cookedMealsText: e.target.value },
                    }))
                  }
                  onBlur={(e) =>
                    setData((prev) => ({
                      ...prev,
                      diet: {
                        ...prev.diet,
                        cookedMealsText: normalizeIntText(e.target.value, 0),
                      },
                    }))
                  }
                />
              </div>

              <div>
                <Label># meals from restaurants</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 1"
                  value={data.diet.restaurantMealsText ?? ""}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      diet: { ...prev.diet, restaurantMealsText: e.target.value },
                    }))
                  }
                  onBlur={(e) =>
                    setData((prev) => ({
                      ...prev,
                      diet: {
                        ...prev.diet,
                        restaurantMealsText: normalizeIntText(e.target.value, 0),
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
                  value={data.reading.title ?? ""}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      reading: { ...prev.reading, title: e.target.value },
                    }))
                  }
                />
              </div>

              <div>
                <Label>Pages read</Label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g., 20"
                  value={data.reading.pagesText ?? ""}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      reading: { ...prev.reading, pagesText: e.target.value },
                    }))
                  }
                  onBlur={(e) =>
                    setData((prev) => ({
                      ...prev,
                      reading: {
                        ...prev.reading,
                        pagesText: normalizeIntText(e.target.value, 0),
                      },
                    }))
                  }
                />
              </div>

              <div>
                <Label>Favorite quote (optional)</Label>
                <Input
                  placeholder="Paste a line that hit."
                  value={data.reading.quote ?? ""}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      reading: { ...prev.reading, quote: e.target.value },
                    }))
                  }
                />
              </div>

              <div className="md:col-span-2">
                <Label>Commentary (optional)</Label>
                <TextArea
                  rows={4}
                  placeholder="Quick thoughts, what you learned, what you’ll apply…"
                  value={data.reading.note ?? ""}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      reading: { ...prev.reading, note: e.target.value },
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
