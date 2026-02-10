"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/feed", label: "Feed" },
  { href: "/people", label: "People" },
  { href: "/today", label: "Today" },
  { href: "/history", label: "History" },
  { href: "/mission", label: "Mission" },
  { href: "/profile", label: "Profile" },
  { href: "/goals", label: "Goals" },
  { href: "/settings", label: "Settings" },
];

export default function Nav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={["flex flex-wrap items-center gap-2 md:gap-3", className ?? ""].join(" ")}>
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "px-4 py-2 rounded-full border transition text-sm font-medium",
              active
                ? "bg-[color:var(--accent-10)] border-[color:var(--accent-40)] text-white"
                : "bg-gray-900/70 border-gray-800 text-gray-300 hover:text-white hover:border-gray-600",
            ].join(" ")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
