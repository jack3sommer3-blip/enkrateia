"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import type { ActivityItem, Comment, Like } from "@/lib/types";

function formatTitle(item: ActivityItem) {
  if (item.event_type === "reading") return "READING LOG";
  if (item.event_type === "drinking") return "DRINKING EVENT";
  if (item.event_type === "workout") {
    const type = String(item.metadata?.activityType ?? "").toLowerCase();
    if (type.includes("run")) return "RUN COMPLETED";
    if (type.includes("lift")) return "LIFT SESSION";
    return "WORKOUT LOG";
  }
  return "ACTIVITY";
}

function chipsFor(item: ActivityItem) {
  const chips: Array<{ label: string; value: string }> = [];
  if (item.event_type === "workout") {
    const minutes = Number(item.metadata?.minutes ?? 0);
    const seconds = Number(item.metadata?.seconds ?? 0);
    const intensity = Number(item.metadata?.intensity ?? 0);
    const environment = String(item.metadata?.environment ?? "");
    if (minutes > 0 || seconds > 0) {
      const total = minutes > 0 ? `${minutes}m` : `${seconds}s`;
      chips.push({ label: "TIME", value: total });
    }
    if (intensity > 0) chips.push({ label: "INT", value: String(intensity) });
    if (environment) chips.push({ label: "ENV", value: environment });
  }
  if (item.event_type === "reading") {
    const pages = Number(item.metadata?.pages ?? 0);
    const fiction = Number(item.metadata?.fiction_pages ?? 0);
    const nonfiction = Number(item.metadata?.nonfiction_pages ?? 0);
    const total = pages || fiction + nonfiction;
    if (total > 0) chips.push({ label: "PAGES", value: String(total) });
  }
  if (item.event_type === "drinking") {
    const tier = Number(item.metadata?.tier ?? 0);
    const drinks = Number(item.metadata?.drinks ?? 0);
    if (tier > 0) chips.push({ label: "TIER", value: String(tier) });
    if (drinks > 0) chips.push({ label: "DRINKS", value: String(drinks) });
  }
  return chips;
}

const HeartIcon = ({ filled }: { filled?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={"h-4 w-4"}
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);

const CommentIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
  </svg>
);

const TrashIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M8 10v8" />
    <path d="M12 10v8" />
    <path d="M16 10v8" />
  </svg>
);

export default function ActivityPost({
  item,
  displayName,
  username,
  photoUrl,
  liked,
  likeCount,
  commentCount,
  comments,
  currentUserId,
  onToggleLike,
  onLoadComments,
  onAddComment,
  onDeleteComment,
  onDeletePost,
}: {
  item: ActivityItem;
  displayName: string;
  username: string;
  photoUrl?: string | null;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  comments?: Comment[];
  currentUserId: string;
  onToggleLike: () => void;
  onLoadComments: () => void;
  onAddComment: (body: string) => Promise<{ ok: boolean; error?: string }>;
  onDeleteComment: (comment: Comment) => void;
  onDeletePost: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const title = useMemo(() => formatTitle(item), [item]);
  const chipValues = useMemo(() => chipsFor(item), [item]);
  const createdLabel = useMemo(() => {
    // Debug notes: if created_at is date-only, it renders as 6:00 AM local.
    // We prefer true created_at from feed_items when available.
    return new Date(item.created_at).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [item.created_at]);

  useEffect(() => {
    if (expanded) {
      onLoadComments();
    }
  }, [expanded, item.feed_item_id]);

  return (
    <div className="relative rounded-md border border-white/10 bg-[#0b1220]/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_14px_28px_rgba(0,0,0,0.45)]">
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:90px_90px] opacity-20" />
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/u/${username}`} className="h-9 w-9 rounded-full border border-white/10 bg-slate-800 overflow-hidden">
            {photoUrl ? (
              <img src={photoUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : null}
          </Link>
          <div>
            <Link
              href={`/u/${username}`}
              className="text-sm font-semibold text-white hover:text-white/80 transition"
            >
              {displayName}
            </Link>
            <div className="text-xs text-gray-400">@{username}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">{createdLabel}</div>
          {item.user_id === currentUserId ? (
            <button
              onClick={onDeletePost}
              className="text-gray-500 hover:text-white transition"
              aria-label="Delete"
            >
              <TrashIcon />
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative mt-4">
        <div className="text-[11px] uppercase tracking-[0.35em] text-gray-500">{title}</div>
        <div className="mt-2 text-lg font-semibold text-white">{item.summary}</div>
        {chipValues.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {chipValues.map((chip) => (
              <div
                key={chip.label}
                className="border border-white/10 text-[10px] uppercase tracking-[0.2em] text-gray-400 px-2 py-1"
              >
                {chip.label} <span className="text-white/80">{chip.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="relative mt-4 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleLike}
            className="flex items-center gap-2 hover:text-white transition"
          >
            <HeartIcon filled={liked} />
            {likeCount}
          </button>
          <button
            onClick={() => {
              if (!expanded) onLoadComments();
              setExpanded((prev) => !prev);
            }}
            className="flex items-center gap-2 hover:text-white transition"
          >
            <CommentIcon />
            {commentCount}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="relative mt-4 border-t border-white/10 pt-4 space-y-3">
          {comments && comments.length > 0 ? (
            comments.map((comment) => (
              <div key={comment.id} className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
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
                  <div className="text-sm text-gray-200 mt-1">{comment.body}</div>
                </div>
                {comment.author_id === currentUserId ? (
                  <button
                    onClick={() => onDeleteComment(comment)}
                    className="text-gray-500 hover:text-white transition"
                    aria-label="Delete comment"
                  >
                    <TrashIcon />
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500">No comments yet.</div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md bg-black/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/10 text-sm"
              placeholder="Add a comment"
            />
            <button
              onClick={() => {
                const trimmed = body.trim();
                if (!trimmed) return;
                onAddComment(trimmed).then((res) => {
                  if (res.ok) {
                    setBody("");
                    setCommentError(null);
                  } else {
                    setCommentError(res.error ?? "Failed to add comment");
                  }
                });
              }}
              className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 text-sm"
            >
              Send
            </button>
          </div>
          {commentError ? (
            <div className="text-xs text-rose-300">{commentError}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
