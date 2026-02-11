import { Suspense } from "react";
import StoryLoading from "@/app/components/StoryLoading";
import OnboardingClient from "@/app/onboarding/OnboardingClient";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<StoryLoading />}>
      <OnboardingClient />
    </Suspense>
  );
}
