"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/app/components/Nav";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/profile";
import type { Profile } from "@/lib/types";

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export default function SettingsPage() {
  const router = useRouter();
  const { loading, userId, email } = useSession();
  const [profile, setProfile] = useState<Profile | undefined>();
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      router.replace("/login");
      return;
    }
    setProfileLoading(true);
    getProfile(userId).then((data) => {
      setProfile(data);
      setProfileLoading(false);
      if (!data) {
        router.replace("/onboarding");
        return;
      }
      setUsername(data.username ?? "");
      setDisplayName(
        data.display_name ?? `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim()
      );
      setBio(data.bio ?? "");
      setAvatarUrl(data.avatar_url ?? "");
      setLocation(data.location ?? "");
      setWebsite(data.website ?? "");
    });
  }, [loading, router, userId]);

  const saveProfile = async () => {
    setError(null);
    if (!USERNAME_REGEX.test(username)) {
      setError("Username must be 3–20 characters: a-z, 0-9, underscore.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        username: username.trim(),
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        location: location.trim() || null,
        website: website.trim() || null,
      })
      .eq("id", userId);
    setSaving(false);
    if (updateError) {
      if (updateError.code === "23505") {
        setError("That username is already taken.");
      } else {
        setError(updateError.message);
      }
      return;
    }
  };

  if (loading || profileLoading) {
    return <StoryLoading name={profile?.first_name} />;
  }

  if (!userId || !profile) return null;

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center p-8">
      <div className="w-full max-w-4xl">
        <header className="mb-10 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="text-gray-500 text-sm tracking-[0.3em]">ENKRATEIA</div>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              Settings
            </h1>
            <p className="text-gray-400">
              Private account settings and public profile edits.
            </p>
          </div>

          <Nav />
        </header>

        <section className="p-6 rounded-2xl border border-gray-800 bg-gray-900">
          <div className="mb-6 flex items-center gap-3">
            <a
              href="/goals"
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition"
            >
              Edit goals
            </a>
            <div className="text-sm text-gray-500">
              Goals control how daily scores are calculated.
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-gray-400 text-sm mb-1">Username</div>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full px-4 py-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
                placeholder="your_username"
              />
            </div>

            <div>
              <div className="text-gray-400 text-sm mb-1">Display name</div>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
                placeholder="Your name"
              />
            </div>

            <div className="md:col-span-2">
              <div className="text-gray-400 text-sm mb-1">Bio</div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
                placeholder="Short bio"
              />
            </div>

            <div>
              <div className="text-gray-400 text-sm mb-1">Avatar URL</div>
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
                placeholder="https://..."
              />
            </div>

            <div>
              <div className="text-gray-400 text-sm mb-1">Location</div>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
                placeholder="City, Country"
              />
            </div>

            <div className="md:col-span-2">
              <div className="text-gray-400 text-sm mb-1">Website</div>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
                placeholder="https://..."
              />
            </div>
          </div>

          {error ? <div className="text-red-400 text-sm mt-4">{error}</div> : null}

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 transition disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <div className="text-sm text-gray-500">Signed in as {email}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
