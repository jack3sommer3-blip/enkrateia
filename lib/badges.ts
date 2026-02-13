import { supabase } from "@/lib/supabase";
import { addDays, intFromText, numFromText, toDateKey } from "@/lib/utils";
import type { Badge, UserBadge } from "@/lib/types";

export const BADGE_007_ID = "bond_007";

export const BADGE_007: Badge = {
  id: BADGE_007_ID,
  name: "007",
  description:
    "James Bond is the ultimate operator. This badge is earned by logging 7 days in a row. You are still early on your journey, but you are on the right track. Perhaps a vesper martini to celebrate? Shaken, of course.",
  icon_key: "007",
};

type DailyLogRow = {
  date: string;
  steps: number | null;
  data: any;
};

type DrinkingRow = {
  date: string;
  drinks: number | null;
};

function isValidWorkout(activity: any) {
  const minutes = intFromText(activity?.minutesText) ?? 0;
  const seconds = intFromText(activity?.secondsText) ?? 0;
  const calories = intFromText(activity?.caloriesText) ?? 0;
  const intensity = intFromText(activity?.intensityText) ?? 0;
  return minutes > 0 || seconds > 0 || calories > 0 || intensity > 0;
}

function isValidReading(event: any) {
  const total =
    event?.pages ?? (event?.fictionPages ?? 0) + (event?.nonfictionPages ?? 0);
  return (total ?? 0) > 0 || !!event?.title;
}

function isMeaningfulDailyLog(row: DailyLogRow) {
  const data = row.data ?? {};

  const steps = Number(row.steps ?? 0);
  if (steps > 0) return true;

  const workouts = data.workouts?.activities ?? [];
  if (Array.isArray(workouts) && workouts.some(isValidWorkout)) return true;

  const sleepHours = numFromText(data.sleep?.hoursText) ?? 0;
  const sleepMinutes = intFromText(data.sleep?.minutesText) ?? 0;
  const resting = intFromText(data.sleep?.restingHrText) ?? 0;
  if (sleepHours > 0 || sleepMinutes > 0 || resting > 0) return true;

  const cooked = intFromText(data.diet?.cookedMealsText) ?? 0;
  const restaurant = intFromText(data.diet?.restaurantMealsText) ?? 0;
  const health = numFromText(data.diet?.healthinessText) ?? 0;
  const protein = intFromText(data.diet?.proteinText) ?? 0;
  const water = intFromText(data.diet?.waterOzText) ?? 0;
  if (cooked > 0 || restaurant > 0 || health > 0 || protein > 0 || water > 0)
    return true;

  const readingEvents = data.reading?.events ?? [];
  if (Array.isArray(readingEvents) && readingEvents.some(isValidReading)) return true;
  if (data.reading?.title || (intFromText(data.reading?.pagesText) ?? 0) > 0)
    return true;

  const calls = intFromText(data.community?.callsFriendsText) ??
    intFromText(data.community?.callsText) ??
    0;
  const callsFamily = intFromText(data.community?.callsFamilyText) ?? 0;
  const socialEvents = intFromText(data.community?.socialEventsText) ?? 0;
  if (calls > 0 || callsFamily > 0 || socialEvents > 0) return true;

  return false;
}

export async function getActiveDateKeys(userId: string) {
  const today = new Date();
  const start = addDays(today, -120);
  const startKey = toDateKey(start);

  const { data: logs } = await supabase
    .from("daily_logs")
    .select("date, steps, data")
    .eq("user_id", userId)
    .gte("date", startKey);

  const { data: drinks } = await supabase
    .from("drinking_events")
    .select("date, drinks")
    .eq("user_id", userId)
    .gte("date", startKey);

  const active = new Set<string>();

  (logs ?? []).forEach((row: DailyLogRow) => {
    if (row?.date && isMeaningfulDailyLog(row)) {
      active.add(String(row.date));
    }
  });

  const drinksByDate = new Map<string, number>();
  (drinks ?? []).forEach((row: DrinkingRow) => {
    if (!row?.date) return;
    const key = String(row.date);
    const count = drinksByDate.get(key) ?? 0;
    drinksByDate.set(key, count + Number(row.drinks ?? 0));
  });

  drinksByDate.forEach((total, key) => {
    if (total > 0) active.add(key);
  });

  return Array.from(active).sort();
}

export function computeLongestConsecutiveStreak(dateKeys: string[]) {
  if (dateKeys.length === 0) return { longest: 0, has7: false };
  const unique = Array.from(new Set(dateKeys)).sort();
  let maxRun = 0;
  let run = 0;
  let prevKey: string | null = null;
  for (const key of unique) {
    if (!prevKey) {
      run = 1;
    } else {
      const expected = toDateKey(addDays(new Date(`${prevKey}T00:00:00`), 1));
      run = key === expected ? run + 1 : 1;
    }
    if (run > maxRun) maxRun = run;
    prevKey = key;
  }
  return { longest: maxRun, has7: maxRun >= 7 };
}

export function shouldAward007(existing: boolean, has7: boolean) {
  return !existing && has7;
}

export async function checkAndAward007Badge(userId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("user_badges")
    .select("id")
    .eq("user_id", userId)
    .eq("badge_id", BADGE_007_ID)
    .maybeSingle();

  if (existing || existingError) return;

  const dateKeys = await getActiveDateKeys(userId);
  const { has7 } = computeLongestConsecutiveStreak(dateKeys);
  if (!shouldAward007(Boolean(existing), has7)) return;

  await supabase
    .from("user_badges")
    .upsert({ user_id: userId, badge_id: BADGE_007_ID }, { onConflict: "user_id,badge_id" });
}

export async function getUserBadges(userId: string) {
  type UserBadgeRow = {
    id: string;
    user_id: string;
    badge_id: string;
    earned_at: string;
    badges: Badge | Badge[] | null;
  };

  const { data, error } = await supabase
    .from("user_badges")
    .select(
      "id, user_id, badge_id, earned_at, badges!user_badges_badge_id_fkey(id, name, description, icon_key)"
    )
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });

  if (error || !data) return [];

  return (data as UserBadgeRow[])
    .map((row) => {
      const badge = Array.isArray(row.badges) ? row.badges[0] : row.badges;
      if (!badge) return null;
      return {
        id: row.id,
        user_id: row.user_id,
        badge_id: row.badge_id,
        earned_at: row.earned_at,
        badges: badge,
      } as UserBadge;
    })
    .filter((row): row is UserBadge => Boolean(row));
}
