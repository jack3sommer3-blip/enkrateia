"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import StoryLoading from "@/app/components/StoryLoading";
import Tabs from "@/app/components/ui/Tabs";
import { useSession } from "@/app/components/useSession";
import { getProfile } from "@/lib/profile";
import {
  addComment,
  backfillFeedItemsForUser,
  deleteActivity,
  deleteComment,
  getActivityDebug,
  getFeedActivityStream,
  getLikesForFeed,
  listComments,
  listFollowers,
  listFollowing,
  searchUsers,
  toggleLike,
  followUser,
  unfollowUser,
} from "@/lib/social";
import type { Comment, Like, Profile, ActivityItem } from "@/lib/types";
import ActivityPost from "@/app/components/social/ActivityPost";

const TABS = ["Feed", "Search", "Profile"] as const;

export default function SocialClient() {
  const { loading, userId } = useSession();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") ?? "Feed").toLowerCase();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>(
    initialTab === "search"
      ? "Search"
      : initialTab === "profile"
        ? "Profile"
        : "Feed"
  );

  const [profile, setProfile] = useState<Profile | undefined>();
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [selfItems, setSelfItems] = useState<ActivityItem[]>([]);
  const [likes, setLikes] = useState<Record<string, Like[]>>({});
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [debugInfo, setDebugInfo] = useState<Awaited<ReturnType<typeof getActivityDebug>> | null>(null);
  const [activityErrors, setActivityErrors] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    getProfile(userId).then(setProfile);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const load = async () => {
      const backfill = await backfillFeedItemsForUser(userId);
      const rows: any[] = await listFollowing(userId);
      const followingIds = rows.map((row) => row.following_id);
      const followMap: Record<string, boolean> = {};
      rows.forEach((row) => {
        followMap[row.following_id] = true;
      });
      if (active) setFollowingMap(followMap);

      const { items, errors } = await getFeedActivityStream(userId, followingIds);
      if (!active) return;
      setActivityItems(items);
      setSelfItems(items.filter((item) => item.user_id === userId));
      const combinedErrors = backfill.ok
        ? errors
        : [...errors, backfill.error ?? "Backfill failed"];
      setActivityErrors(combinedErrors);

      const feedIds = items.map((item) => item.feed_item_id).filter(Boolean) as string[];
      const likesList = await getLikesForFeed(feedIds);
      if (!active) return;
      const grouped: Record<string, Like[]> = {};
      likesList.forEach((like) => {
        grouped[like.feed_item_id] = [...(grouped[like.feed_item_id] ?? []), like];
      });
      setLikes(grouped);
      const likedMap: Record<string, boolean> = {};
      likesList.forEach((like) => {
        if (like.user_id === userId) likedMap[like.feed_item_id] = true;
      });
      setLiked(likedMap);
    };
    load();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!profile?.id) return;
    listFollowers(profile.id).then((rows) => setFollowersCount(rows.length));
    listFollowing(profile.id).then((rows) => setFollowingCount(rows.length));
  }, [profile?.id]);

  useEffect(() => {
    const debugEnabled =
      process.env.NODE_ENV !== "production" || searchParams.get("debug") === "1";
    if (!debugEnabled || !userId) return;
    getActivityDebug(userId).then(setDebugInfo);
  }, [searchParams, userId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setLoadingResults(false);
      return;
    }
    setLoadingResults(true);
    debounceRef.current = setTimeout(() => {
      searchUsers(query).then((data) => {
        setResults(data);
        setLoadingResults(false);
      });
    }, 350);
  }, [query]);

  const displayName = useMemo(() => {
    if (!profile) return "";
    return profile.display_name || `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  }, [profile]);

  if (loading) return <StoryLoading />;

  if (!userId) {
    return (
      <main className="min-h-screen text-white flex items-center justify-center p-8">
        <div className="text-gray-400">Please sign in to view social.</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white flex flex-col items-center p-8">
      <div className="w-full max-w-5xl pt-6">
        <Tabs
          tabs={[...TABS]}
          active={activeTab}
          onChange={(tab) => setActiveTab(tab as typeof activeTab)}
        />

        {activeTab === "Feed" ? (
          <section className="mt-6 space-y-4">
            {activityItems.length === 0 ? (
              <div className="text-gray-500">No activity yet.</div>
            ) : (
              activityItems.map((item) => {
                const profileInfo =
                  item.profile ||
                  (item.user_id === userId
                    ? {
                        username: profile?.username,
                        display_name: displayName,
                        profile_photo_url: profile?.profile_photo_url ?? null,
                      }
                    : undefined);
                const feedId = item.feed_item_id;
                return (
                  <ActivityPost
                    key={`${item.user_id}-${item.event_type}-${item.event_id}`}
                    item={item}
                    displayName={profileInfo?.display_name ?? "User"}
                    username={profileInfo?.username ?? "user"}
                    photoUrl={profileInfo?.profile_photo_url}
                    liked={feedId ? !!liked[feedId] : false}
                    likeCount={feedId ? likes[feedId]?.length ?? 0 : 0}
                    commentCount={feedId ? comments[feedId]?.length ?? 0 : 0}
                    comments={feedId ? comments[feedId] : []}
                    currentUserId={userId}
                    onToggleLike={async () => {
                      if (!feedId) return;
                      const res = await toggleLike(feedId, !!liked[feedId], userId);
                      if (res || res === false) {
                        setLiked((prev) => ({ ...prev, [feedId]: !prev[feedId] }));
                        setLikes((prev) => {
                          const current = prev[feedId] ?? [];
                          if (liked[feedId]) {
                            return {
                              ...prev,
                              [feedId]: current.filter((like) => like.user_id !== userId),
                            };
                          }
                          return {
                            ...prev,
                            [feedId]: [...current, { user_id: userId, feed_item_id: feedId }],
                          };
                        });
                      }
                    }}
                    onLoadComments={async () => {
                      if (!feedId) return;
                      const existing = comments[feedId];
                      if (existing) return;
                      const list = await listComments(feedId);
                      setComments((prev) => ({ ...prev, [feedId]: list }));
                    }}
                    onAddComment={async (body) => {
                      if (!feedId) return;
                      const created = await addComment(feedId, body, userId);
                      if (created) {
                        setComments((prev) => ({
                          ...prev,
                          [feedId]: [...(prev[feedId] ?? []), created],
                        }));
                      }
                    }}
                    onDeleteComment={async (comment) => {
                      if (!feedId) return;
                      const ok = await deleteComment(comment.id);
                      if (ok) {
                        setComments((prev) => ({
                          ...prev,
                          [feedId]: (prev[feedId] ?? []).filter((c) => c.id !== comment.id),
                        }));
                      }
                    }}
                    onDeletePost={async () => {
                      const res = await deleteActivity(userId, item);
                      if (res.ok) {
                        setActivityItems((prev) =>
                          prev.filter(
                            (it) =>
                              !(
                                it.user_id === item.user_id &&
                                it.event_type === item.event_type &&
                                it.event_id === item.event_id
                              )
                          )
                        );
                        setSelfItems((prev) =>
                          prev.filter(
                            (it) =>
                              !(
                                it.user_id === item.user_id &&
                                it.event_type === item.event_type &&
                                it.event_id === item.event_id
                              )
                          )
                        );
                        setDeleteError(null);
                      } else {
                        console.error("Delete activity failed", res.error);
                        setDeleteError(res.error ?? "Delete failed");
                      }
                    }}
                  />
                );
              })
            )}
            {deleteError ? (
              <div className="text-sm text-rose-300">Delete failed: {deleteError}</div>
            ) : null}
            {(process.env.NODE_ENV !== "production" ||
              searchParams.get("debug") === "1") && debugInfo ? (
              <div className="command-surface rounded-md p-4 text-xs text-gray-400">
                <div className="text-gray-300 mb-2">Debug</div>
                <div>User: {debugInfo.userId}</div>
                <div>Workouts (7d): {debugInfo.workoutCount7d}</div>
                <div>Reading (7d): {debugInfo.readingCount7d}</div>
                <div>Drinking (7d): {debugInfo.drinkingCount7d}</div>
                <div>Feed items (30d): {debugInfo.feedItemsCount30d}</div>
                {activityErrors.length > 0 ? (
                  <div className="mt-2 text-rose-300">
                    Errors: {activityErrors.join(" | ")}
                  </div>
                ) : null}
                {debugInfo.errors.length > 0 ? (
                  <div className="mt-2 text-rose-300">
                    Debug errors: {debugInfo.errors.join(" | ")}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === "Search" ? (
          <section className="mt-6">
            <div className="command-surface rounded-md p-6">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value.toLowerCase())}
                placeholder="Search by username"
                className="w-full px-4 py-3 rounded-md bg-black/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/10"
              />
              <div className="text-sm uppercase tracking-[0.3em] text-gray-500 mt-5">
                Results
              </div>
              <div className="mt-4 divide-y divide-white/10">
                {!query.trim() ? null : loadingResults ? (
                  <div className="text-gray-500">Searching…</div>
                ) : results.length === 0 ? (
                  <div className="text-gray-500 py-6">No results.</div>
                ) : (
                  results.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between py-4 hover:bg-white/5 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-800 border border-white/10 overflow-hidden">
                          {result.profile_photo_url ? (
                            <img
                              src={result.profile_photo_url}
                              alt={result.display_name ?? result.username}
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div>
                          <Link
                            href={`/u/${result.username}`}
                            className="text-white hover:text-white/80 transition"
                          >
                            {result.display_name ?? result.username}
                          </Link>
                          <div className="text-gray-400 text-sm">@{result.username}</div>
                        </div>
                      </div>
                      {userId && userId !== result.id ? (
                        <button
                          onClick={async () => {
                            if (followingMap[result.id]) {
                              const ok = await unfollowUser(userId, result.id);
                              if (ok)
                                setFollowingMap((prev) => ({
                                  ...prev,
                                  [result.id]: false,
                                }));
                            } else {
                              const res = await followUser(userId, result.id);
                              if (res)
                                setFollowingMap((prev) => ({
                                  ...prev,
                                  [result.id]: true,
                                }));
                            }
                          }}
                          className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 text-gray-300"
                        >
                          {followingMap[result.id] ? "Unfollow" : "Follow"}
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "Profile" ? (
          <section className="mt-6">
            <div className="command-surface rounded-md p-6">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full border border-white/10 bg-slate-800 overflow-hidden flex items-center justify-center">
                    {profile?.profile_photo_url ? (
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
                      {displayName || "Your profile"}
                    </div>
                    <div className="text-gray-400 mt-1">@{profile?.username ?? ""}</div>
                    <div className="text-gray-500 mt-2 text-sm">
                      {followersCount} Followers • {followingCount} Following
                    </div>
                  </div>
                </div>
                <Link
                  href="/settings"
                  className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20"
                >
                  Edit profile
                </Link>
              </div>
              {profile?.bio ? (
                <div className="mt-4 text-gray-300">{profile.bio}</div>
              ) : (
                <div className="mt-4 text-gray-500 text-sm">Add a bio in settings.</div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="command-surface rounded-md p-6">
                <div className="text-sm uppercase tracking-[0.3em] text-gray-500">
                  Activity
                </div>
                <div className="mt-4 space-y-3">
                  {selfItems.length === 0 ? (
                    <div className="text-gray-500">No activity yet.</div>
                  ) : (
                    selfItems.map((item) => {
                      const feedId = item.feed_item_id;
                      return (
                        <ActivityPost
                          key={`${item.user_id}-${item.event_type}-${item.event_id}`}
                          item={item}
                          displayName={displayName || "You"}
                          username={profile?.username ?? "you"}
                          photoUrl={profile?.profile_photo_url}
                          liked={feedId ? !!liked[feedId] : false}
                          likeCount={feedId ? likes[feedId]?.length ?? 0 : 0}
                          commentCount={feedId ? comments[feedId]?.length ?? 0 : 0}
                          comments={feedId ? comments[feedId] : []}
                          currentUserId={userId}
                          onToggleLike={async () => {
                            if (!feedId) return;
                            const res = await toggleLike(feedId, !!liked[feedId], userId);
                            if (res || res === false) {
                              setLiked((prev) => ({ ...prev, [feedId]: !prev[feedId] }));
                              setLikes((prev) => {
                                const current = prev[feedId] ?? [];
                                if (liked[feedId]) {
                                  return {
                                    ...prev,
                                    [feedId]: current.filter(
                                      (like) => like.user_id !== userId
                                    ),
                                  };
                                }
                                return {
                                  ...prev,
                                  [feedId]: [
                                    ...current,
                                    { user_id: userId, feed_item_id: feedId },
                                  ],
                                };
                              });
                            }
                          }}
                          onLoadComments={async () => {
                            if (!feedId) return;
                            const existing = comments[feedId];
                            if (existing) return;
                            const list = await listComments(feedId);
                            setComments((prev) => ({ ...prev, [feedId]: list }));
                          }}
                          onAddComment={async (body) => {
                            if (!feedId) return;
                            const created = await addComment(feedId, body, userId);
                            if (created) {
                              setComments((prev) => ({
                                ...prev,
                                [feedId]: [...(prev[feedId] ?? []), created],
                              }));
                            }
                          }}
                          onDeleteComment={async (comment) => {
                            if (!feedId) return;
                            const ok = await deleteComment(comment.id);
                            if (ok) {
                              setComments((prev) => ({
                                ...prev,
                                [feedId]: (prev[feedId] ?? []).filter((c) => c.id !== comment.id),
                              }));
                            }
                          }}
                    onDeletePost={async () => {
                            const res = await deleteActivity(userId, item);
                            if (res.ok) {
                              setSelfItems((prev) =>
                                prev.filter(
                                  (it) =>
                                    !(
                                      it.user_id === item.user_id &&
                                      it.event_type === item.event_type &&
                                      it.event_id === item.event_id
                                      )
                                )
                              );
                              setActivityItems((prev) =>
                                prev.filter(
                                  (it) =>
                                    !(
                                      it.user_id === item.user_id &&
                                      it.event_type === item.event_type &&
                                      it.event_id === item.event_id
                                      )
                                )
                              );
                              setDeleteError(null);
                            } else {
                              console.error("Delete activity failed", res.error);
                              setDeleteError(res.error ?? "Delete failed");
                            }
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
                <div className="mt-4 text-gray-500">Badges coming soon.</div>
              </div>
            </div>
            {(process.env.NODE_ENV !== "production" ||
              searchParams.get("debug") === "1") && debugInfo ? (
              <div className="command-surface rounded-md p-4 text-xs text-gray-400 mt-6">
                <div className="text-gray-300 mb-2">Debug</div>
                <div>User: {debugInfo.userId}</div>
                <div>Workouts (7d): {debugInfo.workoutCount7d}</div>
                <div>Reading (7d): {debugInfo.readingCount7d}</div>
                <div>Drinking (7d): {debugInfo.drinkingCount7d}</div>
                <div>Feed items (30d): {debugInfo.feedItemsCount30d}</div>
                {activityErrors.length > 0 ? (
                  <div className="mt-2 text-rose-300">
                    Errors: {activityErrors.join(" | ")}
                  </div>
                ) : null}
                {debugInfo.errors.length > 0 ? (
                  <div className="mt-2 text-rose-300">
                    Debug errors: {debugInfo.errors.join(" | ")}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
