import { supabase } from "@/lib/supabase";

export type Profile = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
};

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, first_name, last_name")
    .eq("id", userId)
    .single();

  if (error) return undefined;
  return data as Profile;
}
