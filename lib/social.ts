import { supabase } from "@/lib/supabase";
import type { Comment, FeedItem, Follow, Like, Profile, DayData, ReadingEvent, WorkoutActivity } from "@/lib/types";
import { addDays, intFromText, toDateKey } from "@/lib/utils";

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
    .upsert(input, { onConflict: "user_id,event_type,event_id" })
    .select("id, user_id, created_at, event_date, event_type, event_id, summary, metadata")
    .single();
  if (error) return undefined;
  return data as FeedItem;
}

function stableUuid(seed: string) {
  const hash = (input: string, seedNum: number) => {
    let h = seedNum >>> 0;
    for (let i = 0; i < input.length; i += 1) {
      h = Math.imul(h ^ input.charCodeAt(i), 0x5bd1e995);
      h = (h >>> 0) ^ (h >>> 13);
    }
    return h >>> 0;
  };
  const h1 = hash(seed, 0x1234abcd).toString(16).padStart(8, "0");
  const h2 = hash(seed, 0x9e3779b1).toString(16).padStart(8, "0");
  const h3 = hash(seed, 0x7f4a7c15).toString(16).padStart(8, "0");
  const h4 = hash(seed, 0xcafef00d).toString(16).padStart(8, "0");
  const hex = `${h1}${h2}${h3}${h4}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20, 32)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ensureUuid(value: string | undefined, seed: string) {
  if (value && UUID_RE.test(value)) return value;
  return stableUuid(seed);
}

function workoutSummary(activity: WorkoutActivity) {
  const minutes = intFromText(activity.minutesText) ?? 0;
  const seconds = intFromText(activity.secondsText) ?? 0;
  const intensity = intFromText(activity.intensityText);
  const timeLabel =
    minutes > 0
      ? `${minutes} min`
      : seconds > 0
        ? `${seconds} sec`
        : undefined;
  const parts = [activity.type, timeLabel, intensity ? `Intensity ${intensity}` : undefined].filter(
    Boolean
  );
  return parts.join(" • ");
}

function readingSummary(event: ReadingEvent) {
  const totalPages =
    event.pages ?? (event.fictionPages ?? 0) + (event.nonfictionPages ?? 0);
  const base = totalPages ? `Read ${totalPages} pages` : "Read";
  return event.title ? `${base} • ${event.title}` : base;
}

export async function backfillFeedItemsForUser(userId: string, days = 30) {
  const start = addDays(new Date(), -(Math.max(days, 1) - 1));
  const startKey = toDateKey(start);

  const { data: logs, error: logsError } = await supabase
    .from("daily_logs")
    .select("date,data")
    .eq("user_id", userId)
    .gte("date", startKey);

  if (logsError) return false;

  const items: Array<{
    user_id: string;
    event_date: string;
    event_type: "workout" | "reading" | "drinking";
    event_id: string;
    summary: string;
    metadata: Record<string, unknown>;
  }> = [];

  (logs ?? []).forEach((row: { date: string; data: DayData }) => {
    const data = row.data;
    const dateKey = row.date;

    const activities = data?.workouts?.activities ?? [];
    activities.forEach((activity, index) => {
      const eventId = ensureUuid(activity.id, `${dateKey}-workout-${index}`);
      items.push({
        user_id: userId,
        event_date: dateKey,
        event_type: "workout",
        event_id: eventId,
        summary: workoutSummary(activity),
        metadata: {
          activityType: activity.type,
          minutes: activity.minutesText,
          seconds: activity.secondsText,
          calories: activity.caloriesText,
          intensity: activity.intensityText,
        },
      });
    });

    const readingEvents = data?.reading?.events ?? [];
    if (readingEvents.length > 0) {
      readingEvents.forEach((event, index) => {
        const eventId = ensureUuid(event.id, `${dateKey}-reading-${index}`);
        items.push({
          user_id: userId,
          event_date: dateKey,
          event_type: "reading",
          event_id: eventId,
          summary: readingSummary(event),
          metadata: {
            title: event.title,
            pages: event.pages,
            fiction_pages: event.fictionPages,
            nonfiction_pages: event.nonfictionPages,
            quote: event.quote,
          },
        });
      });
    } else if (data?.reading?.title || data?.reading?.pagesText) {
      const pages = intFromText(data.reading.pagesText) ?? 0;
      const eventId = stableUuid(`${dateKey}-reading-legacy`);
      items.push({
        user_id: userId,
        event_date: dateKey,
        event_type: "reading",
        event_id: eventId,
        summary: readingSummary({
          id: eventId,
          title: data.reading.title,
          pages,
        }),
        metadata: {
          title: data.reading.title,
          pages,
        },
      });
    }
  });

  const { data: drinkingEvents, error: drinkingError } = await supabase
    .from("drinking_events")
    .select("id, date, tier, drinks, note")
    .eq("user_id", userId)
    .gte("date", startKey);

  if (!drinkingError && drinkingEvents) {
    drinkingEvents.forEach((event: any) => {
      items.push({
        user_id: userId,
        event_date: event.date,
        event_type: "drinking",
        event_id: event.id,
        summary: `Tier ${event.tier} • ${event.drinks} drinks`,
        metadata: {
          tier: event.tier,
          drinks: event.drinks,
          note: event.note,
        },
      });
    });
  }

  if (items.length === 0) return true;

  const { error: upsertError } = await supabase
    .from("feed_items")
    .upsert(items, { onConflict: "user_id,event_type,event_id" });

  return !upsertError;
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
