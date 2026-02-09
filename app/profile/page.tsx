"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/app/components/Nav";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { supabase } from "@/lib/supabase";
import { getProfile, Profile } from "@/lib/profile";

export default function ProfilePage() {
  const router = useRouter();
  const { loading, userId, email } = useSession();
  const [profile, setProfile] = useState<Profile | undefined>();
  const [profileLoading, setProfileLoading] = useState(true);

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
      if (!data) router.replace("/onboarding");
    });
  }, [loading, router, userId]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading || profileLoading) {
    return <StoryLoading name={profile?.first_name} />;
  }

  if (!userId || !profile) return null;

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        <header className="mb-10 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="text-gray-500 text-sm tracking-[0.3em]">ENKRATEIA</div>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              Profile
            </h1>
            <p className="text-gray-400">
              Manage your account details and sign out.
            </p>
          </div>

          <Nav />
        </header>

        <section className="p-6 rounded-2xl border border-gray-800 bg-gray-900">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-gray-400 text-sm">First name</div>
              <div className="text-xl font-semibold mt-1">
                {profile.first_name}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Last name</div>
              <div className="text-xl font-semibold mt-1">{profile.last_name}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Username</div>
              <div className="text-xl font-semibold mt-1">{profile.username}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm">Email</div>
              <div className="text-xl font-semibold mt-1">{email ?? "—"}</div>
            </div>
          </div>

          <button
            onClick={signOut}
            className="mt-6 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition"
          >
            Sign out
          </button>
        </section>
      </div>
    </main>
  );
}
