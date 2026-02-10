"use client";

import Nav from "@/app/components/Nav";

const MISSION = [
  "Welcome to Enkrateia.",
  "Thank you for answering the call to join me on this journey towards a more disciplined life. Whatever your goals may be, it is my hope that this platform helps you achieve them.",
  "What is measured is confronted.\nWhat is confronted is improved.",
  "-Jack Sommer\n@jack",
  "Here are the words that inspired this platform:",
  "Akrasia (ἀκρασία)",
  "Literal meaning: “Lack of control”\nBreakdown: a- (without) + kratos (power / rule)",
  "Definition:\n\nActing against your better judgment because of weakness of will.",
  "Enkrateia (ἐγκράτεια)",
  "Literal meaning: “Power within” / “Self-mastery”\nBreakdown: en- (within) + kratos (power / rule)",
  "Definition:\n\nSelf-control; the ability to act according to reason rather than impulse.",
];

export default function MissionPage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center p-8">
      <div className="w-full max-w-3xl">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <div className="text-gray-500 text-sm tracking-[0.3em]">ENKRATEIA</div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">Mission</h1>
          </div>
          <Nav className="justify-end" />
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
