import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, bio, avatar_url, location, website, created_at, first_name, last_name"
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
      "id, username, display_name, bio, avatar_url, location, website, created_at, first_name, last_name"
    )
    .eq("username", username)
    .single();

  if (error) return undefined;
  return data as Profile;
}
