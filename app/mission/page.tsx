"use client";

import Nav from "@/app/components/Nav";

const MISSION = [
  "ENKRATEIA",
  "A System for Self-Discipline",
  "I recently came across the greek word Akrasia.\nIt is the condition of knowing what is right and failing to do it.",
  "We live in an age that rewards impulse. Comfort is abundant and distraction is constant.",
  "Food arrives at our doorsteps without effort. We have infinite entertainment at our fingertips, and indulgence is encouraged.",
  "I felt the word akrasia, although ancient, described our society disgustingly well.",
  "Enkrateia is the antithesis of akrasia.",
  "The Greeks used the word to describe self-mastery. The ability to act in accordance with reason. The strength to do what must be done when it would be easier not to.",
  "This platform exists to cultivate that strength.",
  "You train your body.\nYou sharpen your mind.\nYou guard your sleep.\nYou prepare your meals.\nYou account for your days.",
  "What is measured is confronted.\nWhat is confronted is improved.",
  "Enkrateia provides structure where impulse would otherwise rule.",
  "A record of your effort. A visible account of your standards. A daily decision to choose the harder path.",
  "The question is not whether the world tempts you.",
  "The question is whether you will answer.",
  "Enkrateia is a system for those who intend to.",
];

export default function MissionPage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center p-8">
      <div className="w-full max-w-3xl">
        <header className="mb-10 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="text-gray-500 text-sm tracking-[0.3em]">ENKRATEIA</div>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">Mission</h1>
            <p className="text-gray-400">
              The philosophy behind the system, written plainly.
            </p>
          </div>

          <Nav />
        </header>

        <section className="space-y-6 text-lg leading-relaxed text-gray-200">
          {MISSION.map((block) => (
            <p key={block} className="whitespace-pre-line">
              {block}
            </p>
          ))}
        </section>
      </div>
    </main>
  );
}
