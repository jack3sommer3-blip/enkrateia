"use client";

import { useEffect, useState } from "react";
import Nav from "@/app/components/Nav";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import {
  getFeed,
  listFollowing,
  toggleLike,
  addComment,
  listComments,
  getLikesForFeed,
  deleteComment,
} from "@/lib/social";
import type { Comment, Like } from "@/lib/types";

type FeedRow = {
  id: string;
  user_id: string;
  created_at: string;
  event_type: string;
  summary: string;
  profiles?: { username: string; display_name: string; profile_photo_url: string | null };
};

export default function FeedPage() {
  const { loading, userId } = useSession();
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [likes, setLikes] = useState<Record<string, Like[]>>({});
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentBodies, setCommentBodies] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userId) return;
    listFollowing(userId).then((rows: any[]) => {
      const followingIds = rows.map((row) => row.following_id);
      const ids = Array.from(new Set([userId, ...followingIds]));
      getFeed(ids).then((items: any[]) => {
        setFeed(items);
        getLikesForFeed(items.map((item) => item.id)).then((likesList) => {
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
        });
      });
    });
  }, [userId]);

  if (loading) return <StoryLoading />;
  if (!userId) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-8">
        <div className="text-gray-400">Please sign in to view your feed.</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center p-8">
      <div className="w-full max-w-5xl">
        <header className="mb-10 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="text-gray-500 text-sm tracking-[0.3em]">ENKRATEIA</div>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">Feed</h1>
            <p className="text-gray-400">Recent activity from people you follow.</p>
          </div>
          <Nav />
        </header>

        <section className="space-y-4">
          {feed.length === 0 ? (
            <div className="text-gray-500">No activity yet.</div>
          ) : (
            feed.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl border border-gray-800 bg-gray-900"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 overflow-hidden">
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
                    <div className="text-gray-400 text-sm">
                      @{item.profiles?.username ?? ""}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-white font-semibold">{item.summary}</div>
                <div className="text-gray-500 text-sm mt-1">
                  {new Date(item.created_at).toLocaleString()}
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
                        {comment.user_id === userId ? (
                          <button
                            onClick={async () => {
                              const ok = await deleteComment(comment.id);
                              if (ok) {
                                setComments((prev) => ({
                                  ...prev,
                                  [item.id]: prev[item.id].filter((c) => c.id !== comment.id),
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
                        className="flex-1 px-3 py-2 rounded-xl bg-black border border-gray-700"
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
                        className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700"
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
      </div>
    </main>
  );
}
