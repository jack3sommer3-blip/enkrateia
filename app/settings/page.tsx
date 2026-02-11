"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/profile";
import { getDefaultGoalConfig, getPresetConfig } from "@/lib/goals";
import type { Profile } from "@/lib/types";
import Cropper from "react-easy-crop";
import { getCroppedImageBlob } from "@/lib/cropImage";

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export default function SettingsPage() {
  const router = useRouter();
  const { loading, userId, email } = useSession();
  const devMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";
  const [profile, setProfile] = useState<Profile | undefined>();
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [location, setLocation] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [showWorkouts, setShowWorkouts] = useState(true);
  const [showReading, setShowReading] = useState(true);
  const [showDrinking, setShowDrinking] = useState(true);
  const [cropOpen, setCropOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    width: number;
    height: number;
    x: number;
    y: number;
  } | null>(null);

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
      setProfilePhotoUrl(data.profile_photo_url ?? "");
      setIsPublic(data.is_public ?? true);
      setShowWorkouts(data.show_workouts ?? true);
      setShowReading(data.show_reading ?? true);
      setShowDrinking(data.show_drinking ?? true);
      setLocation(data.location ?? "");
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
        profile_photo_url: profilePhotoUrl.trim() || null,
        is_public: isPublic,
        show_workouts: showWorkouts,
        show_reading: showReading,
        show_drinking: showDrinking,
        location: location.trim() || null,
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

  const onCropComplete = useCallback(
    (_: { x: number; y: number }, croppedArea: { width: number; height: number; x: number; y: number }) => {
      setCroppedAreaPixels(croppedArea);
    },
    []
  );

  if (loading || profileLoading) {
    return <StoryLoading name={profile?.first_name} />;
  }

  if (!userId || !profile) return null;

  return (
    <main className="min-h-screen text-white flex flex-col items-center p-8">
      <div className="w-full max-w-4xl pt-10">
        <header className="mb-10">
          <div className="text-xs uppercase tracking-[0.3em] text-gray-500">Settings</div>
          <h1 className="mt-3 text-4xl md:text-5xl font-bold leading-tight">
            Profile Controls
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Private account settings and public profile edits.
          </p>
        </header>

        <section className="command-surface rounded-md p-6">
          <div className="mb-6 flex items-center gap-3">
            <a
              href="/goals"
              className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20 text-gray-300"
            >
              Edit goals
            </a>
            <button
              onClick={() => router.push("/onboarding?preview=1")}
              className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20 text-gray-300"
            >
              Preview onboarding
            </button>
            <button
              onClick={async () => {
                await supabase
                  .from("user_goals")
                  .upsert(
                    {
                      user_id: userId,
                      goals: getDefaultGoalConfig().categories,
                      enabled_categories: getDefaultGoalConfig().enabledCategories,
                      onboarding_completed: false,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "user_id" }
                  );
                router.push("/onboarding");
              }}
              className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20 text-gray-300"
            >
              Reset onboarding
            </button>
            <div className="text-sm text-gray-500">
              Goals control how daily scores are calculated.
            </div>
          </div>
          {devMode ? (
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => router.push("/onboarding?force=1")}
                className="px-4 py-2 rounded-md border border-amber-500/60 text-amber-300 hover:border-amber-400 transition"
              >
                Force onboarding
              </button>
              <button
                onClick={async () => {
                  const preset = getPresetConfig("75-hard");
                  await supabase.from("user_goals").upsert(
                    {
                      user_id: userId,
                      goals: preset.categories,
                      enabled_categories: preset.enabledCategories,
                      onboarding_completed: true,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "user_id" }
                  );
                }}
                className="px-4 py-2 rounded-md border border-amber-500/60 text-amber-300 hover:border-amber-400 transition"
              >
                Seed preset (75 Hard)
              </button>
            </div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-gray-400 text-sm mb-1">Username</div>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full px-4 py-3 rounded-md bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
                placeholder="your_username"
              />
            </div>

            <div>
              <div className="text-gray-400 text-sm mb-1">Display name</div>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 rounded-md bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
                placeholder="Your name"
              />
            </div>

            <div className="md:col-span-2">
              <div className="text-gray-400 text-sm mb-1">Bio</div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-md bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
                placeholder="Short bio"
              />
            </div>

            <div className="md:col-span-2">
              <div className="text-gray-400 text-sm mb-1">Profile photo</div>
              {profilePhotoUrl ? (
                <img
                  src={profilePhotoUrl}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover border border-gray-700 mb-3"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-800 border border-gray-700 mb-3" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.addEventListener("load", () => {
                    setImageSrc(reader.result as string);
                    setCropOpen(true);
                  });
                  reader.readAsDataURL(file);
                }}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-gray-800 file:text-white hover:file:bg-gray-700"
              />
            </div>

            <div className="md:col-span-2">
              <div className="text-gray-400 text-sm mb-2">Privacy</div>
              <label className="flex items-center gap-3 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-5 h-5 rounded-full appearance-none border border-gray-600 bg-black checked:bg-[color:var(--accent)] checked:border-[color:var(--accent-60)] transition"
                />
                Public profile
              </label>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={showWorkouts}
                    onChange={(e) => setShowWorkouts(e.target.checked)}
                    className="w-5 h-5 rounded-full appearance-none border border-gray-600 bg-black checked:bg-[color:var(--accent)] checked:border-[color:var(--accent-60)] transition"
                  />
                  Show workouts
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={showReading}
                    onChange={(e) => setShowReading(e.target.checked)}
                    className="w-5 h-5 rounded-full appearance-none border border-gray-600 bg-black checked:bg-[color:var(--accent)] checked:border-[color:var(--accent-60)] transition"
                  />
                  Show reading
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={showDrinking}
                    onChange={(e) => setShowDrinking(e.target.checked)}
                    className="w-5 h-5 rounded-full appearance-none border border-gray-600 bg-black checked:bg-[color:var(--accent)] checked:border-[color:var(--accent-60)] transition"
                  />
                  Show drinking
                </label>
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-gray-400 text-sm mb-1">Location</div>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-3 rounded-md bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
                placeholder="City, Country"
              />
            </div>
          </div>

          {error ? <div className="text-red-400 text-sm mt-4">{error}</div> : null}

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="px-4 py-2 rounded-md border border-[color:var(--accent-60)] text-[color:var(--accent)] hover:text-white hover:border-[color:var(--accent)] transition disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <div className="text-sm text-gray-500">Signed in as {email}</div>
          </div>
        </section>
      </div>

      {cropOpen && imageSrc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-3xl rounded-md border border-gray-800 bg-gray-950 p-6 command-surface-elevated">
            <div className="flex items-center justify-between">
              <div className="text-xl font-semibold">Crop profile photo</div>
              <button
                onClick={() => {
                  setCropOpen(false);
                  setImageSrc(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-4 relative h-[360px] w-full bg-black rounded-md overflow-hidden">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="text-sm text-gray-400">Zoom</div>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={async () => {
                  if (!croppedAreaPixels || !userId || !imageSrc) return;
                  try {
                    const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
                    const filePath = `${userId}/${crypto.randomUUID()}.jpg`;
                    const { error: uploadError } = await supabase.storage
                      .from("profile-photos")
                      .upload(filePath, blob, { upsert: true, contentType: "image/jpeg" });
                    if (uploadError) {
                      setError(uploadError.message);
                      return;
                    }
                    const { data } = supabase.storage
                      .from("profile-photos")
                      .getPublicUrl(filePath);
                    setProfilePhotoUrl(data.publicUrl);
                    setCropOpen(false);
                    setImageSrc(null);
                  } catch (err: any) {
                    setError(err?.message ?? "Failed to crop image");
                  }
                }}
                className="px-4 py-2 rounded-md border border-[color:var(--accent-60)] text-[color:var(--accent)] hover:text-white hover:border-[color:var(--accent)] transition"
              >
                Save photo
              </button>
              <button
                onClick={() => {
                  setCropOpen(false);
                  setImageSrc(null);
                }}
                className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20 text-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
