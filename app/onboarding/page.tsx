"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import StoryLoading from "@/app/components/StoryLoading";
import { useSession } from "@/app/components/useSession";
import { getProfile } from "@/lib/profile";

export default function OnboardingPage() {
  const router = useRouter();
  const { loading, userId, email } = useSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      router.replace("/login");
      return;
    }
    getProfile(userId).then((profile) => {
      if (profile) router.replace("/");
    });
  }, [loading, router, userId]);

  const saveProfile = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      setError("Please fill out all fields.");
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from("profiles").insert({
      id: userId,
      email,
      username: username.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    });
    setSaving(false);
    if (insertError) {
      if (insertError.code === "23505") {
        setError("That username is already taken.");
      } else {
        setError(insertError.message);
      }
      return;
    }
    router.replace("/");
  };

  if (loading) {
    return <StoryLoading />;
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <div className="text-gray-500 text-sm tracking-[0.3em]">ENKRATEIA</div>
        <h1 className="text-4xl font-semibold mt-4">Create your profile</h1>
        <p className="text-gray-400 mt-2">
          Your username will be public within the app.
        </p>

        <div className="mt-6 space-y-4">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            className="w-full px-4 py-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            className="w-full px-4 py-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="Username"
            className="w-full px-4 py-3 rounded-xl bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
          />
        </div>

        {error ? <div className="text-red-400 text-sm mt-3">{error}</div> : null}
        <button
          onClick={saveProfile}
          disabled={saving}
          className="mt-6 w-full px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 transition disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </main>
  );
}
