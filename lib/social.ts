import { supabase } from "@/lib/supabase";
import type {
  Comment,
  FeedItem,
  Follow,
  Like,
  Profile,
  DayData,
  ReadingEvent,
  WorkoutActivity,
  ActivityItem,
  DrinkingEvent,
} from "@/lib/types";
import { addDays, intFromText, toDateKey } from "@/lib/utils";
import { computeScores } from "@/lib/scoring";

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

export async function ensureFeedItemIdForActivity(item: ActivityItem) {
  if (item.feed_item_id) return item.feed_item_id;
  const created = await upsertFeedItem({
    user_id: item.user_id,
    event_date: item.event_date,
    event_type: item.event_type,
    event_id: item.event_id,
    summary: item.summary,
    metadata: item.metadata ?? {},
  });
  return created?.id;
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

function isValidWorkout(activity: WorkoutActivity) {
  const minutes = intFromText(activity.minutesText) ?? 0;
  const seconds = intFromText(activity.secondsText) ?? 0;
  const calories = intFromText(activity.caloriesText) ?? 0;
  const intensity = intFromText(activity.intensityText) ?? 0;
  return minutes > 0 || seconds > 0 || calories > 0 || intensity > 0;
}

function isValidReading(event: ReadingEvent) {
  const totalPages =
    event.pages ?? (event.fictionPages ?? 0) + (event.nonfictionPages ?? 0);
  return (totalPages ?? 0) > 0 || !!event.title;
}

function isValidActivityItem(item: ActivityItem) {
  if (item.event_type === "workout") {
    const minutes = Number(item.metadata?.minutes ?? 0);
    const seconds = Number(item.metadata?.seconds ?? 0);
    const calories = Number(item.metadata?.calories ?? 0);
    const intensity = Number(item.metadata?.intensity ?? 0);
    return minutes > 0 || seconds > 0 || calories > 0 || intensity > 0;
  }
  if (item.event_type === "reading") {
    const pages = Number(item.metadata?.pages ?? 0);
    const fiction = Number(item.metadata?.fiction_pages ?? 0);
    const nonfiction = Number(item.metadata?.nonfiction_pages ?? 0);
    const title = String(item.metadata?.title ?? "").trim();
    return pages > 0 || fiction > 0 || nonfiction > 0 || !!title;
  }
  if (item.event_type === "drinking") {
    const drinks = Number(item.metadata?.drinks ?? 0);
    return drinks > 0;
  }
  return true;
}

export async function backfillFeedItemsForUser(
  userId: string,
  days = 30
): Promise<{ ok: boolean; error?: string }> {
  const start = addDays(new Date(), -(Math.max(days, 1) - 1));
  const startKey = toDateKey(start);

  const { data: logs, error: logsError } = await supabase
    .from("daily_logs")
    .select("date,data")
    .eq("user_id", userId)
    .gte("date", startKey);

  if (logsError) return { ok: false, error: logsError.message };

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
      if (!isValidWorkout(activity)) return;
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
        if (!isValidReading(event)) return;
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
      if (pages <= 0 && !data.reading.title) return;
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
      if (Number(event.drinks ?? 0) <= 0) return;
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

  if (items.length === 0) return { ok: true };

  const { error: upsertError } = await supabase
    .from("feed_items")
    .upsert(items, { onConflict: "user_id,event_type,event_id" });

  if (upsertError) return { ok: false, error: upsertError.message };
  return { ok: true };
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
    .insert({ feed_item_id: feedItemId, body, author_id: userId })
    .select("id, author_id, feed_item_id, body, created_at")
    .single();
  if (error) return { comment: undefined, error };
  return { comment: data as Comment, error: null };
}

export async function deleteComment(commentId: string) {
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  return !error;
}

export async function listComments(feedItemId: string) {
  const { data, error } = await supabase
    .from("comments")
    .select("id, author_id, feed_item_id, body, created_at, profiles:author_id(username, display_name, profile_photo_url)")
    .eq("feed_item_id", feedItemId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []).map((row: any) => ({
    ...row,
    profiles: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
  })) as Comment[];
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

type ActivityDebug = {
  userId: string;
  workoutCount7d: number;
  readingCount7d: number;
  drinkingCount7d: number;
  feedItemsCount30d: number;
  errors: string[];
};

function makeCreatedAt(dateKey: string) {
  return `${dateKey}T12:00:00.000Z`;
}

function activityFromWorkout(
  userId: string,
  dateKey: string,
  activity: WorkoutActivity,
  index: number,
  createdAt?: string | null
): ActivityItem {
  const eventId = ensureUuid(activity.id, `${dateKey}-workout-${index}`);
  return {
    id: eventId,
    user_id: userId,
    event_type: "workout",
    event_id: eventId,
    event_date: dateKey,
    created_at: createdAt ?? makeCreatedAt(dateKey),
    summary: workoutSummary(activity) || "Workout",
    metadata: {
      activityType: activity.type,
      minutes: activity.minutesText,
      seconds: activity.secondsText,
      calories: activity.caloriesText,
      intensity: activity.intensityText,
    },
  };
}

function activityFromReading(
  userId: string,
  dateKey: string,
  event: ReadingEvent,
  index: number,
  createdAt?: string | null
): ActivityItem {
  const eventId = ensureUuid(event.id, `${dateKey}-reading-${index}`);
  return {
    id: eventId,
    user_id: userId,
    event_type: "reading",
    event_id: eventId,
    event_date: dateKey,
    created_at: createdAt ?? makeCreatedAt(dateKey),
    summary: readingSummary(event) || "Reading",
    metadata: {
      title: event.title,
      pages: event.pages,
      fiction_pages: event.fictionPages,
      nonfiction_pages: event.nonfictionPages,
      quote: event.quote,
    },
  };
}

async function recomputeAndSaveDailyLog(
  userId: string,
  dateKey: string,
  dataValue: DayData
): Promise<{ ok: boolean; error?: string }> {
  const { data: goalsRow, error: goalsError } = await supabase
    .from("user_goals")
    .select("goals")
    .eq("user_id", userId)
    .maybeSingle();
  if (goalsError) return { ok: false, error: goalsError.message };

  const { data: drinkingRows, error: drinkingError } = await supabase
    .from("drinking_events")
    .select("id, user_id, date, tier, drinks, note")
    .eq("user_id", userId)
    .eq("date", dateKey);
  if (drinkingError) return { ok: false, error: drinkingError.message };

  const drinkingEvents = (drinkingRows ?? []) as DrinkingEvent[];
  const scores = computeScores(dataValue, goalsRow?.goals ?? null, drinkingEvents);
  const steps = intFromText(dataValue.workouts?.stepsText);

  const { error: saveError } = await supabase.from("daily_logs").upsert(
    {
      user_id: userId,
      date: dateKey,
      data: dataValue,
      steps: steps ?? null,
      total_score: scores.totalScore,
      workout_score: scores.workoutScore,
      sleep_score: scores.sleepScore,
      diet_score: scores.dietScore,
      reading_score: scores.readingScore,
    },
    { onConflict: "user_id,date" }
  );
  if (saveError) return { ok: false, error: saveError.message };
  return { ok: true };
}

export async function getSelfActivityStream(
  userId: string,
  days = 30
): Promise<{ items: ActivityItem[]; errors: string[] }> {
  const start = addDays(new Date(), -(Math.max(days, 1) - 1));
  const startKey = toDateKey(start);
  const errors: string[] = [];

  const { data: logs, error: logsError } = await supabase
    .from("daily_logs")
    .select("date,data,updated_at")
    .eq("user_id", userId)
    .gte("date", startKey);

  if (logsError) errors.push(logsError.message);

  const items: ActivityItem[] = [];

  (logs ?? []).forEach((row: { date: string; data: DayData; updated_at?: string | null }) => {
    const data = row.data;
    const dateKey = row.date;
    const fallbackCreatedAt = row.updated_at ?? undefined;

    const activities = data?.workouts?.activities ?? [];
    activities.forEach((activity, index) => {
      // Root cause (Bug 1): daily_logs.updated_at is shared; prefer per-event loggedAt when present.
      const activityCreatedAt = activity.loggedAt ?? fallbackCreatedAt;
      items.push(
        activityFromWorkout(userId, dateKey, activity, index, activityCreatedAt)
      );
    });

    const readingEvents = data?.reading?.events ?? [];
    if (readingEvents.length > 0) {
      readingEvents.forEach((event, index) => {
        const eventCreatedAt = event.loggedAt ?? fallbackCreatedAt;
        items.push(activityFromReading(userId, dateKey, event, index, eventCreatedAt));
      });
    } else if (data?.reading?.title || data?.reading?.pagesText) {
      const pages = intFromText(data.reading.pagesText) ?? 0;
      const eventId = stableUuid(`${dateKey}-reading-legacy`);
      items.push({
        id: eventId,
        user_id: userId,
        event_type: "reading",
        event_id: eventId,
        event_date: dateKey,
        created_at: fallbackCreatedAt ?? makeCreatedAt(dateKey),
        summary: readingSummary({
          id: eventId,
          title: data.reading.title,
          pages,
        }),
        metadata: { title: data.reading.title, pages },
      });
    }
  });

  const { data: drinkingEvents, error: drinkingError } = await supabase
    .from("drinking_events")
    .select("id, date, tier, drinks, note, created_at")
    .eq("user_id", userId)
    .gte("date", startKey);

  if (drinkingError) {
    errors.push(drinkingError.message);
  } else if (drinkingEvents) {
    drinkingEvents.forEach((event: any) => {
      items.push({
        id: event.id,
        user_id: userId,
        event_type: "drinking",
        event_id: event.id,
        event_date: event.date,
        created_at: event.created_at ?? makeCreatedAt(event.date),
        summary: `Tier ${event.tier} • ${event.drinks} drinks`,
        metadata: { tier: event.tier, drinks: event.drinks, note: event.note },
      });
    });
  }

  items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return { items, errors };
}

export async function getFeedActivityStream(
  userId: string,
  followedIds: string[],
  days = 30
): Promise<{ items: ActivityItem[]; errors: string[] }> {
  const errors: string[] = [];
  const start = addDays(new Date(), -(Math.max(days, 1) - 1));
  const startIso = start.toISOString();
  const { items: selfItemsRaw, errors: selfErrors } = await getSelfActivityStream(
    userId,
    days
  );
  errors.push(...selfErrors);
  const selfItems = selfItemsRaw.filter(isValidActivityItem);

  const allIds = Array.from(new Set([userId, ...followedIds]));
  const { data: feedItems, error: feedError } = await supabase
    .from("feed_items")
    .select(
      "id, user_id, created_at, event_date, event_type, event_id, summary, metadata, profiles:user_id(username, display_name, profile_photo_url)"
    )
    .in("user_id", allIds)
    .gte("created_at", startIso)
    .order("created_at", { ascending: false })
    .limit(100);

  if (feedError) errors.push(feedError.message);

  const feedActivity: ActivityItem[] = (feedItems ?? [])
    .filter((item: any) => item.user_id !== userId)
    .map((item: any) => ({
      id: item.id,
      user_id: item.user_id,
      event_type: item.event_type,
      event_id: item.event_id,
      event_date: item.event_date,
      created_at: item.created_at,
      summary: item.summary,
      metadata: item.metadata ?? {},
      feed_item_id: item.id,
      profile: item.profiles ?? undefined,
    }))
    .filter(isValidActivityItem);

  const feedMap = new Map<string, { id: string; created_at: string }>();
  const feedSignature = new Map<string, { id: string; created_at: string }>();
  (feedItems ?? []).forEach((item: any) => {
    const key = `${item.user_id}:${item.event_type}:${item.event_id}`;
    feedMap.set(key, { id: item.id, created_at: item.created_at });
    const signature = `${item.user_id}:${item.event_type}:${item.event_date}:${item.summary}`;
    feedSignature.set(signature, { id: item.id, created_at: item.created_at });
  });

  const selfWithFeed = selfItems.map((item) => {
    const key = `${item.user_id}:${item.event_type}:${item.event_id}`;
    const feedInfo = feedMap.get(key);
    if (feedInfo) {
      return { ...item, feed_item_id: feedInfo.id, created_at: feedInfo.created_at };
    }
    const signature = `${item.user_id}:${item.event_type}:${item.event_date}:${item.summary}`;
    const fallback = feedSignature.get(signature);
    return fallback
      ? { ...item, feed_item_id: fallback.id, created_at: fallback.created_at }
      : item;
  });

  const selfFromFeed = selfItems.length === 0
    ? (feedItems ?? [])
        .filter((item: any) => item.user_id === userId)
        .map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          event_type: item.event_type,
          event_id: item.event_id,
          event_date: item.event_date,
          created_at: item.created_at,
          summary: item.summary,
          metadata: item.metadata ?? {},
          feed_item_id: item.id,
        }))
        .filter(isValidActivityItem)
    : [];

  const items = [...selfWithFeed, ...selfFromFeed, ...feedActivity];
  items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return { items, errors };
}

