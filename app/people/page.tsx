"use client";

import { useEffect, useState } from "react";
import Nav from "@/app/components/Nav";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { searchUsers, followUser, unfollowUser } from "@/lib/social";
import type { Profile } from "@/lib/types";

export default function PeoplePage() {
  const { loading, userId } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [following, setFollowing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoadingResults(true);
    searchUsers(query).then((data) => {
      setResults(data);
      setLoadingResults(false);
    });
  }, [query]);

  if (loading) return <StoryLoading />;

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center p-8">
      <div className="w-full max-w-4xl">
        <header className="mb-10 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="text-gray-500 text-sm tracking-[0.3em]">ENKRATEIA</div>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">People</h1>
            <p className="text-gray-400">Search users by username.</p>
          </div>
          <Nav />
        </header>

        <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.toLowerCase())}
            placeholder="Search by username"
            className="w-full px-4 py-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
          />

          <div className="mt-6 space-y-3">
            {loadingResults ? (
              <div className="text-gray-500">Searching…</div>
            ) : results.length === 0 ? (
              <div className="text-gray-500">No users found.</div>
            ) : (
              results.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-4 rounded-2xl border border-gray-800 bg-black"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 overflow-hidden">
                      {profile.profile_photo_url ? (
                        <img
                          src={profile.profile_photo_url}
                          alt={profile.display_name ?? profile.username}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div>
                      <a
                        href={`/u/${profile.username}`}
                        className="text-white hover:text-emerald-300 transition"
                      >
                        {profile.display_name ?? profile.username}
                      </a>
                      <div className="text-gray-400 text-sm">@{profile.username}</div>
                    </div>
                  </div>
                  {userId && userId !== profile.id ? (
                    <button
                      onClick={async () => {
                        if (following[profile.id]) {
                          const ok = await unfollowUser(userId, profile.id);
                          if (ok)
                            setFollowing((prev) => ({
                              ...prev,
                              [profile.id]: false,
                            }));
                        } else {
                          const res = await followUser(userId, profile.id);
                          if (res)
                            setFollowing((prev) => ({
                              ...prev,
                              [profile.id]: true,
                            }));
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition"
                    >
                      {following[profile.id] ? "Unfollow" : "Follow"}
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
