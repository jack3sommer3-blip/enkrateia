import type { Goals } from "@/lib/types";

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