export async function getActivityDebug(userId: string): Promise<ActivityDebug> {
  const errors: string[] = [];
  const { items: last7Items, errors: itemErrors } = await getSelfActivityStream(userId, 7);
  errors.push(...itemErrors);

  const workoutCount7d = last7Items.filter((i) => i.event_type === "workout").length;
  const readingCount7d = last7Items.filter((i) => i.event_type === "reading").length;
  const drinkingCount7d = last7Items.filter((i) => i.event_type === "drinking").length;

  const start30 = addDays(new Date(), -29);
  const start30Key = toDateKey(start30);

  const { count: feedCount, error: feedError } = await supabase
    .from("feed_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("event_date", start30Key);

  if (feedError) errors.push(feedError.message);

  return {
    userId,
    workoutCount7d,
    readingCount7d,
    drinkingCount7d,
    feedItemsCount30d: feedCount ?? 0,
    errors,
  };
}

export async function deleteActivity(
  viewerId: string,
  item: ActivityItem
): Promise<{ ok: boolean; error?: string }> {
  // Root cause (Bug 2): deleting feed items without updating the daily log let posts reappear.
  // Keep a single path here and ensure the same mutation is used across surfaces.
  if (process.env.NODE_ENV !== "production") {
    // Temporary debug trace.
    console.debug("[deleteActivity]", {
      viewerId,
      eventType: item.event_type,
      eventId: item.event_id,
      eventDate: item.event_date,
      feedItemId: item.feed_item_id,
    });
  }
  if (item.user_id !== viewerId) return { ok: false, error: "Not authorized" };

  if (item.event_type === "drinking") {
    const { error } = await supabase.from("drinking_events").delete().eq("id", item.event_id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabase
      .from("daily_logs")
      .select("data")
      .eq("user_id", viewerId)
      .eq("date", item.event_date)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data?.data) {
      return { ok: false, error: "Daily log not found for date" };
    }
    const dataValue = (data?.data ?? {}) as DayData;
    let changed = false;

    if (item.event_type === "workout") {
      const activities = dataValue?.workouts?.activities ?? [];
      const next = activities.filter((activity) => activity.id !== item.event_id);
      changed = next.length !== activities.length;
      if (!changed) {
        return { ok: false, error: "Workout event not found in daily log" };
      }
      dataValue.workouts = {
        ...dataValue.workouts,
        activities: next,
      };
    }

    if (item.event_type === "reading") {
      const events = dataValue?.reading?.events ?? [];
      const next = events.filter((event) => event.id !== item.event_id);
      changed = next.length !== events.length;
      const legacyId = stableUuid(`${item.event_date}-reading-legacy`);
      if (!changed && item.event_id !== legacyId) {
        return { ok: false, error: "Reading event not found in daily log" };
      }
      dataValue.reading = {
        ...dataValue.reading,
        events: next,
      };
      if (item.event_id === legacyId) {
        dataValue.reading = {
          ...dataValue.reading,
          title: undefined,
          pagesText: undefined,
          fictionPagesText: undefined,
          nonfictionPagesText: undefined,
          note: undefined,
          quote: undefined,
        };
      }
    }

    const save = await recomputeAndSaveDailyLog(viewerId, item.event_date, dataValue);
    if (!save.ok) return save;
  }

  if (item.event_type === "drinking") {
    const { data: row, error: rowError } = await supabase
      .from("daily_logs")
      .select("data")
      .eq("user_id", viewerId)
      .eq("date", item.event_date)
      .maybeSingle();
    if (rowError) return { ok: false, error: rowError.message };
    if (row?.data) {
      const save = await recomputeAndSaveDailyLog(
        viewerId,
        item.event_date,
        row.data as DayData
      );
      if (!save.ok) return save;
    }
  }

  if (item.feed_item_id) {
    await supabase.from("feed_items").delete().eq("id", item.feed_item_id);
  } else {
    await supabase
      .from("feed_items")
      .delete()
      .eq("user_id", viewerId)
      .eq("event_type", item.event_type)
      .eq("event_id", item.event_id);
  }

  return { ok: true };
}
