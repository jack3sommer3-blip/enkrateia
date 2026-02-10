"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getAuthRedirectUrl } from "@/lib/authRedirect";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    setError(null);
    const redirectTo = getAuthRedirectUrl();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  };

  const handleEmailAuth = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.replace("/");
      return;
    }

    const redirectTo = getAuthRedirectUrl();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setMessage("Check your email to confirm your account.");
  };

  return (
    <main className="min-h-screen text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="text-gray-500 text-sm tracking-[0.3em]">ENKRATEIA</div>
        <h1 className="text-4xl font-semibold mt-4">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-gray-400 mt-2">
          Enkrateia: self-mastery. Akrasia: knowing the good, and failing to do it.
        </p>

        <button
          onClick={signInWithGoogle}
          className="mt-6 w-full px-4 py-3 rounded-md border border-white/10 bg-white text-black font-semibold hover:bg-gray-100 transition"
        >
          Continue with Google
        </button>

        <div className="my-6 text-center text-gray-600 text-sm">or</div>

        <div className="space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            className="w-full px-4 py-3 rounded-md bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            className="w-full px-4 py-3 rounded-md bg-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
          />
        </div>

        {error ? <div className="text-red-400 text-sm mt-3">{error}</div> : null}
        {message ? (
          <div className="text-[color:var(--accent)] text-sm mt-3">{message}</div>
        ) : null}

        <button
          onClick={handleEmailAuth}
          disabled={loading}
          className="mt-5 w-full px-4 py-3 rounded-md border border-[color:var(--accent-60)] text-[color:var(--accent)] hover:border-[color:var(--accent)] transition disabled:opacity-50"
        >
          {loading
            ? "Working…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>

        <button
          onClick={() => setMode((prev) => (prev === "signin" ? "signup" : "signin"))}
          className="mt-4 text-sm text-gray-400 hover:text-white transition"
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
