"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate, site } from "@/lib/site";

const closesAt = Date.parse(site.adoptionsCloseAt);

/**
 * "Adoptions close for this harvest in ..." strip under the header.
 *
 * Renders nothing on the server and until the first tick, so the server and
 * the browser never disagree about the time, and hides itself once adoptions
 * have closed. The ticking numbers are hidden from screen readers, which get
 * the closing date instead of an announcement every second.
 */
export function HarvestCountdown() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (now === null || now >= closesAt) return null;

  const seconds = Math.floor((closesAt - now) / 1000);
  const parts: [number, string][] = [
    [Math.floor(seconds / 86400), "d"],
    [Math.floor(seconds / 3600) % 24, "h"],
    [Math.floor(seconds / 60) % 60, "m"],
    [seconds % 60, "s"],
  ];

  return (
    <Link
      href="/adopt"
      className="mx-auto flex w-fit items-center gap-2.5 rounded-b-[2px] bg-brick px-4 py-1.5 text-[12px] text-white transition-colors hover:bg-brick-dark"
    >
      <span className="sr-only">
        Adoptions for this harvest close on {formatDate(closesAt)}.
      </span>
      <span aria-hidden>
        Adoptions close<span className="hidden sm:inline"> for this harvest</span> in
      </span>
      <span aria-hidden className="flex items-center gap-1 font-mono tabular-nums">
        {parts.map(([value, unit], i) => (
          <span key={unit} className="flex items-center gap-1">
            {i > 0 && <span className="opacity-70">:</span>}
            <span className="rounded-[2px] bg-white/15 px-1">
              {String(value).padStart(2, "0")}
              <span className="opacity-70">{unit}</span>
            </span>
          </span>
        ))}
      </span>
    </Link>
  );
}
