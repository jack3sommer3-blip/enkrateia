"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/app/components/useSession";
import { getProfile } from "@/lib/profile";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/feed", label: "Feed" },
  { href: "/people", label: "People" },
  { href: "/today", label: "Today" },
  { href: "/history", label: "History" },
  { href: "/mission", label: "Mission" },
  { href: "/goals", label: "Goals" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
];

export default function TopNav() {
  const pathname = usePathname();
  const { userId } = useSession();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    getProfile(userId).then((profile) => {
      setPhotoUrl(profile?.profile_photo_url ?? null);
    });
  }, [userId]);

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
                      ? "bg-emerald-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]"
                      : "bg-transparent",
                  ].join(" ")}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full border border-white/10 bg-slate-800 overflow-hidden">
            {photoUrl ? (
              <img src={photoUrl} alt="User" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="hidden md:block text-xs text-gray-500">Account</div>
        </div>
      </div>
    </div>
  );
}
