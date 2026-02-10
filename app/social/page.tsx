import { Suspense } from "react";
import StoryLoading from "@/app/components/StoryLoading";
import SocialClient from "@/app/social/SocialClient";

export default function SocialPage() {
  return (
    <Suspense fallback={<StoryLoading />}>
      <SocialClient />
    </Suspense>
  );
}
