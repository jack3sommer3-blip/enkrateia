"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/app/components/Nav";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { supabase } from "@/lib/supabase";
import { getDefaultGoals, normalizeGoals, GOAL_BOUNDS } from "@/lib/goals";
import type { Goals } from "@/lib/types";

type GoalOption = { key: string; label: string; hint: string };

const GOAL_OPTIONS: Record<keyof Goals, GoalOption[]> = {
  exercise: [
    { key: "minutes", label: "Minutes", hint: "Total exercise minutes" },
    { key: "calories_burned", label: "Calories", hint: "Calories burned" },
    { key: "steps", label: "Steps", hint: "Daily steps" },
    { key: "workouts_logged", label: "Workouts logged", hint: "Count of workouts" },
  ],
  sleep: [{ key: "hours", label: "Hours", hint: "Total sleep hours" }],
  diet: [
    {
      key: "meals_cooked_percent",
      label: "Cooked meals %",
      hint: "Percent of meals cooked at home",
    },
    {
      key: "healthiness_self_rating",
      label: "Healthiness (1–10)",
      hint: "Self rating",
    },
    { key: "protein_grams", label: "Protein grams", hint: "Daily protein" },
  ],
  reading: [
    { key: "pages", label: "Pages", hint: "Total pages read" },
    { key: "fiction_pages", label: "Fiction pages", hint: "Fiction only" },
    { key: "nonfiction_pages", label: "Non-fiction pages", hint: "Non-fiction only" },
  ],
};

export default function GoalsPage() {
  const router = useRouter();
  const { loading, userId } = useSession();
  const [goals, setGoals] = useState<Goals>(getDefaultGoals());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingGoals, setLoadingGoals] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      router.replace("/login");
      return;
    }
    setLoadingGoals(true);
    supabase
      .from("user_goals")
      .select("goals")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setGoals(normalizeGoals(data?.goals));
        setLoadingGoals(false);
      });
  }, [loading, router, userId]);

  const updateTarget = (category: keyof Goals, key: string, value: string) => {
    const n = Number(value);
    setGoals((prev) => {
      const targetValue = Number.isFinite(n) ? n : prev[category].targets[key];
      return {
        ...prev,
        [category]: {
          ...prev[category],
          targets: {
            ...prev[category].targets,
            [key]: targetValue,
          },
        },
      };
    });
  };

  const toggleVariable = (category: keyof Goals, key: string) => {
    setGoals((prev) => {
      const enabled = prev[category].enabled.includes(key)
        ? prev[category].enabled.filter((k) => k !== key)
        : [...prev[category].enabled, key];
      return {
        ...prev,
        [category]: {
          ...prev[category],
          enabled,
        },
      };
    });
  };

  const resetDefaults = () => {
    setGoals(getDefaultGoals());
  };

  const validateGoals = () => {
    for (const category of Object.keys(GOAL_OPTIONS) as (keyof Goals)[]) {
      for (const key of goals[category].enabled) {
        const value = goals[category].targets[key];
        if (!value || value <= 0) {
          return `Target for ${key.replaceAll("_", " ")} must be greater than 0.`;
        }
      }
    }
    return null;
  };

  const normalizedGoals = useMemo(() => normalizeGoals(goals), [goals]);

  const saveGoals = async () => {
    setError(null);
    const validationError = validateGoals();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    const { error: saveError } = await supabase.from("user_goals").upsert(
      {
        user_id: userId,
        goals: normalizedGoals,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
  };

  if (loading || loadingGoals) {
    return <StoryLoading />;
  }

  if (!userId) return null;

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center p-8">
      <div className="w-full max-w-4xl">
        <header className="mb-10 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="text-gray-500 text-sm tracking-[0.3em]">ENKRATEIA</div>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">Goals</h1>
            <p className="text-gray-400">
              Choose what counts toward scoring. Each enabled variable is weighted
              equally in its category.
            </p>
          </div>

          <Nav />
        </header>

        <section className="space-y-6">
          {(Object.keys(GOAL_OPTIONS) as (keyof Goals)[]).map((category) => (
            <div key={category} className="p-6 rounded-2xl border border-gray-800 bg-gray-900">
              <div className="text-2xl font-semibold capitalize">{category}</div>
              <div className="mt-4 space-y-4">
                {GOAL_OPTIONS[category].map((option) => {
                  const enabled = normalizedGoals[category].enabled.includes(option.key);
                  const bounds = GOAL_BOUNDS[option.key];
                  return (
                    <div
                      key={option.key}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                    >
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => toggleVariable(category, option.key)}
                          className="w-5 h-5 accent-emerald-500"
                        />
                        <div>
                          <div className="text-white">{option.label}</div>
                          <div className="text-gray-500 text-sm">{option.hint}</div>
                        </div>
                      </label>
                      <input
                        type="number"
                        disabled={!enabled}
                        min={bounds?.min}
                        max={bounds?.max}
                        value={normalizedGoals[category].targets[option.key] ?? ""}
                        onChange={(e) =>
                          updateTarget(category, option.key, e.target.value)
                        }
                        className="w-full md:w-48 px-4 py-2 rounded-xl bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600 disabled:opacity-40"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {error ? <div className="text-red-400 text-sm mt-4">{error}</div> : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={saveGoals}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 transition disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save goals"}
          </button>
          <button
            onClick={resetDefaults}
            className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </main>
  );
}
