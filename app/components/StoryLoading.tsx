"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Enkrateia is self-mastery — command over impulse.",
  "Akrasia is knowing the good, and failing to do it.",
  "Today is a fresh arena. Build the streak, one honest day at a time.",
];

export default function StoryLoading({ name }: { name?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        <div className="text-gray-500 text-sm tracking-[0.3em]">ENKRATEIA</div>
        <h1 className="mt-4 text-4xl md:text-6xl font-semibold leading-tight">
          {name ? `Hello, ${name}.` : "Welcome."}
        </h1>
        <p className="mt-6 text-lg text-gray-300 min-h-[3.5rem]">
          {MESSAGES[index]}
        </p>
        <div className="mt-10 h-1 w-full bg-gray-900 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-emerald-500 animate-[load_2.2s_ease-in-out_infinite]" />
        </div>
      </div>
    </main>
  );
}
