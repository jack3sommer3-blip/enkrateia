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
  getFeed,
  getLikesForFeed,
  listComments,
  listFollowers,
  listFollowing,
  searchUsers,
  toggleLike,
} from "@/lib/social";
import type { Comment, Like, Profile } from "@/lib/types";

const TABS = ["Feed", "Search", "Profile"] as const;

type FeedRow = {
  id: string;
  user_id: string;
  created_at: string;
  event_type: string;
  summary: string;
  profiles?: { username: string; display_name: string; profile_photo_url: string | null };
};

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
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [likes, setLikes] = useState<Record<string, Like[]>>({});
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentBodies, setCommentBodies] = useState<Record<string, string>>({});

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    getProfile(userId).then(setProfile);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const load = async () => {
      await backfillFeedItemsForUser(userId);
      const rows: any[] = await listFollowing(userId);
      const followingIds = rows.map((row) => row.following_id);
      const ids = Array.from(new Set([userId, ...followingIds]));
      const items: any[] = await getFeed(ids);
      if (!active) return;
      setFeed(items);
      const likesList = await getLikesForFeed(items.map((item) => item.id));
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
            {feed.length === 0 ? (
              <div className="text-gray-500">No activity yet.</div>
            ) : (
              feed.map((item) => (
                <div key={item.id} className="command-surface rounded-md p-5 fade-up">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800 border border-white/10 overflow-hidden">
                      {item.profiles?.profile_photo_url ? (
                        <img
                          src={item.profiles.profile_photo_url}
                          alt={item.profiles.display_name ?? item.profiles.username}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div>
                      <div className="text-white">
                        {item.profiles?.display_name ?? item.profiles?.username ?? "User"}
                      </div>
                      <div className="text-gray-400 text-sm">@{item.profiles?.username ?? ""}</div>
                    </div>
                  </div>

                  <div className="mt-3 text-white font-semibold">{item.summary}</div>
                  <div className="text-gray-500 text-sm mt-1">
                    {new Date(item.created_at).toLocaleString()}
                  </div>

                  <div className="mt-3 flex items-center gap-6 text-xs uppercase tracking-[0.2em] text-gray-500">
                    <button
                      onClick={async () => {
                        if (!userId) return;
                        const res = await toggleLike(item.id, !!liked[item.id], userId);
                        if (res || res === false) {
                          setLiked((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                          setLikes((prev) => {
                            const current = prev[item.id] ?? [];
                            if (liked[item.id]) {
                              return {
                                ...prev,
                                [item.id]: current.filter((like) => like.user_id !== userId),
                              };
                            }
                            return {
                              ...prev,
                              [item.id]: [
                                ...current,
                                { user_id: userId, feed_item_id: item.id },
                              ],
                            };
                          });
                        }
                      }}
                      className="hover:text-white"
                    >
                      {liked[item.id] ? "Unlike" : "Like"} • {likes[item.id]?.length ?? 0}
                    </button>
                    <button
                      onClick={async () => {
                        const existing = comments[item.id];
                        if (existing) return;
                        const list = await listComments(item.id);
                        setComments((prev) => ({ ...prev, [item.id]: list }));
                      }}
                      className="hover:text-white"
                    >
                      Comments • {comments[item.id]?.length ?? 0}
                    </button>
                  </div>

                  {comments[item.id] ? (
                    <div className="mt-4 space-y-2">
                      {comments[item.id].map((comment) => (
                        <div key={comment.id} className="text-sm text-gray-300 flex items-center justify-between">
                          <span>{comment.body}</span>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          value={commentBodies[item.id] ?? ""}
                          onChange={(e) =>
                            setCommentBodies((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          className="flex-1 px-3 py-2 rounded-md bg-black/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/10"
                          placeholder="Add a comment"
                        />
                        <button
                          onClick={async () => {
                            if (!userId) return;
                            const body = commentBodies[item.id]?.trim();
                            if (!body) return;
                            const created = await addComment(item.id, body, userId);
                            if (created) {
                              setComments((prev) => ({
                                ...prev,
                                [item.id]: [...(prev[item.id] ?? []), created],
                              }));
                              setCommentBodies((prev) => ({ ...prev, [item.id]: "" }));
                            }
                          }}
                          className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            )}
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
              <div className="text-sm uppercase tracking-[0.3em] text-gray-500">
                Results
              </div>
              <div className="mt-4 space-y-3">
                {!query.trim() ? (
                  <div className="text-gray-500">Start typing to search users.</div>
                ) : loadingResults ? (
                  <div className="text-gray-500">Searching…</div>
                ) : results.length === 0 ? (
                  <div className="text-gray-500">No users found.</div>
                ) : (
                  results.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between p-4 rounded-md border border-white/10 bg-black/40"
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
                  {feed.filter((item) => item.user_id === userId).length === 0 ? (
                    <div className="text-gray-500">No activity yet.</div>
                  ) : (
                    feed
                      .filter((item) => item.user_id === userId)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="rounded-md border border-white/10 bg-black/40 px-4 py-3"
                        >
                          <div className="text-white font-semibold">{item.summary}</div>
                          <div className="text-gray-500 text-sm mt-1">
                            {new Date(item.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))
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
          </section>
        ) : null}
      </div>
    </main>
  );
}
