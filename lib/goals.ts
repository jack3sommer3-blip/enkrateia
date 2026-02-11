import type { Goals, GoalConfig, GoalCategoryKey } from "@/lib/types";

export const GOAL_CATEGORIES: GoalCategoryKey[] = [
  "exercise",
  "sleep",
  "diet",
  "reading",
];

const DEFAULT_GOALS: Goals = {
  exercise: {
    enabled: ["minutes"],
    targets: { minutes: 60 },
  },
  sleep: {
    enabled: ["hours"],
    targets: { hours: 8 },
  },
  diet: {
    enabled: ["meals_cooked_percent"],
    targets: { meals_cooked_percent: 100 },
  },
  reading: {
    enabled: ["pages"],
    targets: { pages: 20 },
  },
};

export const GOAL_BOUNDS: Record<string, { min: number; max: number }> = {
  minutes: { min: 1, max: 240 },
  calories_burned: { min: 1, max: 3000 },
  steps: { min: 100, max: 50000 },
  workouts_logged: { min: 1, max: 10 },
  hours: { min: 1, max: 16 },
  meals_cooked_percent: { min: 1, max: 100 },
  healthiness_self_rating: { min: 1, max: 10 },
  protein_grams: { min: 1, max: 400 },
  pages: { min: 1, max: 500 },
  fiction_pages: { min: 1, max: 500 },
  nonfiction_pages: { min: 1, max: 500 },
};

function clampTarget(key: string, value: number) {
  const bounds = GOAL_BOUNDS[key];
  if (!bounds) return value;
  return Math.max(bounds.min, Math.min(bounds.max, value));
}

export function getDefaultGoals(): Goals {
  return JSON.parse(JSON.stringify(DEFAULT_GOALS)) as Goals;
}

export function getDefaultGoalConfig(): GoalConfig {
  return {
    enabledCategories: [...GOAL_CATEGORIES],
    categories: getDefaultGoals(),
    presetId: "default",
  };
}

export function normalizeGoals(input?: Partial<Goals> | null): Goals {
  const base = getDefaultGoals();
  if (!input) return base;

  (["exercise", "sleep", "diet", "reading"] as const).forEach((category) => {
    const incoming = input[category];
    if (!incoming) return;
    if (Array.isArray(incoming.enabled)) {
      base[category].enabled = incoming.enabled.filter(Boolean);
    }
    if (incoming.targets && typeof incoming.targets === "object") {
      Object.entries(incoming.targets).forEach(([key, value]) => {
        if (typeof value !== "number" || !Number.isFinite(value)) return;
        base[category].targets[key] = clampTarget(key, value);
      });
    }
  });

  return base;
}

export function normalizeGoalConfig(
  input?: Partial<GoalConfig> | Goals | null,
  enabledCategoriesOverride?: string[] | null
): GoalConfig {
  const base = getDefaultGoalConfig();
  if (!input) return base;

  const maybeGoals =
    (input as GoalConfig).categories ??
    (input as any).goals ??
    (input as Goals);

  const categories = normalizeGoals(maybeGoals);
  const enabledRaw =
    (input as GoalConfig).enabledCategories ??
    (input as any).enabled_categories ??
    enabledCategoriesOverride ??
    base.enabledCategories;

  const enabledCategories = (Array.isArray(enabledRaw) ? enabledRaw : [])
    .filter((key) => GOAL_CATEGORIES.includes(key as GoalCategoryKey)) as GoalCategoryKey[];

  return {
    enabledCategories: enabledCategories.length ? enabledCategories : base.enabledCategories,
    categories,
    presetId: (input as GoalConfig).presetId ?? (input as any).preset ?? base.presetId,
  };
}

export type GoalPreset = {
  id: string;
  name: string;
  description: string;
  config: GoalConfig;
  notes?: string[];
};

export const GOAL_PRESETS: GoalPreset[] = [
  {
    id: "default",
    name: "Default",
    description: "Balanced baseline across exercise, sleep, diet, and reading.",
    config: getDefaultGoalConfig(),
  },
  {
    id: "75-hard",
    name: "75 Hard",
    description: "Two workouts, strict diet, daily reading, and recovery targets.",
    notes: [
      "Outdoor workout, water intake, and progress photo are not tracked yet.",
    ],
    config: {
      enabledCategories: ["exercise", "diet", "reading", "sleep"],
      categories: {
        ...getDefaultGoals(),
        exercise: {
          enabled: ["minutes", "workouts_logged", "steps"],
          targets: { minutes: 90, workouts_logged: 2, steps: 10000 },
        },
        diet: {
          enabled: ["meals_cooked_percent", "healthiness_self_rating"],
          targets: { meals_cooked_percent: 100, healthiness_self_rating: 9 },
        },
        reading: {
          enabled: ["pages"],
          targets: { pages: 10 },
        },
        sleep: {
          enabled: ["hours"],
          targets: { hours: 8 },
        },
      },
      presetId: "75-hard",
    },
  },
];

export function getPresetConfig(presetId: string): GoalConfig {
  const preset = GOAL_PRESETS.find((p) => p.id === presetId);
  return preset ? normalizeGoalConfig(preset.config) : getDefaultGoalConfig();
}

export type GoalOption = { key: string; label: string; hint: string };

export const GOAL_OPTIONS: Record<GoalCategoryKey, GoalOption[]> = {
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

export function computeCategoryScore(
  actuals: Record<string, number>,
  goals: Goals[keyof Goals],
  fallback: Goals[keyof Goals]
) {
  const enabled = goals.enabled.length ? goals.enabled : fallback.enabled;
  const targets = { ...fallback.targets, ...goals.targets };
  if (!enabled.length) return 0;

  let total = 0;
  enabled.forEach((key) => {
    const actual = actuals[key] ?? 0;
    const target = targets[key] ?? 0;
    if (!target || target <= 0) {
      total += 0;
    } else {
      total += Math.min(actual / target, 1);
    }
  });

  return total / enabled.length;
}

export function runGoalsSelfTest() {
  const goals = getDefaultGoals();
  const actuals = {
    exercise: { minutes: 30 },
    sleep: { hours: 7 },
    diet: { meals_cooked_percent: 50 },
    reading: { pages: 10 },
  };
  return {
    goals,
    actuals,
  };
}
