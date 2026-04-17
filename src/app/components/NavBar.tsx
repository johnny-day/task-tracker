"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import StartMyDayNavButton from "./StartMyDayNavButton";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/settings", label: "Settings" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border bg-card">
      <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center gap-y-2 min-h-14 py-2 gap-x-6">
        <Link href="/" className="font-black text-lg text-primary uppercase tracking-wide shrink-0">
          TaskTracker
        </Link>
        <div className="flex items-center gap-6 flex-1 min-w-0">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors shrink-0 ${
                pathname === link.href
                  ? "text-primary"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <StartMyDayNavButton />
      </div>
    </nav>
  );
}
