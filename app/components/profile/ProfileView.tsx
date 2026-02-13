"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import StoryLoading from "@/app/components/StoryLoading";
import ActivityPost from "@/app/components/social/ActivityPost";
import Badge007 from "@/app/components/badges/Badge007";
import {
  addComment,
  deleteComment,
  getCommentsForPost,
  getLikesForFeed,
  getUserFeed,
  toggleLike,
  ensureFeedItemIdForActivity,
  getProfileByUsername,
  getCommentCounts,
} from "@/lib/social";
import { checkAndAward007Badge, getUserBadges } from "@/lib/badges";
import type { ActivityItem, Comment, Like, Profile, UserBadge } from "@/lib/types";

type ProfileViewProps = {
  username?: string;
  viewerId?: string;
  commentCounts?: Record<string, number>;
  onCommentCountChange?: (feedItemId: string, count: number) => void;
};

export default function ProfileView({
  username,
  viewerId,
  commentCounts: externalCounts,
  onCommentCountChange,
}: ProfileViewProps) {
  const [profile, setProfile] = useState<Profile | undefined>();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [likes, setLikes] = useState<Record<string, Like[]>>({});
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [activeBadge, setActiveBadge] = useState<UserBadge | null>(null);
  const debugEnabled = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("debug") === "1"
    : false;
  const loadingRef = useRef(false);

  const setAuthoritativeCount = (feedItemId: string, count: number) => {
    setCommentCounts((prev) => ({ ...prev, [feedItemId]: count }));
    onCommentCountChange?.(feedItemId, count);
  };

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    getProfileByUsername(username).then((data) => {
      setProfile(data);
      setLoading(false);
    });
  }, [username]);

  useEffect(() => {
    if (!profile?.id || loadingRef.current) return;
    let active = true;
    loadingRef.current = true;
    const load = async () => {
      const feedItems = await getUserFeed(profile.id);
      if (!active) return;
      const mapped: ActivityItem[] = feedItems.map((item) => ({
        id: item.id,
        user_id: item.user_id,
        event_type: item.event_type,
        event_id: item.event_id,
        event_date: item.event_date,
        created_at: item.created_at,
        summary: item.summary,
        metadata: item.metadata ?? {},
        feed_item_id: item.id,
      }));
      setItems(mapped);

      const feedIds = mapped.map((item) => item.feed_item_id).filter(Boolean) as string[];
      const likesList = await getLikesForFeed(feedIds);
      if (!active) return;
      const grouped: Record<string, Like[]> = {};
      likesList.forEach((like) => {
        grouped[like.feed_item_id] = [...(grouped[like.feed_item_id] ?? []), like];
      });
      setLikes(grouped);
      if (viewerId) {
        const likedMap: Record<string, boolean> = {};
        likesList.forEach((like) => {
          if (like.user_id === viewerId) likedMap[like.feed_item_id] = true;
        });
        setLiked(likedMap);
      }
      const counts = await getCommentCounts(feedIds);
      if (active) {
        Object.entries(counts).forEach(([id, count]) =>
          setAuthoritativeCount(id, count)
        );
      }
    };
    load();
    return () => {
      active = false;
      loadingRef.current = false;
    };
  }, [profile?.id, viewerId]);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    if (viewerId && viewerId === profile.id) {
      checkAndAward007Badge(viewerId);
    }
    getUserBadges(profile.id).then((rows) => {
      if (!active) return;
      setBadges(rows);
    });
    return () => {
      active = false;
    };
  }, [profile?.id]);

  const displayName = useMemo(() => {
    if (!profile) return "";
    return profile.display_name || `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  }, [profile]);

  if (loading) return <StoryLoading />;
  if (!profile) {
    return (
      <div className="text-gray-400">Profile not found.</div>
    );
  }

  return (
    <section className="mt-6">
      <div className="command-surface rounded-md p-6">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full border border-white/10 bg-slate-800 overflow-hidden flex items-center justify-center">
              {profile.profile_photo_url ? (
                <img
                  src={profile.profile_photo_url}
                  alt={displayName || "Profile"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs text-gray-400">ME</span>
              )}
            </div>
            <div>
              <div className="text-2xl font-semibold text-white">
                {displayName || "Profile"}
              </div>
              <div className="text-gray-400 mt-1">@{profile.username ?? ""}</div>
            </div>
          </div>
          {viewerId && viewerId === profile.id ? (
            <Link
              href="/settings"
              className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20"
            >
              Edit profile
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="command-surface rounded-md p-6">
          <div className="text-sm uppercase tracking-[0.3em] text-gray-500">
            Activity
          </div>
          <div className="mt-4 space-y-3">
            {items.length === 0 ? (
              <div className="text-gray-500">No activity yet.</div>
            ) : (
              items.map((item) => {
                const feedId = item.feed_item_id;
                const commentCount = feedId
                  ? externalCounts?.[feedId] ??
                    commentCounts[feedId] ??
                    comments[feedId]?.length ??
                    0
                  : 0;
                return (
                  <ActivityPost
                    key={`${item.user_id}-${item.event_type}-${item.event_id}`}
                    item={item}
                    displayName={displayName || "User"}
                    username={profile.username ?? "user"}
                    photoUrl={profile.profile_photo_url}
                    liked={feedId ? !!liked[feedId] : false}
                    likeCount={feedId ? likes[feedId]?.length ?? 0 : 0}
                    commentCount={commentCount}
                    comments={feedId ? comments[feedId] : []}
                    currentUserId={viewerId ?? ""}
                    onToggleLike={async () => {
                      if (!feedId || !viewerId) return;
                      const res = await toggleLike(feedId, !!liked[feedId], viewerId);
                      if (res || res === false) {
                        setLiked((prev) => ({ ...prev, [feedId]: !prev[feedId] }));
                        setLikes((prev) => {
                          const current = prev[feedId] ?? [];
                          if (liked[feedId]) {
                            return {
                              ...prev,
                              [feedId]: current.filter((like) => like.user_id !== viewerId),
                            };
                          }
                          return {
                            ...prev,
                            [feedId]: [...current, { user_id: viewerId, feed_item_id: feedId }],
                          };
                        });
                      }
                    }}
                    onLoadComments={async () => {
                      let resolvedFeedId = feedId;
                      if (!resolvedFeedId) {
                        resolvedFeedId = await ensureFeedItemIdForActivity(item);
                        if (resolvedFeedId) {
                          setItems((prev) =>
                            prev.map((it) =>
                              it.event_id === item.event_id &&
                              it.event_type === item.event_type &&
                              it.user_id === item.user_id
                                ? { ...it, feed_item_id: resolvedFeedId }
                                : it
                            )
                          );
                        }
                      }
                      if (!resolvedFeedId) return;
                      const { comments: list, error } =
                        await getCommentsForPost(resolvedFeedId);
                      if (error) return;
                      setComments((prev) => ({ ...prev, [resolvedFeedId]: list }));
                      setAuthoritativeCount(resolvedFeedId, list.length);
                    }}
                    onAddComment={async (body) => {
                      if (!viewerId) return { ok: false, error: "Sign in to comment." };
                      let resolvedFeedId = feedId;
                      if (!resolvedFeedId) {
                        resolvedFeedId = await ensureFeedItemIdForActivity(item);
                        if (resolvedFeedId) {
                          setItems((prev) =>
                            prev.map((it) =>
                              it.event_id === item.event_id &&
                              it.event_type === item.event_type &&
                              it.user_id === item.user_id
                                ? { ...it, feed_item_id: resolvedFeedId }
                                : it
                            )
                          );
                        }
                      }
                      if (!resolvedFeedId) return { ok: false, error: "Post not ready." };
                      const { comment, error } = await addComment(
                        resolvedFeedId,
                        body,
                        viewerId
                      );
                      if (debugEnabled) {
                        console.debug("[addComment] result", { comment, error });
                      }
                      if (comment) {
                        setComments((prev) => ({
                          ...prev,
                          [resolvedFeedId]: [...(prev[resolvedFeedId] ?? []), comment],
                        }));
                        const { comments: fresh, error: loadError } =
                          await getCommentsForPost(resolvedFeedId);
                        if (!loadError) {
                          setComments((prev) => ({ ...prev, [resolvedFeedId]: fresh }));
                          setAuthoritativeCount(resolvedFeedId, fresh.length);
                        }
                        return { ok: true };
                      }
                      return {
                        ok: false,
                        error: error?.message ?? "Failed to add comment",
                      };
                    }}
                    onDeleteComment={async (comment) => {
                      if (!feedId) return;
                      const ok = await deleteComment(comment.id);
                      if (ok) {
                        setComments((prev) => ({
                          ...prev,
                          [feedId]: (prev[feedId] ?? []).filter((c) => c.id !== comment.id),
                        }));
                        const { comments: fresh, error: loadError } =
                          await getCommentsForPost(feedId);
                        if (!loadError) {
                          setComments((prev) => ({ ...prev, [feedId]: fresh }));
                          setAuthoritativeCount(feedId, fresh.length);
                        }
                      }
                    }}
                    onDeletePost={async () => {
                      // Profile view uses feed_items only; deletion handled elsewhere.
                    }}
                  />
                );
              })
            )}
          </div>
        </div>
        <div className="command-surface rounded-md p-6">
          <div className="text-sm uppercase tracking-[0.3em] text-gray-500">
            Badges
          </div>
          <div className="mt-4">
            {badges.length === 0 ? (
              <div className="text-gray-500 text-sm">No badges yet.</div>
            ) : (
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(88px,1fr))]">
                {badges.map((badge) => {
                  const label = badge.badges?.name ?? badge.badge_id;
                  return (
                    <button
                      key={badge.id}
                      type="button"
                      onClick={() => setActiveBadge(badge)}
                      aria-label={`View badge: ${label}`}
                      title={`View badge: ${label}`}
                      className={[
                        "group w-full aspect-square rounded-md border border-transparent",
                        "bg-transparent",
                        "flex flex-col items-center justify-center gap-2 px-2 py-3",
                        "text-[11px] uppercase tracking-[0.2em] text-gray-400",
                        "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                        "hover:text-white hover:drop-shadow-[0_0_14px_rgba(255,255,255,0.08)]",
                        "active:scale-[0.98]",
                      ].join(" ")}
                    >
                      <div className="w-12 h-12 rounded-full border border-white/20 bg-transparent flex items-center justify-center group-hover:border-white/40 group-hover:shadow-[0_0_14px_rgba(255,255,255,0.12)]">
                        {badge.badges?.id === "bond_007" ? (
                          <Badge007 className="w-9 h-9" />
                        ) : (
                          <div className="text-sm">?</div>
                        )}
                      </div>
                      <div
                        className="text-[10px] leading-none text-center tracking-[0.15em] font-semibold [font-variant-numeric:tabular-nums]"
                        style={{ transform: "none" }}
                      >
                        {label}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {activeBadge ? (
            <div className="mt-4 rounded-md border border-white/10 bg-black/40 p-4 text-sm text-gray-300">
              <div className="text-xs uppercase tracking-[0.3em] text-gray-500">
                {activeBadge.badges?.name ?? "Badge"}
              </div>
              <div className="mt-2">
                {activeBadge.badges?.description ?? "Badge unlocked."}
              </div>
              <button
                type="button"
                onClick={() => setActiveBadge(null)}
                className="mt-3 text-xs uppercase tracking-[0.2em] text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
