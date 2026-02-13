import { supabase } from "@/lib/supabase";
import type { DrinkingEvent } from "@/lib/types";
import { checkAndAward007Badge } from "@/lib/badges";

export async function listDrinkingEvents(userId: string, date: string) {
  const { data, error } = await supabase
    .from("drinking_events")
    .select("id, user_id, date, tier, drinks, note, created_at")
    .eq("user_id", userId)
    .eq("date", date)
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data ?? []) as DrinkingEvent[];
}

export async function createDrinkingEvent(
  event: Omit<DrinkingEvent, "id" | "created_at">
) {
  const { data, error } = await supabase
    .from("drinking_events")
    .insert(event)
    .select("id, user_id, date, tier, drinks, note, created_at")
    .single();

  if (error) return undefined;
  checkAndAward007Badge(event.user_id);
  return data as DrinkingEvent;
}

export async function deleteDrinkingEvent(id: string) {
  const { error } = await supabase.from("drinking_events").delete().eq("id", id);
  if (!error) {
    // Deleting doesn't revoke badges; this keeps badge state consistent.
  }
  return !error;
}

export async function updateDrinkingEvent(
  id: string,
  patch: Partial<Pick<DrinkingEvent, "tier" | "drinks" | "note">>
) {
  const { data, error } = await supabase
    .from("drinking_events")
    .update(patch)
    .eq("id", id)
    .select("id, user_id, date, tier, drinks, note, created_at")
    .single();

  if (error) return undefined;
  if (data?.user_id) {
    checkAndAward007Badge(data.user_id);
  }
  return data as DrinkingEvent;
}
