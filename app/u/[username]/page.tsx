"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Nav from "@/app/components/Nav";
import StoryLoading from "@/app/components/StoryLoading";
import { getProfileByUsername } from "@/lib/profile";
import type { Profile } from "@/lib/types";

function initials(profile: Profile) {
  const first = profile.first_name?.[0] ?? "";
  const last = profile.last_name?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params?.username?.toLowerCase();
  const [profile, setProfile] = useState<Profile | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    getProfileByUsername(username).then((data) => {
      setProfile(data);
      setLoading(false);
    });
  }, [username]);

  if (loading) return <StoryLoading />;

  if (!profile) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-8">
        <div className="text-gray-400">Profile not found.</div>
      </main>
    );
  }

  const displayName = profile.display_name || `${profile.first_name} ${profile.last_name}`;

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center p-8">
      <div className="w-full max-w-5xl">
        <header className="mb-10 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-2xl font-semibold">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  initials(profile)
                )}
              </div>
              <div>
                <div className="text-3xl font-semibold">{displayName}</div>
                <div className="text-gray-400">@{profile.username}</div>
                {profile.location ? (
                  <div className="text-gray-500 text-sm">{profile.location}</div>
                ) : null}
                {profile.website ? (
                  <a
                    href={profile.website}
                    className="text-gray-400 text-sm hover:text-white"
                  >
                    {profile.website}
                  </a>
                ) : null}
              </div>
            </div>

            <Link
              href="/"
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition"
            >
              Back to app
            </Link>
          </div>

          <Nav />
        </header>

        {profile.bio ? (
          <section className="p-6 rounded-2xl border border-gray-800 bg-gray-900 text-gray-200">
            {profile.bio}
          </section>
        ) : (
          <section className="p-6 rounded-2xl border border-gray-800 bg-gray-900 text-gray-500">
            No bio yet.
          </section>
        )}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {[
            { label: "Enkrateia score", value: "Coming soon" },
            { label: "Workouts this week", value: "Coming soon" },
            { label: "Pages read this week", value: "Coming soon" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-5 rounded-2xl border border-gray-800 bg-gray-900"
            >
              <div className="text-gray-400 text-sm">{stat.label}</div>
              <div className="text-xl font-semibold mt-2">{stat.value}</div>
            </div>
          ))}
        </section>

        <section className="mt-8">
          <div className="text-xl font-semibold mb-3">Recent activity</div>
          <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900 text-gray-500">
            Activity feed coming soon.
          </div>
        </section>
      </div>
    </main>
  );
}
