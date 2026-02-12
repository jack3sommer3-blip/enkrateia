"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = getProfile;
exports.getProfileByUsername = getProfileByUsername;
const supabase_1 = require("@/lib/supabase");
async function getProfile(userId) {
    const { data, error } = await supabase_1.supabase
        .from("profiles")
        .select("id, username, display_name, bio, profile_photo_url, is_public, show_workouts, show_reading, show_drinking, created_at, first_name, last_name")
        .eq("id", userId)
        .single();
    if (error)
        return undefined;
    return data;
}
async function getProfileByUsername(username) {
    const { data, error } = await supabase_1.supabase
        .from("profiles")
        .select("id, username, display_name, bio, profile_photo_url, is_public, show_workouts, show_reading, show_drinking, created_at, first_name, last_name")
        .eq("username", username)
        .single();
    if (error)
        return undefined;
    return data;
}
