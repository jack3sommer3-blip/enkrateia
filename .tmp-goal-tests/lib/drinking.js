"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDrinkingEvents = listDrinkingEvents;
exports.createDrinkingEvent = createDrinkingEvent;
exports.deleteDrinkingEvent = deleteDrinkingEvent;
exports.updateDrinkingEvent = updateDrinkingEvent;
const supabase_1 = require("@/lib/supabase");
async function listDrinkingEvents(userId, date) {
    const { data, error } = await supabase_1.supabase
        .from("drinking_events")
        .select("id, user_id, date, tier, drinks, note, created_at")
        .eq("user_id", userId)
        .eq("date", date)
        .order("created_at", { ascending: true });
    if (error)
        return [];
    return (data ?? []);
}
async function createDrinkingEvent(event) {
    const { data, error } = await supabase_1.supabase
        .from("drinking_events")
        .insert(event)
        .select("id, user_id, date, tier, drinks, note, created_at")
        .single();
    if (error)
        return undefined;
    return data;
}
async function deleteDrinkingEvent(id) {
    const { error } = await supabase_1.supabase.from("drinking_events").delete().eq("id", id);
    return !error;
}
async function updateDrinkingEvent(id, patch) {
    const { data, error } = await supabase_1.supabase
        .from("drinking_events")
        .update(patch)
        .eq("id", id)
        .select("id, user_id, date, tier, drinks, note, created_at")
        .single();
    if (error)
        return undefined;
    return data;
}
