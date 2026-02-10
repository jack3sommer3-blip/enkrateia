import { supabase } from "@/lib/supabase";
import type { Comment, FeedItem, Follow, Like, Profile } from "@/lib/types";

export async function searchUsers(query: string) {
  if (!query.trim()) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, bio, profile_photo_url, is_public, show_workouts, show_reading, show_drinking"
    )
    .ilike("username", `${query.toLowerCase()}%`)
    .order("username", { ascending: true })
    .limit(20);

  if (error) return [];
  return (data ?? []) as Profile[];
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

export async function followUser(followerId: string, followingId: string) {
  const { data, error } = await supabase
    .from("follows")
    .insert({ follower_id: followerId, following_id: followingId })
    .select("follower_id, following_id, created_at")
    .single();
  if (error) return undefined;
  return data as Follow;
}

export async function unfollowUser(followerId: string, followingId: string) {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("following_id", followingId)
    .eq("follower_id", followerId);
  return !error;
}

export async function listFollowers(userId: string) {
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id, following_id, created_at, profiles:follower_id(id, username, display_name, profile_photo_url)")
    .eq("following_id", userId);
  if (error) return [];
  return data ?? [];
}

export async function listFollowing(userId: string) {
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id, following_id, created_at, profiles:following_id(id, username, display_name, profile_photo_url)")
    .eq("follower_id", userId);
  if (error) return [];
  return data ?? [];
}

export async function getFeed(userIds: string[]) {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from("feed_items")
    .select(
      "id, user_id, created_at, event_date, event_type, event_id, summary, metadata, profiles:user_id(username, display_name, profile_photo_url)"
    )
    .in("user_id", userIds)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return data ?? [];
}

export async function getUserFeed(userId: string) {
  const { data, error } = await supabase
    .from("feed_items")
    .select(
      "id, user_id, created_at, event_date, event_type, event_id, summary, metadata"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return [];
  return data as FeedItem[];
}

export async function upsertFeedItem(input: {
  user_id: string;
  event_date: string;
  event_type: "workout" | "reading" | "drinking";
  event_id: string;
  summary: string;
  metadata: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from("feed_items")
    .insert(input)
    .select("id, user_id, created_at, event_date, event_type, event_id, summary, metadata")
    .single();
  if (error) return undefined;
  return data as FeedItem;
}

export async function updateFeedItemByEvent(
  eventType: FeedItem["event_type"],
  eventId: string,
  patch: Partial<Pick<FeedItem, "summary" | "metadata">>
) {
  const { data, error } = await supabase
    .from("feed_items")
    .update(patch)
    .eq("event_type", eventType)
    .eq("event_id", eventId)
    .select("id, user_id, created_at, event_date, event_type, event_id, summary, metadata")
    .single();
  if (error) return undefined;
  return data as FeedItem;
}

export async function deleteFeedItemByEvent(
  eventType: FeedItem["event_type"],
  eventId: string
) {
  const { error } = await supabase
    .from("feed_items")
    .delete()
    .eq("event_type", eventType)
    .eq("event_id", eventId);
  return !error;
}

export async function toggleLike(feedItemId: string, liked: boolean, userId: string) {
  if (liked) {
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("feed_item_id", feedItemId)
      .eq("user_id", userId);
    return !error;
  }
  const { data, error } = await supabase
    .from("likes")
    .insert({ feed_item_id: feedItemId, user_id: userId })
    .select("user_id, feed_item_id, created_at")
    .single();
  if (error) return undefined;
  return data as Like;
}

export async function addComment(feedItemId: string, body: string, userId: string) {
  const { data, error } = await supabase
    .from("comments")
    .insert({ feed_item_id: feedItemId, body, user_id: userId })
    .select("id, user_id, feed_item_id, body, created_at")
    .single();
  if (error) return undefined;
  return data as Comment;
}

export async function deleteComment(commentId: string) {
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  return !error;
}

export async function listComments(feedItemId: string) {
  const { data, error } = await supabase
    .from("comments")
    .select("id, user_id, feed_item_id, body, created_at, profiles:user_id(username, display_name, profile_photo_url)")
    .eq("feed_item_id", feedItemId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function getLikesForFeed(feedItemIds: string[]) {
  if (feedItemIds.length === 0) return [];
  const { data, error } = await supabase
    .from("likes")
    .select("user_id, feed_item_id")
    .in("feed_item_id", feedItemIds);
  if (error) return [];
  return (data ?? []) as Like[];
}
