"use client";

import { Printer } from "@phosphor-icons/react";
import type { Adoption } from "@/lib/store";
import { describePlot } from "@/lib/plots";
import { site } from "@/lib/site";

/**
 * Adoption certificate.
 *
 * Rendered as real HTML rather than a generated PDF so it prints cleanly at
 * any size and stays readable on screen. The print stylesheet strips the site
 * chrome so the browser's "save as PDF" produces a usable document.
 */
export function Certificate({
  adoption,
  tierName,
}: {
  adoption: Adoption;
  tierName: string;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4 print:hidden">
        <h2 className="mono-label">Your certificate</h2>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-[2px] border border-line-strong px-4 py-2 text-[13px] text-ink transition-colors hover:border-ink hover:bg-paper-raised"
        >
          <Printer size={15} weight="light" />
          Print or save as PDF
        </button>
      </div>

      <article
        id="certificate"
        className="border border-line-strong bg-paper-raised p-8 md:p-14 print:border-0 print:bg-white"
      >
        <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-6">
          <span className="display text-[32px] leading-none text-olive">
            {site.name}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone">
            Certificate of adoption
          </span>
        </header>

        <p className="mt-10 text-[14px] text-stone">This certifies that</p>
        <p className="display mt-2 text-[clamp(2rem,5vw,3rem)] leading-tight text-ink">
          {adoption.customerName}
        </p>
        <p className="mt-6 max-w-[56ch] text-[16px] leading-relaxed text-stone">
          has adopted {adoption.trees.length}{" "}
          {adoption.trees.length === 1 ? "Picual olive tree" : "Picual olive trees"}{" "}
          at {site.name} in Andalusia, Southern Spain, for the{" "}
          {adoption.season} harvest season, under the {tierName} adoption.
        </p>

        <ul className="mt-10 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2">
          {adoption.trees.map((id) => (
            <li key={id} className="bg-paper-raised p-5 print:bg-white">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
                {id}
              </p>
              <p className="display mt-1.5 text-[24px] leading-tight text-olive">
                {adoption.names[id]}
              </p>
              <p className="mt-2 text-[13px] text-stone">
                {describePlot(id).place}
              </p>
            </li>
          ))}
        </ul>

        {adoption.giftMessage && (
          <blockquote className="mt-10 border-l-2 border-brick pl-5">
            <p className="display text-[20px] italic leading-[1.5] text-ink">
              {adoption.giftMessage}
            </p>
            {adoption.giftFrom && (
              <footer className="mt-2 text-[14px] text-stone">
                From {adoption.giftFrom}
              </footer>
            )}
          </blockquote>
        )}

        <footer className="mt-12 flex flex-wrap items-end justify-between gap-6 border-t border-line pt-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
              Adoption number
            </p>
            <p className="mt-1 font-mono text-[16px] text-ink">
              {adoption.number}
            </p>
          </div>
          <p className="max-w-[30ch] text-right text-[13px] leading-relaxed text-stone">
            Rooted in history. Restored by nature. Made for today.
          </p>
        </footer>
      </article>

    </div>
  );
}
