export type ActivityType =
  | "Running"
  | "Walking"
  | "Treadmill Walking"
  | "Weight Lifting"
  | "Cycling"
  | "HIIT"
  | "Yoga";

export type WorkoutActivity = {
  id: string;
  type: ActivityType;
  minutesText?: string;
  secondsText?: string;
  caloriesText?: string;
  intensityText?: string; // 1–9
};

export type DayData = {
  workouts: {
    activities: WorkoutActivity[];
  };
  sleep: {
    hoursText?: string;
    minutesText?: string;
    restingHrText?: string;
  };
  diet: {
    cookedMealsText?: string;
    restaurantMealsText?: string;
  };
  reading: {
    title?: string;
    pagesText?: string;
    note?: string;
    quote?: string;
  };
};

export type DayScore = {
  totalScore: number;
  workoutScore: number;
  sleepScore: number;
  dietScore: number;
  readingScore: number;
};
