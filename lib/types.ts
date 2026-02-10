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
    events?: ReadingEvent[];
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
  dietScoreBase100: number;
  dietScoreFinal100: number;
  dietPenaltyTotal: number;
  dietPenaltyTier2: number;
  dietPenaltyTier3: number;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  is_public: boolean;
  show_workouts: boolean;
  show_reading: boolean;
  show_drinking: boolean;
  created_at: string | null;
  first_name: string;
  last_name: string;
  location?: string | null;
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

export type DrinkingEvent = {
  id: string;
  user_id: string;
  date: string;
  tier: 1 | 2 | 3;
  drinks: number;
  note?: string | null;
  created_at?: string | null;
};

export type ReadingEvent = {
  id: string;
  title?: string;
  pages?: number;
  fictionPages?: number;
  nonfictionPages?: number;
  quote?: string;
  note?: string;
};

export type Follow = {
  follower_id: string;
  following_id: string;
  created_at?: string | null;
};

export type FeedItem = {
  id: string;
  user_id: string;
  created_at: string;
  event_date: string;
  event_type: "workout" | "reading" | "drinking";
  event_id: string;
  summary: string;
  metadata: Record<string, unknown>;
};

export type ActivityItem = {
  id: string;
  user_id: string;
  event_type: "workout" | "reading" | "drinking";
  event_id: string;
  event_date: string;
  created_at: string;
  summary: string;
  metadata: Record<string, unknown>;
  feed_item_id?: string;
  profile?: {
    username?: string | null;
    display_name?: string | null;
    profile_photo_url?: string | null;
  };
};

export type Like = {
  user_id: string;
  feed_item_id: string;
  created_at?: string | null;
};

export type Comment = {
  id: string;
  user_id: string;
  feed_item_id: string;
  body: string;
  created_at: string;
};
