import { supabase } from "@/lib/supabase";
import { addDays, toDateKey } from "@/lib/utils";
import type { Badge, UserBadge } from "@/lib/types";

export const BADGE_007_ID = "bond_007";

export const BADGE_007: Badge = {
  id: BADGE_007_ID,
  name: "007",
  description:
    "James Bond is the ultimate operator. This badge is earned by logging 7 days in a row. You are still early on your journey, but you are on the right track. Perhaps a vesper martini to celebrate? Shaken, of course.",
  icon_key: "007",
};

export function computeConsecutiveLoggedDays(dateKeys: string[]): number {
  if (dateKeys.length === 0) return 0;
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
  return maxRun;
}

export async function checkAndAward007Badge(userId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("user_badges")
    .select("id")
    .eq("user_id", userId)
    .eq("badge_id", BADGE_007_ID)
    .maybeSingle();

  if (existing || existingError) return;

  const today = new Date();
  const start = addDays(today, -45);
  const startKey = toDateKey(start);

  const { data: logs } = await supabase
    .from("daily_logs")
    .select("date")
    .eq("user_id", userId)
    .gte("date", startKey);

  const { data: drinks } = await supabase
    .from("drinking_events")
    .select("date")
    .eq("user_id", userId)
    .gte("date", startKey);

  const dateKeys = [
    ...(logs ?? []).map((row: any) => String(row.date)),
    ...(drinks ?? []).map((row: any) => String(row.date)),
  ];

  const maxRun = computeConsecutiveLoggedDays(dateKeys);
  if (maxRun < 7) return;

  await supabase
    .from("user_badges")
    .upsert({ user_id: userId, badge_id: BADGE_007_ID }, { onConflict: "user_id,badge_id" });
}

export async function getUserBadges(userId: string) {
  const { data, error } = await supabase
    .from("user_badges")
    .select("id, user_id, badge_id, earned_at, badges(id, name, description, icon_key)")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });

  if (error) return [] as UserBadge[];
  return (data ?? []) as UserBadge[];
}
