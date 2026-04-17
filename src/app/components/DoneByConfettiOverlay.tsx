"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";

export type DoneByConfettiVariant = "default" | "doneForDay";

type Props = {
  show: boolean;
  targetRef: React.RefObject<HTMLElement | null>;
  /** Done-by time string or fallback label */
  headline: string;
  /** Usually the long-form calendar date */
  subtitle: string;
  /** Current wall-clock time */
  nowClock: string;
  /** Richer burst + timing when the day is fully wrapped up */
  variant?: DoneByConfettiVariant;
  onComplete: () => void;
};

export default function DoneByConfettiOverlay({
  show,
  targetRef,
  headline,
  subtitle,
  nowClock,
  variant = "default",
  onComplete,
}: Props) {
  const flyRef = useRef<HTMLDivElement>(null);
  const mega = variant === "doneForDay";

  useEffect(() => {
    if (!show) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onComplete();
      return;
    }

    const fly = flyRef.current;
    const target = targetRef.current;
    const dwellMs = mega ? 420 : 320;
    const flyMs = mega ? 1020 : 880;
    const ease = mega
      ? "transform 1.02s cubic-bezier(0.18, 1, 0.28, 1), opacity 1.02s ease-out"
      : "transform 0.88s cubic-bezier(0.22, 1, 0.32, 1), opacity 0.88s ease-out";

    const flyToTarget = () => {
      if (!fly || !target) {
        onComplete();
        return;
      }
      fly.style.transition = ease;
      const fr = fly.getBoundingClientRect();
      const tr = target.getBoundingClientRect();
      const dx = tr.left + tr.width / 2 - (fr.left + fr.width / 2);
      const dy = tr.top + tr.height / 2 - (fr.top + fr.height / 2);
      const s =
        Math.min(tr.width / Math.max(fr.width, 1), tr.height / Math.max(fr.height, 1), 1) *
        (mega ? 0.96 : 0.92);
      fly.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${s})`;
      fly.style.opacity = "0";
    };

    const burst = window.setTimeout(flyToTarget, dwellMs);
    const done = window.setTimeout(onComplete, dwellMs + flyMs + (mega ? 120 : 0));
    return () => {
      window.clearTimeout(burst);
      window.clearTimeout(done);
    };
  }, [show, targetRef, onComplete, mega]);

  if (!show || typeof document === "undefined") return null;

  const particleCount = mega ? 108 : 52;
  const layerClass = mega
    ? "done-by-confetti-layer done-by-confetti-layer--mega pointer-events-none fixed inset-0 z-[200]"
    : "done-by-confetti-layer pointer-events-none fixed inset-0 z-[200]";

  const particles = Array.from({ length: particleCount }).map((_, i) => {
    const row2 = mega && i >= particleCount / 2;
    const topPct = mega ? (row2 ? 54 : 34) : 36;
    const dMin = mega ? 260 : 180;
    const dRange = mega ? 380 : 280;
    const xJitter = mega ? (Math.random() - 0.5) * 220 : 0;
    const palette = mega
      ? i % 4 === 0
        ? "var(--color-primary)"
        : i % 4 === 1
          ? "var(--color-calendar)"
          : i % 4 === 2
            ? "var(--color-success)"
            : "var(--color-warning)"
      : i % 3 === 0
        ? "var(--color-primary)"
        : i % 3 === 1
          ? "var(--color-calendar)"
          : "var(--color-success)";

    return (
      <span
        key={i}
        className={
          mega
            ? "done-by-confetti-particle done-by-confetti-particle--mega"
            : "done-by-confetti-particle"
        }
        style={
          {
            top: `${topPct}%`,
            "--d": `${dMin + Math.random() * dRange}px`,
            ...(mega ? { "--x": `${xJitter}px` } : {}),
            "--a": `${Math.random() * 360}deg`,
            "--delay": `${Math.random() * (mega ? 0.35 : 0.2)}s`,
            backgroundColor: palette,
          } as React.CSSProperties
        }
      />
    );
  });

  return createPortal(
    <div className={layerClass} aria-hidden>
      {particles}
      <div
        ref={flyRef}
        className={
          mega
            ? "done-by-confetti-flycard done-by-confetti-flycard--mega fixed left-1/2 top-[36%] z-[210] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border-2 border-success/50 bg-card/95 px-10 py-6 text-center shadow-2xl shadow-success/20 ring-4 ring-success/25 backdrop-blur-md sm:top-[38%]"
            : "done-by-confetti-flycard fixed left-1/2 top-[38%] z-[210] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border border-border bg-card/95 px-8 py-5 text-center shadow-2xl backdrop-blur-md"
        }
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Now</p>
        <p
          className={
            mega
              ? "font-black tabular-nums text-primary text-4xl sm:text-5xl"
              : "font-black tabular-nums text-primary text-3xl sm:text-4xl"
          }
        >
          {nowClock}
        </p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
          {mega ? "All clear" : "Done by"}
        </p>
        <p
          className={
            mega
              ? "font-black tabular-nums text-success text-3xl leading-tight sm:text-4xl"
              : "font-black tabular-nums text-primary text-3xl sm:text-4xl"
          }
        >
          {headline}
        </p>
        <p className="mt-1 max-w-[min(90vw,22rem)] text-sm text-text-muted">{subtitle}</p>
      </div>
    </div>,
    document.body
  );
}
