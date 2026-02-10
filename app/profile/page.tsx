"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/app/components/Nav";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { getProfile } from "@/lib/profile";
import type { Profile } from "@/lib/types";

export default function ProfilePage() {
  const router = useRouter();
  const { loading, userId } = useSession();
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
      if (data?.username) router.replace(`/u/${data.username}`);
    });
  }, [loading, router, userId]);

  if (loading || profileLoading) {
    return <StoryLoading name={profile?.first_name} />;
  }

  if (!userId || !profile) return null;

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center p-8">
      <div className="w-full max-w-5xl">
        <header className="mb-10 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="text-gray-500 text-sm tracking-[0.3em]">ENKRATEIA</div>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              Profile
            </h1>
            <p className="text-gray-400">
              Redirecting to your public profile…
            </p>
          </div>
          <Nav />
        </header>
      </div>
    </main>
  );
}
