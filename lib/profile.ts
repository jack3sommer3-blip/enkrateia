import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, bio, profile_photo_url, is_public, show_workouts, show_reading, show_drinking, created_at, first_name, last_name"
    )
    .eq("id", userId)
    .single();

  if (error) return undefined;
  return data as Profile;
}

export async function getProfileByUsername(username: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, bio, profile_photo_url, is_public, show_workouts, show_reading, show_drinking, created_at, first_name, last_name"
    )
    .eq("username", username)
    .single();

  if (error) return undefined;
  return data as Profile;
}
