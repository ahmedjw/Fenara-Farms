"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A photo slot.
 *
 * Renders the real image from /public/photos. If the file is not there yet it
 * falls back to a labelled placeholder naming the exact filename and the shot
 * that belongs in it. Drop the file into /public/photos with that name and the
 * placeholder disappears on its own. No code change needed.
 */

type Props = {
  /** Filename inside /public/photos, e.g. "hero-grove.jpg". */
  src: string;
  alt: string;
  /** What to shoot, shown on the placeholder. */
  brief: string;
  /** Recommended pixel dimensions, shown on the placeholder. */
  size: string;
  className?: string;
  priority?: boolean;
};

export function Photo({
  src,
  alt,
  brief,
  size,
  className = "",
  priority,
}: Props) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // A missing image usually 404s before React hydrates, which loses the
  // onError event entirely, so check again on mount. "Complete with no width"
  // is not proof: Safari reports exactly that for a lazy image further down
  // the page that simply has not started loading, which used to swap real
  // photos for placeholders. Ask the server whether the file is there instead.
  useEffect(() => {
    const img = ref.current;
    if (!img || img.naturalWidth > 0) return;
    let cancelled = false;
    fetch(img.getAttribute("src") ?? "", { method: "HEAD" })
      .then((res) => {
        if (!res.ok && !cancelled) setFailed(true);
      })
      .catch(() => {
        // Offline or blocked: keep the image and let onError decide.
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (failed) {
    return (
      <div
        className={`relative flex flex-col justify-between overflow-hidden bg-paper-sunk p-5 ${className}`}
        role="img"
        aria-label={`Placeholder for ${alt}`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, transparent 0 11px, var(--color-line) 11px 12px)",
          }}
        />
        <span className="mono-label relative">Photo needed</span>
        <span className="relative mt-6 block">
          <span className="block font-mono text-[12px] text-olive">
            /photos/{src}
          </span>
          <span className="mt-1 block max-w-[38ch] text-[13px] leading-snug text-stone">
            {brief}
          </span>
          <span className="mt-1 block font-mono text-[11px] text-stone-light">
            {size}
          </span>
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={`/photos/${src}`}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
