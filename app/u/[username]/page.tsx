"use client";

import { useParams } from "next/navigation";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import ProfileView from "@/app/components/profile/ProfileView";

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params?.username?.toLowerCase();
  const { loading, userId } = useSession();

  if (loading) return <StoryLoading />;

  return (
    <main className="min-h-screen text-white flex flex-col items-center p-8">
      <div className="w-full max-w-5xl pt-10">
        <ProfileView username={username} viewerId={userId} />
      </div>
    </main>
  );
}
