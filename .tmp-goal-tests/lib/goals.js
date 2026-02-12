"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GOAL_OPTIONS = exports.GOAL_PRESETS = exports.GOAL_BOUNDS = exports.GOAL_CATEGORY_LABELS = exports.GOAL_CATEGORIES = void 0;
exports.getDefaultGoals = getDefaultGoals;
exports.getDefaultGoalConfig = getDefaultGoalConfig;
exports.normalizeGoals = normalizeGoals;
exports.normalizeGoalConfig = normalizeGoalConfig;
exports.clearEnabledVariablesForDomains = clearEnabledVariablesForDomains;
exports.getPresetConfig = getPresetConfig;
exports.computeCategoryScore = computeCategoryScore;
exports.runGoalsSelfTest = runGoalsSelfTest;
exports.GOAL_CATEGORIES = [
    "exercise",
    "sleep",
    "diet",
    "reading",
    "community",
];
exports.GOAL_CATEGORY_LABELS = {
    exercise: "Exercise",
    sleep: "Sleep",
    diet: "Diet",
    reading: "Knowledge",
    community: "Community",
};
const DEFAULT_GOALS = {
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
        targets: {},
    },
};
exports.GOAL_BOUNDS = {
    minutes: { min: 1, max: 240 },
    calories_burned: { min: 1, max: 3000 },
    steps: { min: 100, max: 50000 },
    workouts_logged: { min: 1, max: 10 },
    workouts_logged_weekly: { min: 1, max: 20 },
    hours: { min: 1, max: 16 },
    meals_cooked_percent: { min: 0, max: 100 },
    healthiness_self_rating: { min: 1, max: 10 },
    protein_grams: { min: 1, max: 400 },
    water_oz: { min: 0, max: 300 },
    pages: { min: 1, max: 500 },
    fiction_pages: { min: 1, max: 500 },
    nonfiction_pages: { min: 1, max: 500 },
    pages_weekly: { min: 1, max: 5000 },
    calls_friends_weekly: { min: 0, max: 14 },
    calls_family_weekly: { min: 0, max: 14 },
    social_events_weekly: { min: 0, max: 14 },
};
function clampTarget(key, value) {
    const bounds = exports.GOAL_BOUNDS[key];
    if (!bounds)
        return value;
    return Math.max(bounds.min, Math.min(bounds.max, value));
}
function getDefaultGoals() {
    return JSON.parse(JSON.stringify(DEFAULT_GOALS));
}
function getDefaultGoalConfig() {
    return {
        enabledCategories: ["exercise", "sleep", "diet", "reading"],
        categories: getDefaultGoals(),
        presetId: "default",
    };
}
function normalizeGoals(input) {
    const base = getDefaultGoals();
    if (!input)
        return base;
    ["exercise", "sleep", "diet", "reading", "community"].forEach((category) => {
        const incoming = input[category];
        if (!incoming)
            return;
        if (Array.isArray(incoming.enabled)) {
            const cleaned = incoming.enabled.filter(Boolean);
            if (category === "community" && cleaned.includes("calls_weekly")) {
                base[category].enabled = cleaned
                    .filter((key) => key !== "calls_weekly")
                    .concat("calls_friends_weekly");
            }
            else {
                base[category].enabled = cleaned;
            }
        }
        if (incoming.targets && typeof incoming.targets === "object") {
            Object.entries(incoming.targets).forEach(([key, value]) => {
                if (typeof value !== "number" || !Number.isFinite(value))
                    return;
                if (category === "community" && key === "calls_weekly") {
                    if (base[category].targets.calls_friends_weekly === undefined) {
                        base[category].targets.calls_friends_weekly = clampTarget("calls_friends_weekly", value);
                    }
                    return;
                }
                base[category].targets[key] = clampTarget(key, value);
            });
        }
    });
    return base;
}
function normalizeGoalConfig(input, enabledCategoriesOverride) {
    const base = getDefaultGoalConfig();
    if (!input)
        return base;
    const maybeGoals = input.categories ??
        input.goals ??
        input;
    const categories = normalizeGoals(maybeGoals);
    const enabledRaw = input.enabledCategories ??
        input.enabled_categories ??
        enabledCategoriesOverride ??
        base.enabledCategories;
    assertNoKnowledgeKey(enabledRaw);
    const enabledCategories = (Array.isArray(enabledRaw) ? enabledRaw : [])
        .filter((key) => exports.GOAL_CATEGORIES.includes(key));
    return {
        enabledCategories: enabledCategories.length ? enabledCategories : base.enabledCategories,
        categories,
        presetId: input.presetId ?? input.preset ?? base.presetId,
    };
}
function assertNoKnowledgeKey(enabledRaw) {
    if (process.env.NODE_ENV !== "production" &&
        Array.isArray(enabledRaw) &&
        enabledRaw.includes("knowledge")) {
        throw new Error("Invalid category key 'knowledge'. Use 'reading'.");
    }
}
function clearEnabledVariablesForDomains(config, domains) {
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
exports.GOAL_PRESETS = [
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
        notes: [],
        config: {
            enabledCategories: ["exercise", "diet", "reading", "sleep"],
            categories: {
                ...getDefaultGoals(),
                exercise: {
                    enabled: ["minutes", "workouts_logged", "steps"],
                    targets: { minutes: 90, workouts_logged: 2, steps: 10000 },
                },
                diet: {
                    enabled: ["meals_cooked_percent", "healthiness_self_rating", "water_oz"],
                    targets: { meals_cooked_percent: 100, healthiness_self_rating: 9, water_oz: 128 },
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
                    targets: { calls_friends_weekly: 1, calls_family_weekly: 1, social_events_weekly: 1 },
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
                    enabled: ["calls_friends_weekly", "calls_family_weekly", "social_events_weekly"],
                    targets: { calls_friends_weekly: 1, calls_family_weekly: 1, social_events_weekly: 1 },
                },
            },
            presetId: "75-soft",
        },
    },
    {
        id: "jacks-standard",
        name: "Jack’s targets",
        description: "Jack’s current targets across training, sleep, diet, knowledge.",
        config: {
            enabledCategories: ["exercise", "sleep", "diet", "reading", "community"],
            categories: {
                ...getDefaultGoals(),
                exercise: {
                    enabled: ["minutes", "steps"],
                    targets: { minutes: 60, steps: 10000 },
                },
                diet: {
                    enabled: ["healthiness_self_rating"],
                    targets: { healthiness_self_rating: 9 },
                },
                reading: {
                    enabled: ["pages"],
                    targets: { pages: 25 },
                },
                sleep: {
                    enabled: ["hours"],
                    targets: { hours: 8 },
                },
                community: {
                    enabled: [],
                    targets: { calls_friends_weekly: 1, calls_family_weekly: 1, social_events_weekly: 1 },
                },
            },
            presetId: "jacks-standard",
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
                    targets: { calls_friends_weekly: 1, calls_family_weekly: 1, social_events_weekly: 1 },
                },
            },
            presetId: "scholars-track",
        },
    },
];
function getPresetConfig(presetId) {
    const preset = exports.GOAL_PRESETS.find((p) => p.id === presetId);
    return preset ? normalizeGoalConfig(preset.config) : getDefaultGoalConfig();
}
exports.GOAL_OPTIONS = {
    exercise: [
        { key: "minutes", label: "Minutes", hint: "Total exercise minutes", cadence: "daily" },
        { key: "calories_burned", label: "Calories", hint: "Calories burned", cadence: "daily" },
        { key: "steps", label: "Steps", hint: "Daily steps", cadence: "daily" },
        { key: "workouts_logged", label: "Workouts logged", hint: "Count of workouts", cadence: "daily" },
        {
            key: "workouts_logged_weekly",
            label: "Workouts (weekly)",
            hint: "Total workouts per week",
            cadence: "weekly",
        },
    ],
    sleep: [{ key: "hours", label: "Hours", hint: "Total sleep hours", cadence: "daily" }],
    diet: [
        {
            key: "meals_cooked_percent",
            label: "Cooked meals %",
            hint: "Percent of meals cooked at home",
            cadence: "daily",
        },
        {
            key: "healthiness_self_rating",
            label: "Healthiness (1–10)",
            hint: "Self rating",
            cadence: "daily",
        },
        { key: "protein_grams", label: "Protein grams", hint: "Daily protein", cadence: "daily" },
        { key: "water_oz", label: "Water (oz)", hint: "Daily water intake", cadence: "daily" },
    ],
    reading: [
        { key: "pages", label: "Pages", hint: "Total pages read", cadence: "daily" },
        { key: "pages_weekly", label: "Pages (weekly)", hint: "Total pages per week", cadence: "weekly" },
        { key: "fiction_pages", label: "Fiction pages", hint: "Fiction only", cadence: "daily" },
        { key: "nonfiction_pages", label: "Non-fiction pages", hint: "Non-fiction only", cadence: "daily" },
    ],
    community: [
        {
            key: "calls_friends_weekly",
            label: "Friend calls (weekly)",
            hint: "Calls to friends per week",
            cadence: "weekly",
        },
        {
            key: "calls_family_weekly",
            label: "Family calls (weekly)",
            hint: "Calls to family per week",
            cadence: "weekly",
        },
        {
            key: "social_events_weekly",
            label: "Social events (weekly)",
            hint: "Social events attended per week",
            cadence: "weekly",
        },
    ],
};
function computeCategoryScore(actuals, goals, fallback) {
    const enabled = goals.enabled.length ? goals.enabled : fallback.enabled;
    const targets = { ...fallback.targets, ...goals.targets };
    if (!enabled.length)
        return 0;
    let total = 0;
    let counted = 0;
    enabled.forEach((key) => {
        const actual = actuals[key] ?? 0;
        const target = targets[key];
        if (typeof target !== "number" || !Number.isFinite(target) || target <= 0) {
            if (process.env.NODE_ENV !== "production" && Number.isNaN(target)) {
                console.warn("[goals] NaN target for", key);
            }
            return;
        }
        if (process.env.NODE_ENV !== "production" && !Number.isFinite(actual)) {
            console.warn("[goals] NaN actual for", key);
            return;
        }
        total += Math.min(actual / target, 1);
        counted += 1;
    });
    return counted ? total / counted : 0;
}
function runGoalsSelfTest() {
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
