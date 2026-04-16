"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/settings", label: "Settings" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border bg-card">
      <div className="max-w-6xl mx-auto px-4 flex items-center h-14 gap-6">
        <Link href="/" className="font-black text-lg text-primary mr-4 uppercase tracking-wide">
          TaskTracker
        </Link>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm font-medium transition-colors ${
              pathname === link.href
                ? "text-primary"
                : "text-text-muted hover:text-text"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
