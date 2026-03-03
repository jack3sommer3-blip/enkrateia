"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { listNotifications, setNotificationsLastSeenNow } from "@/lib/notifications";
import type { NotificationItem } from "@/lib/notifications";

function formatTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function NotificationsPage() {
  const { loading, userId } = useSession();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const load = async () => {
      const rows = await listNotifications(userId, 50);
      if (!active) return;
      setItems(rows);
      setLoadingItems(false);
      await setNotificationsLastSeenNow(userId);
    };
    load();
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading) return <StoryLoading />;
  if (!userId) {
    return (
      <main className="min-h-screen text-white flex items-center justify-center p-8">
        <div className="text-gray-400">Please sign in to view notifications.</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white flex flex-col items-center p-8">
      <div className="w-full max-w-4xl pt-6">
        <div className="command-surface rounded-md p-6">
          <div className="text-xs uppercase tracking-[0.3em] text-gray-500">
            Notifications
          </div>
          <div className="mt-4 space-y-4">
            {loadingItems ? (
              <div className="text-gray-500">Loading…</div>
            ) : items.length === 0 ? (
              <div className="text-gray-500">No notifications yet.</div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 p-4 rounded-md border border-white/10 bg-black/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800 border border-white/10 overflow-hidden flex items-center justify-center text-xs text-gray-300">
                      {item.actor.profile_photo_url ? (
                        <img
                          src={item.actor.profile_photo_url}
                          alt={item.actor.display_name ?? item.actor.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{item.actor.username.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <div className="text-sm">
                        <Link
                          href={`/u/${item.actor.username}`}
                          className="text-white hover:text-white/80"
                        >
                          @{item.actor.username}
                        </Link>{" "}
                        {item.type === "like" ? "liked your post" : "commented"}
                        {item.type === "comment" && item.comment_body
                          ? `: \"${item.comment_body}\"`
                          : ""}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatTime(item.created_at)}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/social?tab=profile`}
                    className="text-xs uppercase tracking-[0.2em] text-gray-400 hover:text-white"
                  >
                    View
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
