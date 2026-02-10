"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/app/components/useSession";
import { getProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/social", label: "Social" },
  { href: "/logs", label: "Logs" },
  { href: "/mission", label: "Mission" },
  { href: "/goals", label: "Goals" },
];

export default function TopNav() {
  const pathname = usePathname();
  const { userId } = useSession();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userId) return;
    getProfile(userId).then((profile) => {
      setPhotoUrl(profile?.profile_photo_url ?? null);
    });
  }, [userId]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("click", handleClick);
    }
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

  return (
    <div className="sticky top-0 z-50 border-b border-white/10 bg-[#0B1220]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="text-xs tracking-[0.4em] text-gray-500">ENKRATEIA</div>
        </div>

        <nav className="flex flex-1 items-center justify-center gap-6 overflow-x-auto px-4 text-sm text-gray-400">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "relative pb-2 transition-colors",
                  active ? "text-white" : "hover:text-white",
                ].join(" ")}
              >
                {link.label}
                <span
                  className={[
                    "absolute left-0 right-0 -bottom-1 h-0.5 transition-all",
                    active
                      ? "accent-underline"
                      : "bg-transparent",
                  ].join(" ")}
                />
              </Link>
            );
          })}
        </nav>

        <div className="relative flex items-center gap-3" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="h-9 w-9 rounded-full border border-white/10 bg-slate-800 overflow-hidden flex items-center justify-center"
            aria-label="Open account menu"
          >
            {photoUrl ? (
              <img src={photoUrl} alt="User" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-gray-400">AC</span>
            )}
          </button>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="hidden md:block text-xs text-gray-500 hover:text-white transition"
          >
            Account
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-12 w-48 rounded-md border border-white/10 bg-[#0B1220] shadow-[0_16px_30px_rgba(0,0,0,0.4)]">
              <Link
                href="/settings"
                className="block px-4 py-3 text-sm text-gray-200 hover:bg-white/5"
                onClick={() => setMenuOpen(false)}
              >
                Account / Settings
              </Link>
              <Link
                href="/social?tab=profile"
                className="block px-4 py-3 text-sm text-gray-200 hover:bg-white/5"
                onClick={() => setMenuOpen(false)}
              >
                My Profile
              </Link>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setMenuOpen(false);
                }}
                className="w-full text-left px-4 py-3 text-sm text-gray-400 hover:text-white hover:bg-white/5"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
