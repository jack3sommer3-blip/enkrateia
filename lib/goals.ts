import type { Goals, GoalConfig, GoalCategoryKey } from "@/lib/types";

export const GOAL_CATEGORIES: GoalCategoryKey[] = [
  "exercise",
  "sleep",
  "diet",
  "reading",
  "community",
];

export const GOAL_CATEGORY_LABELS: Record<GoalCategoryKey, string> = {
  exercise: "Exercise",
  sleep: "Sleep",
  diet: "Diet",
  reading: "Knowledge",
  community: "Community",
};

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
  community: {
    enabled: [],
    targets: {
      calls_weekly: 1,
      social_events_weekly: 1,
    },
  },
};

export const GOAL_BOUNDS: Record<string, { min: number; max: number }> = {
  minutes: { min: 1, max: 240 },
  calories_burned: { min: 1, max: 3000 },
  steps: { min: 100, max: 50000 },
  workouts_logged: { min: 1, max: 10 },
  workouts_logged_weekly: { min: 1, max: 20 },
  hours: { min: 1, max: 16 },
  meals_cooked_percent: { min: 1, max: 100 },
  healthiness_self_rating: { min: 1, max: 10 },
  protein_grams: { min: 1, max: 400 },
  pages: { min: 1, max: 500 },
  fiction_pages: { min: 1, max: 500 },
  nonfiction_pages: { min: 1, max: 500 },
  calls_weekly: { min: 0, max: 14 },
  social_events_weekly: { min: 0, max: 14 },
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
    enabledCategories: ["exercise", "sleep", "diet", "reading"],
    categories: getDefaultGoals(),
    presetId: "default",
  };
}

export function normalizeGoals(input?: Partial<Goals> | null): Goals {
  const base = getDefaultGoals();
  if (!input) return base;

  (["exercise", "sleep", "diet", "reading", "community"] as const).forEach((category) => {
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

  assertNoKnowledgeKey(enabledRaw);

  const enabledCategories = (Array.isArray(enabledRaw) ? enabledRaw : [])
    .filter((key) => GOAL_CATEGORIES.includes(key as GoalCategoryKey)) as GoalCategoryKey[];

  return {
    enabledCategories: enabledCategories.length ? enabledCategories : base.enabledCategories,
    categories,
    presetId: (input as GoalConfig).presetId ?? (input as any).preset ?? base.presetId,
  };
}

function assertNoKnowledgeKey(enabledRaw?: string[] | null) {
  if (
    process.env.NODE_ENV !== "production" &&
    Array.isArray(enabledRaw) &&
    enabledRaw.includes("knowledge")
  ) {
    throw new Error("Invalid category key 'knowledge'. Use 'reading'.");
  }
}

export function clearEnabledVariablesForDomains(
  config: GoalConfig,
  domains: GoalCategoryKey[]
): GoalConfig {
  const next = {
    ...config,
    categories: { ...config.categories },
  };
  domains.forEach((category) => {
    next.categories[category] = {
      ...next.categories[category],
      enabled: [],
    };
  });
  return next;
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
    description: "Baseline across exercise, sleep, diet, and knowledge.",
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
        community: {
          enabled: [],
          targets: { calls_weekly: 1, social_events_weekly: 1 },
        },
      },
      presetId: "75-hard",
    },
  },
  {
    id: "75-soft",
    name: "75 Soft",
    description: "Progressive structure with sustainable targets.",
    config: {
      enabledCategories: ["exercise", "diet", "reading", "sleep", "community"],
      categories: {
        ...getDefaultGoals(),
        exercise: {
          enabled: ["minutes", "workouts_logged"],
          targets: { minutes: 45, workouts_logged: 1 },
        },
        diet: {
          enabled: ["meals_cooked_percent", "healthiness_self_rating"],
          targets: { meals_cooked_percent: 80, healthiness_self_rating: 7 },
        },
        reading: {
          enabled: ["pages"],
          targets: { pages: 10 },
        },
        sleep: {
          enabled: ["hours"],
          targets: { hours: 7.5 },
        },
        community: {
          enabled: ["calls_weekly", "social_events_weekly"],
          targets: { calls_weekly: 1, social_events_weekly: 1 },
        },
      },
      presetId: "75-soft",
    },
  },
  {
    id: "jacks-standard",
    name: "Jack’s Standard",
    description: "High-output daily baseline with knowledge and community focus.",
    config: {
      enabledCategories: ["exercise", "sleep", "diet", "reading", "community"],
      categories: {
        ...getDefaultGoals(),
        exercise: {
          enabled: ["minutes", "steps"],
          targets: { minutes: 60, steps: 9000 },
        },
        diet: {
          enabled: ["meals_cooked_percent"],
          targets: { meals_cooked_percent: 90 },
        },
        reading: {
          enabled: ["pages"],
          targets: { pages: 20 },
        },
        sleep: {
          enabled: ["hours"],
          targets: { hours: 7.5 },
        },
        community: {
          enabled: ["calls_weekly"],
          targets: { calls_weekly: 1, social_events_weekly: 1 },
        },
      },
      presetId: "jacks-standard",
    },
  },
  {
    id: "operator-baseline",
    name: "Operator Baseline",
    description: "Performance-focused conditioning and recovery.",
    config: {
      enabledCategories: ["exercise", "sleep", "diet"],
      categories: {
        ...getDefaultGoals(),
        exercise: {
          enabled: ["minutes", "calories_burned", "workouts_logged"],
          targets: { minutes: 75, calories_burned: 700, workouts_logged: 1 },
        },
        diet: {
          enabled: ["meals_cooked_percent", "protein_grams"],
          targets: { meals_cooked_percent: 90, protein_grams: 160 },
        },
        sleep: {
          enabled: ["hours"],
          targets: { hours: 8 },
        },
        reading: {
          enabled: [],
          targets: { pages: 10 },
        },
        community: {
          enabled: [],
          targets: { calls_weekly: 1, social_events_weekly: 1 },
        },
      },
      presetId: "operator-baseline",
    },
  },
  {
    id: "scholars-track",
    name: "Scholar’s Track",
    description: "Knowledge-heavy focus with recovery and minimal exercise.",
    config: {
      enabledCategories: ["reading", "sleep", "exercise"],
      categories: {
        ...getDefaultGoals(),
        reading: {
          enabled: ["pages"],
          targets: { pages: 40 },
        },
        sleep: {
          enabled: ["hours"],
          targets: { hours: 8 },
        },
        exercise: {
          enabled: ["minutes"],
          targets: { minutes: 30 },
        },
        diet: {
          enabled: [],
          targets: { meals_cooked_percent: 100 },
        },
        community: {
          enabled: [],
          targets: { calls_weekly: 1, social_events_weekly: 1 },
        },
      },
      presetId: "scholars-track",
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
    {
      key: "workouts_logged_weekly",
      label: "Workouts (weekly)",
      hint: "Total workouts per week",
    },
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
  community: [
    {
      key: "calls_weekly",
      label: "Calls (weekly)",
      hint: "Calls to friends or family per week",
    },
    {
      key: "social_events_weekly",
      label: "Social events (weekly)",
      hint: "Social events attended per week",
    },
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
