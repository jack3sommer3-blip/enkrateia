"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { supabase } from "@/lib/supabase";
import {
  getDefaultGoalConfig,
  normalizeGoalConfig,
  GOAL_BOUNDS,
  GOAL_OPTIONS,
  GOAL_CATEGORY_LABELS,
  GOAL_PRESETS,
  getPresetConfig,
} from "@/lib/goals";
import type { GoalConfig, GoalCategoryKey } from "@/lib/types";

export default function GoalsPage() {
  const router = useRouter();
  const { loading, userId } = useSession();
  const [goalConfig, setGoalConfig] = useState<GoalConfig>(getDefaultGoalConfig());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState("default");

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      router.replace("/login");
      return;
    }
    setLoadingGoals(true);
    supabase
      .from("user_goals")
      .select("goals, enabled_categories")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        const config = normalizeGoalConfig(data?.goals, data?.enabled_categories);
        setGoalConfig(config);
        setSelectedPreset(config.presetId ?? "default");
        setLoadingGoals(false);
      });
  }, [loading, router, userId]);

  const updateTarget = (category: GoalCategoryKey, key: string, value: string) => {
    const n = Number(value);
    setGoalConfig((prev) => {
      const targetValue = Number.isFinite(n)
        ? n
        : prev.categories[category].targets[key];
      return {
        ...prev,
        categories: {
          ...prev.categories,
          [category]: {
            ...prev.categories[category],
            targets: {
              ...prev.categories[category].targets,
              [key]: targetValue,
            },
          },
        },
      };
    });
  };

  const toggleVariable = (category: GoalCategoryKey, key: string) => {
    setGoalConfig((prev) => {
      const enabled = prev.categories[category].enabled.includes(key)
        ? prev.categories[category].enabled.filter((k) => k !== key)
        : [...prev.categories[category].enabled, key];
      return {
        ...prev,
        categories: {
          ...prev.categories,
          [category]: {
            ...prev.categories[category],
            enabled,
          },
        },
      };
    });
  };

  const toggleCategory = (category: GoalCategoryKey) => {
    setGoalConfig((prev) => {
      const enabled = prev.enabledCategories.includes(category)
        ? prev.enabledCategories.filter((c) => c !== category)
        : [...prev.enabledCategories, category];
      return {
        ...prev,
        enabledCategories: enabled.length ? enabled : prev.enabledCategories,
      };
    });
  };

  const selectPreset = (presetId: string) => {
    const config = getPresetConfig(presetId);
    setGoalConfig(config);
    setSelectedPreset(presetId);
  };

  const resetDefaults = () => {
    setGoalConfig(getDefaultGoalConfig());
    setSelectedPreset("default");
  };

  const validateGoals = () => {
    for (const category of goalConfig.enabledCategories) {
      if (!goalConfig.categories[category].enabled.length) {
        return `Select at least one variable in ${GOAL_CATEGORY_LABELS[category]}.`;
      }
      for (const key of goalConfig.categories[category].enabled) {
        const value = goalConfig.categories[category].targets[key];
        if (value == null || Number.isNaN(value) || value < 0) {
          return `Target for ${key.replaceAll("_", " ")} must be 0 or higher.`;
        }
      }
    }
    return null;
  };

  const normalizedConfig = useMemo(
    () => normalizeGoalConfig(goalConfig),
    [goalConfig]
  );

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
        goals: normalizedConfig.categories,
        enabled_categories: normalizedConfig.enabledCategories,
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
    <main className="min-h-screen text-white flex flex-col items-center p-8">
      <div className="w-full max-w-4xl pt-10">
        <header className="mb-10">
          <div className="text-xs uppercase tracking-[0.3em] text-gray-500">Goals</div>
          <h1 className="mt-3 text-4xl md:text-5xl font-bold leading-tight">
            Scoring Configuration
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Choose what counts toward scoring. Each enabled variable is weighted
            equally in its category.
          </p>
        </header>

        <section className="space-y-6">
          <div className="command-surface rounded-md p-6">
            <div className="text-xl font-semibold">Structured paths</div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {GOAL_PRESETS.filter((preset) => preset.id !== "default").map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => selectPreset(preset.id)}
                  className={[
                    "p-4 rounded-md border text-left transition",
                    selectedPreset === preset.id
                      ? "border-[color:var(--accent-60)] bg-[color:var(--accent-10)]"
                      : "border-white/10 hover:border-white/20",
                  ].join(" ")}
                >
                  <div className="text-white font-semibold">{preset.name}</div>
                  <div className="text-gray-400 text-sm mt-1">{preset.description}</div>
                  {preset.notes?.length ? (
                    <ul className="mt-2 text-xs text-gray-500 list-disc ml-4">
                      {preset.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {(Object.keys(GOAL_OPTIONS) as GoalCategoryKey[]).map((category) => (
            <div key={category} className="command-surface rounded-md p-6">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-semibold">
                  {GOAL_CATEGORY_LABELS[category]}
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={normalizedConfig.enabledCategories.includes(category)}
                    onChange={() => toggleCategory(category)}
                    className="w-4 h-4 rounded border border-gray-600 bg-black"
                  />
                  Enabled
                </label>
              </div>
              <div className="mt-4 space-y-4">
                {GOAL_OPTIONS[category].map((option) => {
                  const enabled =
                    normalizedConfig.categories[category].enabled.includes(option.key);
                  const categoryEnabled =
                    normalizedConfig.enabledCategories.includes(category);
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
                          disabled={!categoryEnabled}
                          onChange={() => toggleVariable(category, option.key)}
                          className="w-5 h-5 rounded-full appearance-none border border-gray-600 bg-black checked:bg-[color:var(--accent)] checked:border-[color:var(--accent-60)] transition"
                        />
                        <div>
                          <div className="text-white">{option.label}</div>
                          <div className="text-gray-500 text-sm">{option.hint}</div>
                        </div>
                      </label>
                      <input
                        type="number"
                        disabled={!enabled || !categoryEnabled}
                        min={bounds?.min}
                        max={bounds?.max}
                        value={normalizedConfig.categories[category].targets[option.key] ?? ""}
                        onChange={(e) =>
                          updateTarget(category, option.key, e.target.value)
                        }
                        className="w-full md:w-48 px-4 py-2 rounded-md bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600 disabled:opacity-40"
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
            className="px-4 py-2 rounded-md border border-[color:var(--accent-60)] text-[color:var(--accent)] hover:text-white hover:border-[color:var(--accent)] transition disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save goals"}
          </button>
          <button
            onClick={resetDefaults}
            className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20 text-gray-300"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </main>
  );
}
