import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

export type NotificationItem = {
  id: string;
  type: "like" | "comment";
  created_at: string;
  actor: {
    id: string;
    username: string;
    display_name: string | null;
    profile_photo_url: string | null;
  };
  feed_item: {
    id: string;
    event_type: string;
    user_id: string;
    summary?: string | null;
  };
  comment_body?: string;
};

export async function getNotificationsLastSeen(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("notifications_last_seen_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) return null;
  return data?.notifications_last_seen_at ?? null;
}

export async function setNotificationsLastSeenNow(userId: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ notifications_last_seen_at: new Date().toISOString() })
    .eq("id", userId);
  return !error;
}

async function getFeedItemIds(userId: string) {
  const { data, error } = await supabase
    .from("feed_items")
    .select("id")
    .eq("user_id", userId)
    .limit(500);
  if (error) return [] as string[];
  return (data ?? []).map((row: any) => row.id as string);
}

export async function getUnreadNotificationCount(userId: string) {
  const lastSeen = await getNotificationsLastSeen(userId);
  const feedItemIds = await getFeedItemIds(userId);
  if (feedItemIds.length === 0) return 0;

  const likesQuery = supabase
    .from("likes")
    .select("feed_item_id", { count: "exact", head: true })
    .in("feed_item_id", feedItemIds)
    .neq("user_id", userId);

  const commentsQuery = supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .in("feed_item_id", feedItemIds)
    .neq("author_id", userId);

  if (lastSeen) {
    likesQuery.gte("created_at", lastSeen);
    commentsQuery.gte("created_at", lastSeen);
  }

  const [likes, comments] = await Promise.all([likesQuery, commentsQuery]);
  return (likes.count ?? 0) + (comments.count ?? 0);
}

export async function listNotifications(userId: string, limit = 50) {
  const lastSeen = await getNotificationsLastSeen(userId);
  const feedItemIds = await getFeedItemIds(userId);
  if (feedItemIds.length === 0) return [] as NotificationItem[];

  const likesQuery = supabase
    .from("likes")
    .select("feed_item_id,user_id,created_at")
    .in("feed_item_id", feedItemIds)
    .neq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const commentsQuery = supabase
    .from("comments")
    .select("feed_item_id,author_id,created_at,body")
    .in("feed_item_id", feedItemIds)
    .neq("author_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (lastSeen) {
    likesQuery.gte("created_at", lastSeen);
    commentsQuery.gte("created_at", lastSeen);
  }

  const [likes, comments] = await Promise.all([likesQuery, commentsQuery]);

  const feedItemsQuery = await supabase
    .from("feed_items")
    .select("id,event_type,user_id,summary")
    .in("id", feedItemIds);

  const feedMap = new Map<string, any>();
  (feedItemsQuery.data ?? []).forEach((row: any) => {
    feedMap.set(row.id, row);
  });

  const actorIds = new Set<string>();
  (likes.data ?? []).forEach((row: any) => actorIds.add(row.user_id));
  (comments.data ?? []).forEach((row: any) => actorIds.add(row.author_id));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, profile_photo_url")
    .in("id", Array.from(actorIds));

  const profileMap = new Map<string, Profile>();
  (profiles ?? []).forEach((p) => profileMap.set(p.id, p as Profile));

  const items: NotificationItem[] = [];
  (likes.data ?? []).forEach((row: any) => {
    const actor = profileMap.get(row.user_id);
    const feedItem = feedMap.get(row.feed_item_id);
    if (!actor || !feedItem) return;
    items.push({
      id: `like:${row.feed_item_id}:${row.user_id}:${row.created_at}`,
      type: "like",
      created_at: row.created_at,
      actor: {
        id: actor.id,
        username: actor.username,
        display_name: actor.display_name,
        profile_photo_url: actor.profile_photo_url,
      },
      feed_item: {
        id: feedItem.id,
        event_type: feedItem.event_type,
        user_id: feedItem.user_id,
        summary: feedItem.summary,
      },
    });
  });

  (comments.data ?? []).forEach((row: any) => {
    const actor = profileMap.get(row.author_id);
    const feedItem = feedMap.get(row.feed_item_id);
    if (!actor || !feedItem) return;
    const body = String(row.body ?? "").trim();
    items.push({
      id: `comment:${row.feed_item_id}:${row.author_id}:${row.created_at}`,
      type: "comment",
      created_at: row.created_at,
      actor: {
        id: actor.id,
        username: actor.username,
        display_name: actor.display_name,
        profile_photo_url: actor.profile_photo_url,
      },
      feed_item: {
        id: feedItem.id,
        event_type: feedItem.event_type,
        user_id: feedItem.user_id,
        summary: feedItem.summary,
      },
      comment_body: body.length > 140 ? `${body.slice(0, 140)}…` : body,
    });
  });

  return items
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}
