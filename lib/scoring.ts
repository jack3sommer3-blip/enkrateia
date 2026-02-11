import { DayData, DayScore, Goals, GoalConfig, DrinkingEvent, ReadingEvent } from "@/lib/types";
import { computeCategoryScore, getDefaultGoals, normalizeGoalConfig } from "@/lib/goals";
import { clampInt, intFromText, numFromText } from "@/lib/utils";

export function computeScores(
  data: DayData,
  goalsInput?: GoalConfig | Goals | null,
  drinkingEvents: DrinkingEvent[] = []
): DayScore {
  const defaultGoals = getDefaultGoals();
  const config = normalizeGoalConfig(goalsInput as GoalConfig | Goals | null);
  const goals = config.categories;
  const totalWorkoutMinutes = data.workouts.activities.reduce((sum, a) => {
    const minutes = intFromText(a.minutesText) ?? 0;
    const seconds = clampInt(intFromText(a.secondsText) ?? 0, 0, 59);
    return sum + minutes + seconds / 60;
  }, 0);
  const totalWorkoutCalories = data.workouts.activities.reduce(
    (sum, a) => sum + (numFromText(a.caloriesText) ?? 0),
    0
  );
  const workoutsLogged = data.workouts.activities.length;
  const steps = intFromText(data.workouts.stepsText) ?? 0;

  const sleepHours = numFromText(data.sleep.hoursText) ?? 0;
  const sleepMinutes = clampInt(intFromText(data.sleep.minutesText) ?? 0, 0, 59);
  const sleepTotalHours = sleepHours + sleepMinutes / 60;
  const cookedMeals = intFromText(data.diet.cookedMealsText) ?? 0;
  const restaurantMeals = intFromText(data.diet.restaurantMealsText) ?? 0;
  const totalMeals = cookedMeals + restaurantMeals;
  const readingEvents = (data.reading.events ?? []) as ReadingEvent[];
  const pagesReadRaw = intFromText(data.reading.pagesText) ?? 0;
  const fictionPagesRaw = intFromText(data.reading.fictionPagesText) ?? 0;
  const nonfictionPagesRaw = intFromText(data.reading.nonfictionPagesText) ?? 0;

  const eventPages = readingEvents.reduce(
    (sum, event) => sum + (event.pages ?? 0),
    0
  );
  const eventFictionPages = readingEvents.reduce(
    (sum, event) => sum + (event.fictionPages ?? 0),
    0
  );
  const eventNonfictionPages = readingEvents.reduce(
    (sum, event) => sum + (event.nonfictionPages ?? 0),
    0
  );

  const fictionPages = fictionPagesRaw || eventFictionPages;
  const nonfictionPages = nonfictionPagesRaw || eventNonfictionPages;
  const pagesRead = pagesReadRaw || eventPages || fictionPages + nonfictionPages;
  const healthiness = numFromText(data.diet.healthinessText) ?? 0;
  const protein = numFromText(data.diet.proteinText) ?? 0;

  const dietCookedPercent =
    totalMeals > 0 ? (cookedMeals / totalMeals) * 100 : 0;

  const exerciseRatio = computeCategoryScore(
    {
      minutes: totalWorkoutMinutes,
      calories_burned: totalWorkoutCalories,
      steps,
      workouts_logged: workoutsLogged,
    },
    goals.exercise,
    defaultGoals.exercise
  );

  const sleepRatio = computeCategoryScore(
    { hours: sleepTotalHours },
    goals.sleep,
    defaultGoals.sleep
  );

  const dietRatio = computeCategoryScore(
    {
      meals_cooked_percent: dietCookedPercent,
      healthiness_self_rating: healthiness,
      protein_grams: protein,
    },
    goals.diet,
    defaultGoals.diet
  );

  const readingRatio = computeCategoryScore(
    {
      pages: pagesRead,
      fiction_pages: fictionPages,
      nonfiction_pages: nonfictionPages,
    },
    goals.reading,
    defaultGoals.reading
  );

  const workoutScore = exerciseRatio * 25;
  const sleepScore = sleepRatio * 25;
  const dietScoreBase100 = dietRatio * 100;
  const penalty = calculateAlcoholPenalty(drinkingEvents);
  const dietScoreFinal100 = Math.max(0, dietScoreBase100 - penalty.total);
  const dietScore = (dietScoreFinal100 / 100) * 25;
  const readingScore = readingRatio * 25;

  const enabledCategories = config.enabledCategories;
  const ratios: Record<string, number> = {
    exercise: exerciseRatio,
    sleep: sleepRatio,
    diet: dietRatio,
    reading: readingRatio,
  };
  const enabledRatios = enabledCategories.map((key) => ratios[key] ?? 0);
  const overallRatio =
    enabledRatios.length > 0
      ? enabledRatios.reduce((sum, value) => sum + value, 0) / enabledRatios.length
      : 0;

  return {
    totalScore: overallRatio * 100,
    workoutScore: enabledCategories.includes("exercise") ? workoutScore : 0,
    sleepScore: enabledCategories.includes("sleep") ? sleepScore : 0,
    dietScore: enabledCategories.includes("diet") ? dietScore : 0,
    readingScore: enabledCategories.includes("reading") ? readingScore : 0,
    dietScoreBase100,
    dietScoreFinal100,
    dietPenaltyTotal: penalty.total,
    dietPenaltyTier2: penalty.tier2,
    dietPenaltyTier3: penalty.tier3,
  };
}

function calculateAlcoholPenalty(events: DrinkingEvent[]) {
  let tier2Drinks = 0;
  let tier3Drinks = 0;

  events.forEach((event) => {
    if (event.tier === 2) tier2Drinks += event.drinks;
    if (event.tier === 3) tier3Drinks += event.drinks;
  });

  const tier2Over = Math.max(0, tier2Drinks - 3);
  const tier2Penalty = tier2Over * 5;

  let tier3Penalty = 0;
  if (tier3Drinks <= 3) {
    tier3Penalty = tier3Drinks * 3;
  } else {
    tier3Penalty = 3 * 3 + (tier3Drinks - 3) * 7;
  }

  return {
    total: tier2Penalty + tier3Penalty,
    tier2: tier2Penalty,
    tier3: tier3Penalty,
    tier2Drinks,
    tier3Drinks,
  };
}
