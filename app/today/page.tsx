"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DailyLog from "@/app/components/DailyLog";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { getProfile, Profile } from "@/lib/profile";
import { todayKey } from "@/lib/utils";

export default function TodayPage() {
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
    });
  }, [loading, router, userId]);

  if (loading || profileLoading) {
    return <StoryLoading name={profile?.first_name} />;
  }

  if (!userId || !profile) return null;

  return (
    <DailyLog
      dateKey={todayKey()}
      userId={userId}
      title={`Daily Log — ${todayKey()}`}
    />
  );
}
