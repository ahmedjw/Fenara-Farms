import type { Metadata } from "next";
import { TierCards } from "@/components/tier-cards";
import { FaqAccordion } from "@/components/faq-accordion";
import { Section } from "@/components/ui";
import { faq } from "@/lib/faq";

export const metadata: Metadata = {
  title: "Adopt an olive tree",
  description:
    "Choose your adoption tier, pick your Picual olive tree from the grove plan, and receive the oil it produces this season.",
};

export default function AdoptPage() {
  return (
    <>
      <Section bottom={false} className="pb-10">
        <h1 className="display max-w-[18ch] text-[clamp(2.5rem,6vw,4.25rem)] text-olive">
          Choose how much of the grove is yours.
        </h1>
        <p className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-stone">
          Pick a tier, then choose your actual trees from the estate plan and
          name them. Every adoption covers one harvest season.
        </p>
      </Section>

      <Section top={false}>
        <TierCards />
      </Section>

      <Section className="border-t border-line" id="included">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
          <div>
            <h2 className="display text-[clamp(1.9rem,4vw,2.75rem)] leading-tight text-olive">
              Your adoption is annual.
            </h2>
            <p className="mt-6 max-w-[42ch] text-[16px] leading-relaxed text-stone">
              The grove produces once a year, so each adoption covers one year
              and its harvest. It renews automatically: Stripe charges your card
              for the next year on your renewal date, and your tree stays
              registered in your name. You can cancel any time before renewal
              from your grove page, and we let you know before each one. Your
              tree remains part of the Fenara Farms grove either way, continuing
              to grow and be cared for as we restore the land.
            </p>
          </div>

          <div>
            <h2 className="display text-[clamp(1.9rem,4vw,2.75rem)] leading-tight text-olive">
              What every adoption includes.
            </h2>
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {[
                [
                  "Your own olive tree",
                  "On our estate in Andalusia, identified by the name you give it and its adoption number.",
                ],
                [
                  "The season, as it happens",
                  "Updates from the farm as the olives develop and harvest approaches.",
                ],
                [
                  "Harvest news from the grove",
                  "When the olives are ready, and when the annual harvest begins.",
                ],
                [
                  "Fenara Farms extra virgin olive oil",
                  "From that season's harvest, delivered after the oil is extracted and bottled.",
                ],
                [
                  "A connection to the land",
                  "And the story of the grove you are helping preserve and restore.",
                ],
              ].map(([title, body]) => (
                <li key={title} className="py-5">
                  <h3 className="display text-[20px] leading-snug text-ink">
                    {title}
                  </h3>
                  <p className="mt-1.5 max-w-[52ch] text-[15px] leading-relaxed text-stone">
                    {body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section className="border-t border-line bg-paper-raised">
        <h2 className="display max-w-[16ch] text-[clamp(1.9rem,4vw,2.75rem)] text-olive">
          Before you adopt.
        </h2>
        <div className="mt-8">
          <FaqAccordion items={faq.slice(0, 6)} />
        </div>
      </Section>
    </>
  );
}
