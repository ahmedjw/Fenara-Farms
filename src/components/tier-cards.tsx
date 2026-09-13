import Link from "next/link";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { formatPrice, tiers } from "@/lib/site";

/**
 * Adoption tiers.
 *
 * Deliberately not three identical columns. The middle tier carries more
 * weight because it is the one most people want, and the grid reflects that
 * rather than pretending all three are equal.
 *
 * On wider screens each card is a subgrid of the same rows, so taglines,
 * prices and buttons line up across the cards however long each blurb runs.
 */
export function TierCards({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`grid gap-px overflow-hidden rounded-[2px] border border-line bg-line md:grid-cols-3 ${
        compact
          ? "md:grid-rows-[repeat(4,auto)_1fr]"
          : "md:grid-rows-[repeat(4,auto)_1fr_auto]"
      }`}
    >
      {tiers.map((tier) => (
        <div
          key={tier.id}
          className={`flex flex-col p-7 md:grid md:grid-rows-subgrid md:p-8 ${
            compact ? "md:row-span-5" : "md:row-span-6"
          } ${tier.featured ? "bg-olive text-paper" : "bg-paper-raised"}`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h3
              className={`display text-[30px] leading-none ${
                tier.featured ? "text-paper" : "text-olive"
              }`}
            >
              {tier.name}
            </h3>
            <span
              className={`font-mono text-[11px] uppercase tracking-[0.12em] ${
                tier.featured ? "text-olive-soft" : "text-stone"
              }`}
            >
              {tier.englishName}
            </span>
          </div>

          <p
            className={`display mt-5 text-[23px] leading-snug ${
              tier.featured ? "text-paper" : "text-ink"
            }`}
          >
            {tier.tagline}
          </p>

          <p
            className={`mt-3 text-[14px] leading-relaxed ${
              tier.featured ? "text-olive-soft" : "text-stone"
            }`}
          >
            {tier.blurb}
          </p>

          <div
            className={`mt-7 border-t pt-5 ${
              tier.featured ? "border-olive-mid" : "border-line"
            }`}
          >
            <span
              className={`display text-[44px] leading-none ${
                tier.featured ? "text-paper" : "text-ink"
              }`}
            >
              {formatPrice(tier.price)}
            </span>
            <span
              className={`ml-2 text-[14px] ${
                tier.featured ? "text-olive-soft" : "text-stone"
              }`}
            >
              per season
            </span>
          </div>

          {!compact && (
            <ul className="mt-6 flex-1 space-y-3">
              {tier.includes.map((item) => (
                <li key={item} className="flex gap-2.5 text-[14px] leading-snug">
                  <Check
                    size={15}
                    weight="bold"
                    className={`mt-1 shrink-0 ${
                      tier.featured ? "text-olive-soft" : "text-brick"
                    }`}
                  />
                  <span className={tier.featured ? "text-paper" : "text-ink"}>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className={compact ? "mt-6" : "mt-8"}>
            <Link
              href={`/adopt/${tier.id}`}
              className={`flex w-full items-center justify-center rounded-[2px] px-5 py-3 text-[14px] font-medium transition-colors ${
                tier.featured
                  ? "bg-paper text-olive hover:bg-olive-soft"
                  : "bg-olive text-paper hover:bg-olive-mid"
              }`}
            >
              Choose {tier.name}
            </Link>
            <p
              className={`mt-3 text-center font-mono text-[11px] ${
                tier.featured ? "text-olive-soft" : "text-stone"
              }`}
            >
              {tier.remaining} left this season
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
