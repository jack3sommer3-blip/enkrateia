"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { supabase } from "@/lib/supabase";
import Tabs from "@/app/components/ui/Tabs";
import {
  getUserFeed,
  listFollowers,
  listFollowing,
  followUser,
  unfollowUser,
  listComments,
  toggleLike,
  addComment,
  getLikesForFeed,
  deleteComment,
  getProfileByUsername,
  backfillFeedItemsForUser,
} from "@/lib/social";
import type { Profile, FeedItem, Comment, Like } from "@/lib/types";

function initials(profile: Profile) {
  const first = profile.first_name?.[0] ?? "";
  const last = profile.last_name?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params?.username?.toLowerCase();
  const { loading: sessionLoading, userId } = useSession();
  const [profile, setProfile] = useState<Profile | undefined>();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"Activity" | "Badges">("Activity");
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const [likes, setLikes] = useState<Record<string, Like[]>>({});
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [commentBodies, setCommentBodies] = useState<Record<string, string>>({});
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    getProfileByUsername(username).then((data) => {
      setProfile(data);
      setLoading(false);
    });
  }, [username]);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    const load = async () => {
      if (userId && userId === profile.id) {
        await backfillFeedItemsForUser(userId);
      }
      const items = await getUserFeed(profile.id);
      if (!active) return;
      setFeedItems(items);
      const likesList = await getLikesForFeed(items.map((item) => item.id));
      if (!active) return;
      const grouped: Record<string, Like[]> = {};
      likesList.forEach((like) => {
        grouped[like.feed_item_id] = [...(grouped[like.feed_item_id] ?? []), like];
      });
      setLikes(grouped);
      if (userId) {
        const likedMap: Record<string, boolean> = {};
        likesList.forEach((like) => {
          if (like.user_id === userId) likedMap[like.feed_item_id] = true;
        });
        setLiked(likedMap);
      }
    };
    load();
    listFollowers(profile.id).then(setFollowers);
    listFollowing(profile.id).then(setFollowing);
    if (userId && userId !== profile.id) {
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId)
        .eq("following_id", profile.id)
        .maybeSingle()
        .then(({ data }: { data: any }) => {
          setIsFollowing(!!data);
        });
    }
    return () => {
      active = false;
    };
  }, [profile?.id, userId]);

  if (loading || sessionLoading) return <StoryLoading />;

  if (!profile) {
    return (
      <main className="min-h-screen text-white flex items-center justify-center p-8">
        <div className="text-gray-400">Profile not found.</div>
      </main>
    );
  }

  if (!profile.is_public && profile.id !== userId) {
    return (
      <main className="min-h-screen text-white flex items-center justify-center p-8">
        <div className="text-gray-400">This profile is private.</div>
      </main>
    );
  }

  const displayName = profile.display_name || `${profile.first_name} ${profile.last_name}`;

  return (
    <main className="min-h-screen text-white flex flex-col items-center p-8">
      <div className="w-full max-w-5xl pt-10">
        <header className="mb-10 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full border border-white/10 bg-slate-800 flex items-center justify-center text-2xl font-semibold overflow-hidden">
                {profile.profile_photo_url ? (
                  <img
                    src={profile.profile_photo_url}
                    alt={displayName}
                    className="h-full w-full object-cover rounded-full"
                  />
                ) : (
                  initials(profile)
                )}
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-semibold flex items-center gap-2">
                  {displayName}
                  {profile.location ? (
                    <span className="text-gray-500 text-sm">• {profile.location}</span>
                  ) : null}
                </div>
                <div className="text-gray-400 flex flex-wrap items-center gap-3 text-sm">
                  <span>@{profile.username}</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-300">{followers.length} Followers</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-300">{following.length} Following</span>
                </div>
              </div>
            </div>

            {userId && userId !== profile.id ? (
              <button
                onClick={async () => {
                  if (isFollowing) {
                    const ok = await unfollowUser(userId, profile.id);
                    if (ok) setIsFollowing(false);
                  } else {
                    const res = await followUser(userId, profile.id);
                    if (res) setIsFollowing(true);
                  }
                }}
                className="px-4 py-2 rounded-md border border-[color:var(--accent-40)] bg-[color:var(--accent-10)] text-[color:var(--accent)] hover:border-[color:var(--accent-60)] transition"
              >
                {isFollowing ? "Unfollow" : "Follow"}
              </button>
            ) : (
              <Link
                href="/"
                className="px-4 py-2 rounded-md border border-white/10 bg-slate-900 text-gray-200 hover:border-white/20 transition"
              >
                Back to app
              </Link>
            )}
          </div>
        </header>

        {profile.bio ? (
          <section className="command-surface rounded-md p-6 text-gray-200">
            {profile.bio}
          </section>
        ) : (
          <section className="command-surface rounded-md p-6 text-gray-500">
            No bio yet.
          </section>
        )}

        <section className="mt-8">
          <Tabs tabs={["Activity", "Badges"]} active={tab} onChange={(value) => setTab(value as typeof tab)} />
        </section>

        {tab === "Activity" ? (
          <section className="mt-6 space-y-4">
            {feedItems.length === 0 ? (
              <div className="text-gray-500">No activity yet.</div>
            ) : (
              feedItems.map((item) => (
                <div key={item.id} className="command-surface rounded-md p-5 fade-up">
                  <div className="text-gray-400 text-sm">{item.event_type}</div>
                  <div className="text-white font-semibold mt-1">{item.summary}</div>
                  <div className="text-gray-500 text-sm mt-1">
                    {new Date(item.created_at).toLocaleString("en-US", {
                      timeZone: "America/Chicago",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-sm text-gray-400">
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
                    {liked[item.id] ? "Unlike" : "Like"} •{" "}
                    {likes[item.id]?.length ?? 0}
                  </button>
                    <button
                      onClick={async () => {
                        const { comments: list, error } = await listComments(item.id);
                        if (error) {
                          setCommentErrors((prev) => ({
                            ...prev,
                            [item.id]: error.message ?? "Failed to load comments",
                          }));
                          return;
                        }
                        setCommentErrors((prev) => {
                          const next = { ...prev };
                          delete next[item.id];
                          return next;
                        });
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
                        <div
                          key={comment.id}
                          className="text-sm text-gray-300 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2">
                            {comment.profiles?.username ? (
                              <Link
                                href={`/u/${comment.profiles.username}`}
                                className="flex items-center gap-2 hover:text-white transition"
                              >
                                <span className="h-6 w-6 rounded-full border border-white/10 bg-slate-800 overflow-hidden">
                                  {comment.profiles?.profile_photo_url ? (
                                    <img
                                      src={comment.profiles.profile_photo_url}
                                      alt={comment.profiles.username}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : null}
                                </span>
                                <span>
                                  {comment.profiles?.display_name ??
                                    comment.profiles?.username ??
                                    "@unknown"}
                                </span>
                              </Link>
                            ) : (
                              <span className="flex items-center gap-2">
                                <span className="h-6 w-6 rounded-full border border-white/10 bg-slate-800" />
                                <span>@unknown</span>
                              </span>
                            )}
                            <span className="text-gray-600">•</span>
                            <span>
                              {new Date(comment.created_at).toLocaleString("en-US", {
                                timeZone: "America/Chicago",
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <span>{comment.body}</span>
                          {comment.author_id === userId ? (
                            <button
                              onClick={async () => {
                                const ok = await deleteComment(comment.id);
                                if (ok) {
                                  setComments((prev) => ({
                                    ...prev,
                                    [item.id]: prev[item.id].filter(
                                      (c) => c.id !== comment.id
                                    ),
                                  }));
                                }
                              }}
                              className="text-gray-500 hover:text-white text-xs"
                            >
                              Delete
                            </button>
                          ) : null}
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
                          className="flex-1 px-3 py-2 rounded-md bg-black border border-gray-700"
                          placeholder="Add a comment"
                        />
                        <button
                          onClick={async () => {
                            if (!userId) return;
                            const body = commentBodies[item.id]?.trim();
                            if (!body) return;
                            const { comment, error } = await addComment(
                              item.id,
                              body,
                              userId
                            );
                            if (error && process.env.NODE_ENV !== "production") {
                              console.debug("[addComment] error", {
                                message: error.message,
                                code: error.code,
                                details: error.details,
                                hint: error.hint,
                              });
                            }
                            if (comment) {
                              setComments((prev) => ({
                                ...prev,
                                [item.id]: [...(prev[item.id] ?? []), comment],
                              }));
                              setCommentBodies((prev) => ({ ...prev, [item.id]: "" }));
                            }
                          }}
                          className="px-3 py-2 rounded-md bg-slate-900 border border-white/10 hover:border-white/20"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  ) : null}
                {commentErrors[item.id] ? (
                  <div className="mt-2 text-xs text-rose-300">
                    {commentErrors[item.id]}
                  </div>
                ) : null}
                </div>
              ))
            )}
          </section>
        ) : null}

        {tab === "Badges" ? (
          <section className="mt-6 text-gray-500">Badges coming soon.</section>
        ) : null}
      </div>
    </main>
  );
}
