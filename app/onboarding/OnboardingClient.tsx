"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { getProfile } from "@/lib/profile";
import {
  getDefaultGoalConfig,
  normalizeGoalConfig,
  GOAL_BOUNDS,
  GOAL_OPTIONS,
  GOAL_CATEGORY_LABELS,
  GOAL_PRESETS,
  getPresetConfig,
  clearEnabledVariablesForDomains,
} from "@/lib/goals";
import type { GoalCategoryKey, GoalConfig } from "@/lib/types";

export default function OnboardingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, userId, email } = useSession();
  const previewMode = searchParams.get("preview") === "1";
  const forceMode = searchParams.get("force") === "1";

  const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
  const [step, setStep] = useState<
    "profile" | "domains" | "path" | "goals" | "confirm"
  >("profile");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingState, setLoadingState] = useState(true);
  const [goalConfig, setGoalConfig] = useState<GoalConfig>(getDefaultGoalConfig());
  const [selectedPreset, setSelectedPreset] = useState("default");

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      router.replace("/login");
      return;
    }

    const load = async () => {
      const profile = await getProfile(userId);
      if (profile) {
        setFirstName(profile.first_name ?? "");
        setLastName(profile.last_name ?? "");
        setUsername(profile.username ?? "");
        setStep("domains");
      }

      const { data: goalsRow } = await supabase
        .from("user_goals")
        .select("goals, enabled_categories, onboarding_completed")
        .eq("user_id", userId)
        .maybeSingle();

      const config = normalizeGoalConfig(goalsRow?.goals, goalsRow?.enabled_categories);
      setGoalConfig(config);
      setSelectedPreset(config.presetId ?? "default");

      if (!previewMode && !forceMode && goalsRow?.onboarding_completed) {
        router.replace("/");
        return;
      }

      setLoadingState(false);
    };

    load();
  }, [loading, previewMode, forceMode, router, userId]);

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
    if (presetId === "custom") {
      setSelectedPreset("custom");
      setGoalConfig((prev) => ({
        ...clearEnabledVariablesForDomains(prev, prev.enabledCategories),
        presetId: "custom",
      }));
      return;
    }
    const config = getPresetConfig(presetId);
    setGoalConfig((prev) => {
      const enabledCategories = prev.enabledCategories;
      const merged = { ...prev.categories };
      enabledCategories.forEach((category) => {
        merged[category] = config.categories[category];
      });
      return {
        ...config,
        enabledCategories,
        categories: merged,
        presetId: presetId,
      };
    });
    setSelectedPreset(presetId);
  };

  const normalizedConfig = useMemo(() => normalizeGoalConfig(goalConfig), [goalConfig]);

  const stepTitle =
    step === "profile"
      ? "Create your profile"
      : step === "domains"
        ? "Select domains"
        : step === "path"
          ? "Choose your path"
          : step === "goals"
            ? "Set your targets"
            : "Confirm your standard";

  const stepSubtitle =
    step === "profile"
      ? "Your username will be public within the app."
      : step === "domains"
        ? "Define which domains count toward your score."
        : step === "path"
          ? "Structured paths pre-fill targets. You can still customize."
          : step === "goals"
            ? "Each enabled variable is weighted equally inside its category."
            : "Review and define your standard.";

  const saveProfile = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      setError("Please fill out all fields.");
      return;
    }
    if (!USERNAME_REGEX.test(username.trim())) {
      setError("Username must be 3–20 characters: a-z, 0-9, underscore.");
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from("profiles").insert({
      id: userId,
      email,
      username: username.trim(),
      display_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    });
    setSaving(false);
    if (insertError) {
      if (insertError.code === "23505") {
        setError("That username is already taken.");
      } else {
        setError(insertError.message);
      }
      return;
    }
    setStep("domains");
  };

  const validateGoals = () => {
    if (!normalizedConfig.enabledCategories.length) {
      return "Select at least one domain to define your standard.";
    }
    for (const category of normalizedConfig.enabledCategories) {
      if (!normalizedConfig.categories[category].enabled.length) {
        return `Select at least one variable in ${GOAL_CATEGORY_LABELS[category]}.`;
      }
      for (const key of normalizedConfig.categories[category].enabled) {
        const value = normalizedConfig.categories[category].targets[key];
        if (value == null || Number.isNaN(value) || value < 0) {
          return `Target for ${key.replaceAll("_", " ")} must be 0 or higher.`;
        }
      }
    }
    return null;
  };

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
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    if (previewMode) {
      router.replace("/settings");
      return;
    }
    router.replace("/");
  };

  if (loading || loadingState) {
    return <StoryLoading />;
  }

  if (!userId) return null;

  return (
    <main className="min-h-screen text-white flex items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        <div className="text-gray-500 text-sm tracking-[0.3em]">ENKRATEIA</div>
        <h1 className="text-4xl font-semibold mt-4">{stepTitle}</h1>
        <p className="text-gray-400 mt-2">{stepSubtitle}</p>

        {step === "profile" ? (
          <div className="mt-6 space-y-4">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="w-full px-4 py-3 rounded-md bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              className="w-full px-4 py-3 rounded-md bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
            />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="Username"
              className="w-full px-4 py-3 rounded-md bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
            />
            {error ? <div className="text-red-400 text-sm">{error}</div> : null}
            <button
              onClick={saveProfile}
              disabled={saving}
              className="mt-2 w-full px-4 py-3 rounded-md border border-[color:var(--accent-60)] text-[color:var(--accent)] hover:border-[color:var(--accent)] transition disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        ) : null}

        {step === "domains" ? (
          <div className="mt-6 space-y-6">
            <div className="command-surface rounded-md p-6">
              <div className="text-xl font-semibold">Domains</div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.keys(GOAL_OPTIONS) as GoalCategoryKey[]).map((category) => (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={[
                      "p-4 rounded-md border text-left transition flex items-center justify-between",
                      normalizedConfig.enabledCategories.includes(category)
                        ? "border-[color:var(--accent-60)] bg-[color:var(--accent-10)]"
                        : "border-white/10 hover:border-white/20",
                    ].join(" ")}
                  >
                    <div className="text-white font-semibold">
                      {GOAL_CATEGORY_LABELS[category]}
                    </div>
                    <div className="text-xs uppercase tracking-[0.3em] text-gray-500">
                      {normalizedConfig.enabledCategories.includes(category)
                        ? "Enabled"
                        : "Disabled"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {error ? <div className="text-red-400 text-sm">{error}</div> : null}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep("path")}
                className="px-4 py-3 rounded-md border border-[color:var(--accent-60)] text-[color:var(--accent)] hover:border-[color:var(--accent)] transition"
              >
                Continue
              </button>
              {previewMode ? (
                <button
                  onClick={() => router.replace("/settings")}
                  className="px-4 py-3 rounded-md border border-white/10 hover:border-white/20 text-gray-300"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === "path" ? (
          <div className="mt-6 space-y-6">
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
                <button
                  onClick={() => selectPreset("custom")}
                  className={[
                    "p-4 rounded-md border text-left transition",
                    selectedPreset === "custom"
                      ? "border-[color:var(--accent-60)] bg-[color:var(--accent-10)]"
                      : "border-white/10 hover:border-white/20",
                  ].join(" ")}
                >
                  <div className="text-white font-semibold">Custom setup</div>
                  <div className="text-gray-400 text-sm mt-1">
                    Define targets from scratch.
                  </div>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep("domains")}
                className="px-4 py-3 rounded-md border border-white/10 hover:border-white/20 text-gray-300"
              >
                Back
              </button>
              <button
                onClick={() => setStep("goals")}
                className="px-4 py-3 rounded-md border border-[color:var(--accent-60)] text-[color:var(--accent)] hover:border-[color:var(--accent)] transition"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === "goals" ? (
          <div className="mt-6 space-y-6">
            {normalizedConfig.enabledCategories.map((category) => (
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
                          onChange={(e) => updateTarget(category, option.key, e.target.value)}
                          className="w-full md:w-48 px-4 py-2 rounded-md bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600 disabled:opacity-40"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {error ? <div className="text-red-400 text-sm">{error}</div> : null}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep("path")}
                className="px-4 py-3 rounded-md border border-white/10 hover:border-white/20 text-gray-300"
              >
                Back
              </button>
              <button
                onClick={() => setStep("confirm")}
                className="px-4 py-3 rounded-md border border-[color:var(--accent-60)] text-[color:var(--accent)] hover:border-[color:var(--accent)] transition"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === "confirm" ? (
          <div className="mt-6 space-y-6">
            <div className="command-surface rounded-md p-6">
              <div className="text-xl font-semibold">Summary</div>
              <div className="mt-4 space-y-4">
                {normalizedConfig.enabledCategories.map((category) => (
                  <div key={category} className="border border-white/10 rounded-md p-4">
                    <div className="text-white font-semibold">
                      {GOAL_CATEGORY_LABELS[category]}
                    </div>
                    <div className="mt-2 text-gray-400 text-sm">
                      {normalizedConfig.categories[category].enabled.length
                        ? normalizedConfig.categories[category].enabled
                            .map((key) => {
                              const value = normalizedConfig.categories[category].targets[key];
                              return `${key.replaceAll("_", " ")}: ${value}`;
                            })
                            .join(" • ")
                        : "No active variables"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {error ? <div className="text-red-400 text-sm">{error}</div> : null}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep("goals")}
                className="px-4 py-3 rounded-md border border-white/10 hover:border-white/20 text-gray-300"
              >
                Back
              </button>
              <button
                onClick={saveGoals}
                disabled={saving}
                className="px-4 py-3 rounded-md border border-[color:var(--accent-60)] text-[color:var(--accent)] hover:border-[color:var(--accent)] transition disabled:opacity-50"
              >
                {saving ? "Saving…" : "Define Your Standard"}
              </button>
              {previewMode ? (
                <button
                  onClick={() => router.replace("/settings")}
                  className="px-4 py-3 rounded-md border border-white/10 hover:border-white/20 text-gray-300"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
