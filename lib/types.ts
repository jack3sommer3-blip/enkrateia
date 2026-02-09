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
    stepsText?: string;
  };
  sleep: {
    hoursText?: string;
    minutesText?: string;
    restingHrText?: string;
  };
  diet: {
    cookedMealsText?: string;
    restaurantMealsText?: string;
    healthinessText?: string;
    proteinText?: string;
  };
  reading: {
    title?: string;
    pagesText?: string;
    fictionPagesText?: string;
    nonfictionPagesText?: string;
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

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  website: string | null;
  created_at: string | null;
  first_name: string;
  last_name: string;
};

export type GoalCategory = {
  enabled: string[];
  targets: Record<string, number>;
};

export type Goals = {
  exercise: GoalCategory;
  sleep: GoalCategory;
  diet: GoalCategory;
  reading: GoalCategory;
};
