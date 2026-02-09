"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DailyLog from "@/app/components/DailyLog";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { getProfile, Profile } from "@/lib/profile";

function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function DayPage() {
  const router = useRouter();
  const params = useParams<{ date: string }>();
  const dateKey = params?.date;
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

  useEffect(() => {
    if (dateKey && !isValidDateKey(dateKey)) {
      router.replace("/history");
    }
  }, [dateKey, router]);

  if (loading || profileLoading) {
    return <StoryLoading name={profile?.first_name} />;
  }

  if (!userId || !profile || !dateKey) return null;

  return (
    <DailyLog
      dateKey={dateKey}
      userId={userId}
      title={`Daily Log — ${dateKey}`}
    />
  );
}
