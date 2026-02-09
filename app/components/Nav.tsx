"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/today", label: "Today" },
  { href: "/history", label: "History" },
  { href: "/mission", label: "Mission" },
  { href: "/profile", label: "Profile" },
  { href: "/goals", label: "Goals" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2 md:gap-3">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "px-4 py-2 rounded-xl border transition",
              active
                ? "bg-emerald-950 border-emerald-700 text-white"
                : "bg-gray-900 border-gray-800 text-gray-300 hover:text-white",
            ].join(" ")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
