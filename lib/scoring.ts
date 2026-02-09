import { DayData, DayScore } from "@/lib/types";
import { clampInt, intFromText, numFromText } from "@/lib/utils";

export function computeScores(data: DayData): DayScore {
  const totalWorkoutMinutes = data.workouts.activities.reduce((sum, a) => {
    const minutes = intFromText(a.minutesText) ?? 0;
    const seconds = clampInt(intFromText(a.secondsText) ?? 0, 0, 59);
    return sum + minutes + seconds / 60;
  }, 0);

  const sleepHours = numFromText(data.sleep.hoursText) ?? 0;
  const cookedMeals = intFromText(data.diet.cookedMealsText) ?? 0;
  const restaurantMeals = intFromText(data.diet.restaurantMealsText) ?? 0;
  const totalMeals = cookedMeals + restaurantMeals;
  const pagesRead = intFromText(data.reading.pagesText) ?? 0;

  const workoutScore = Math.min(totalWorkoutMinutes / 60, 1) * 25;
  const sleepScore = Math.min(sleepHours / 8, 1) * 25;
  const dietScore = totalMeals > 0 ? (cookedMeals / totalMeals) * 25 : 0;
  const readingScore = Math.min(pagesRead / 20, 1) * 25;

  return {
    totalScore: workoutScore + sleepScore + dietScore + readingScore,
    workoutScore,
    sleepScore,
    dietScore,
    readingScore,
  };
}
