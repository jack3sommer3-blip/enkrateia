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
import { clampInt } from "@/lib/utils";

export default function GoalsPage() {
  const router = useRouter();
  const { loading, userId } = useSession();
  const [goalConfig, setGoalConfig] = useState<GoalConfig>(getDefaultGoalConfig());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState("default");
  const [targetEdits, setTargetEdits] = useState<Record<string, string>>({});

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

  const targetKey = (category: GoalCategoryKey, key: string) => `${category}.${key}`;

  const getTargetInputValue = (category: GoalCategoryKey, key: string) => {
    const edit = targetEdits[targetKey(category, key)];
    if (edit !== undefined) return edit;
    const value = normalizedConfig.categories[category].targets[key];
    return value === undefined ? "" : String(value);
  };

  const commitTarget = (category: GoalCategoryKey, key: string, raw: string) => {
    const bounds = GOAL_BOUNDS[key];
    const n = Number(raw);
    const fallback = Number.isFinite(n) ? n : 0;
    const clamped = bounds
      ? clampInt(Math.round(fallback), bounds.min, bounds.max)
      : fallback;
    updateTarget(category, key, String(clamped));
    setTargetEdits((prev) => {
      const next = { ...prev };
      delete next[targetKey(category, key)];
      return next;
    });
  };

  const bumpTarget = (category: GoalCategoryKey, key: string, delta: number) => {
    const bounds = GOAL_BOUNDS[key];
    const currentRaw = getTargetInputValue(category, key);
    const current = Number(currentRaw);
    const base = Number.isFinite(current) ? current : 0;
    const nextValue = bounds
      ? clampInt(Math.round(base + delta), bounds.min, bounds.max)
      : base + delta;
    updateTarget(category, key, String(nextValue));
    setTargetEdits((prev) => {
      const next = { ...prev };
      delete next[targetKey(category, key)];
      return next;
    });
  };

  const hudToggleClass = (active: boolean) =>
    [
      "inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm transition",
      active
        ? "border-[color:var(--accent-60)] text-[color:var(--accent)] bg-[color:var(--accent-10)]"
        : "border-white/10 text-gray-400 hover:border-white/20",
    ].join(" ");

  const HudCheck = ({ active }: { active: boolean }) => (
    <span
      className={[
        "h-5 w-5 rounded-full border flex items-center justify-center",
        active
          ? "border-[color:var(--accent-60)] text-[color:var(--accent)]"
          : "border-white/20 text-transparent",
      ].join(" ")}
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );

  const HudIconButton = ({
    label,
    onClick,
    disabled,
  }: {
    label: "plus" | "minus";
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-9 w-9 rounded-full border border-white/10 text-gray-300 hover:border-white/20 hover:text-white transition flex items-center justify-center disabled:opacity-40"
      aria-label={label}
      type="button"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
        {label === "plus" ? <path d="M12 5v14M5 12h14" /> : <path d="M5 12h14" />}
      </svg>
    </button>
  );

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
    setTargetEdits({});
  };

  const resetDefaults = () => {
    setGoalConfig(getDefaultGoalConfig());
    setSelectedPreset("default");
    setTargetEdits({});
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
        goals: { ...normalizedConfig.categories, preset: normalizedConfig.presetId },
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
                <button
                  onClick={() => toggleCategory(category)}
                  className={hudToggleClass(
                    normalizedConfig.enabledCategories.includes(category)
                  )}
                >
                  <HudCheck active={normalizedConfig.enabledCategories.includes(category)} />
                  Enabled
                </button>
              </div>
              <div className="mt-4 space-y-4">
                {(["daily", "weekly"] as const).map((cadence) => {
                  const options = GOAL_OPTIONS[category].filter(
                    (option) => option.cadence === cadence
                  );
                  if (!options.length) return null;
                  return (
                    <div key={cadence} className="space-y-3">
                      <div className="text-xs uppercase tracking-[0.3em] text-gray-500">
                        {cadence === "daily" ? "Daily targets" : "Weekly targets"}
                      </div>
                      {options.map((option) => {
                        const enabled =
                          normalizedConfig.categories[category].enabled.includes(option.key);
                        const categoryEnabled =
                          normalizedConfig.enabledCategories.includes(category);
                        return (
                          <div
                            key={option.key}
                            className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                          >
                            <button
                              onClick={() => toggleVariable(category, option.key)}
                              disabled={!categoryEnabled}
                              className="flex items-center gap-3 text-left disabled:opacity-40"
                            >
                              <HudCheck active={enabled} />
                              <div>
                                <div className="text-white">{option.label}</div>
                                <div className="text-gray-500 text-sm">{option.hint}</div>
                              </div>
                            </button>
                            <div className="flex items-center gap-2 w-full md:w-48">
                              <HudIconButton
                                label="minus"
                                onClick={() => bumpTarget(category, option.key, -1)}
                                disabled={!enabled || !categoryEnabled}
                              />
                              <input
                                type="text"
                                inputMode="numeric"
                                disabled={!enabled || !categoryEnabled}
                                value={getTargetInputValue(category, option.key)}
                                onChange={(e) =>
                                  setTargetEdits((prev) => ({
                                    ...prev,
                                    [targetKey(category, option.key)]: e.currentTarget.value,
                                  }))
                                }
                                onBlur={(e) =>
                                  commitTarget(category, option.key, e.currentTarget.value)
                                }
                                className="flex-1 px-4 py-2 rounded-md bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600 disabled:opacity-40"
                              />
                              <HudIconButton
                                label="plus"
                                onClick={() => bumpTarget(category, option.key, 1)}
                                disabled={!enabled || !categoryEnabled}
                              />
                            </div>
                          </div>
                        );
                      })}
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
