"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { broadcastStartMyDay } from "./StartMyDayNavButton";

/**
 * Handles /?startMyDay=1 so "Start my day" works when coming from another page.
 */
export default function StartMyDayUrlSync() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (searchParams.get("startMyDay") !== "1") return;
    if (handled.current) return;
    handled.current = true;
    const t = window.setTimeout(() => {
      broadcastStartMyDay();
      router.replace("/", { scroll: false });
    }, 0);
    return () => window.clearTimeout(t);
  }, [searchParams, router]);

  return null;
}
