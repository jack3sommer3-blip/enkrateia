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
import { clampInt, parseOptionalInt } from "@/lib/utils";

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
    const parsed = parseOptionalInt(raw);
    if (parsed === null) {
      setGoalConfig((prev) => {
        const next = {
          ...prev,
          categories: {
            ...prev.categories,
            [category]: {
              ...prev.categories[category],
              targets: { ...prev.categories[category].targets },
            },
          },
        };
        delete next.categories[category].targets[key];
        return next;
      });
    } else {
      const clamped = bounds ? clampInt(parsed, bounds.min, bounds.max) : parsed;
      updateTarget(category, key, String(clamped));
    }
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
        if (value == null) continue;
        if (Number.isNaN(value) || value < 0) {
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
            Define your standard
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Choose from a structured path, or scroll down to build your own.
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
                  {normalizedConfig.enabledCategories.includes(category)
                    ? "Enabled"
                    : "Not enabled"}
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
                            className="grid grid-cols-[minmax(0,1fr)_minmax(140px,180px)] items-center gap-4"
                          >
                            <button
                              onClick={() => toggleVariable(category, option.key)}
                              disabled={!categoryEnabled}
                              className="flex items-center gap-3 text-left min-w-0 disabled:opacity-40"
                            >
                              <HudCheck active={enabled} />
                              <div className="min-w-0">
                                <div className="text-white truncate">{option.label}</div>
                                <div className="text-gray-500 text-sm truncate">
                                  {option.hint}
                                </div>
                              </div>
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={!enabled || !categoryEnabled}
                              value={
                                enabled && categoryEnabled
                                  ? getTargetInputValue(category, option.key)
                                  : ""
                              }
                              onChange={(e) => {
                                const raw =
                                  e.target instanceof HTMLInputElement ? e.target.value : "";
                                setTargetEdits((prev) => ({
                                  ...prev,
                                  [targetKey(category, option.key)]: raw.replace(/[^\d]/g, ""),
                                }));
                              }}
                              onBlur={() =>
                                commitTarget(
                                  category,
                                  option.key,
                                  targetEdits[targetKey(category, option.key)] ??
                                    getTargetInputValue(category, option.key)
                                )
                              }
                              className="w-full max-w-[180px] px-3 py-1.5 rounded-md bg-black border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-white/10 disabled:opacity-40"
                            />
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
