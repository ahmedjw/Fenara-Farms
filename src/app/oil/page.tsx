import type { Metadata } from "next";
import { Photo } from "@/components/photo";
import { ButtonLink, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "The Oil",
  description:
    "Single origin Picual extra virgin olive oil, cold-extracted within hours of harvest and bottled in small batches on our Andalusian estate.",
};

/** Tasting notes and specs. Real claims only, nothing invented for effect. */
const character = [
  {
    title: "On the nose",
    body: "Cut grass and green tomato leaf.",
  },
  {
    title: "On the palate",
    body: "Full and green, with the almond character Picual is known for and a clean bitterness through the middle.",
  },
  {
    title: "The finish",
    body: "A deliberate peppery catch at the back of the throat. That is polyphenol content, and it is the point.",
  },
  {
    title: "How to use it",
    body: "Raw, mostly. Over tomatoes, on bread, finishing a soup or grilled fish. It is robust enough to cook with, but you lose what you paid for.",
  },
];

export default function OilPage() {
  return (
    <>
      <Section bottom={false} className="pb-14">
        <div className="grid items-end gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <h1 className="display text-[clamp(2.5rem,6vw,4.25rem)] leading-[1.04] text-olive">
              One Variety. One Estate. One Harvest.
            </h1>
            <p className="mt-6 max-w-[50ch] text-[17px] leading-relaxed text-stone">
              Picual, grown and pressed in Andalusia. Picked at its peak and
              cold-extracted within hours, because everything good in olive oil
              starts to leave the moment the fruit comes off the tree.
            </p>
          </div>
          <Photo
            src="oil-bottle.jpg"
            alt="A hand holding a branch of green olives at Fenara Farms"
            brief="Hero product shot of the bottle. Clean background, honest light, no heavy retouching."
            size="1200 x 1400px, portrait"
            className="aspect-[6/7] w-full"
          />
        </div>
      </Section>

      <Section className="border-t border-line bg-paper-raised">
        <h2 className="display max-w-[16ch] text-[clamp(1.9rem,4vw,2.75rem)] text-olive">
          What It Tastes Like.
        </h2>
        <div className="mt-10 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2">
          {character.map((c) => (
            <div key={c.title} className="bg-paper-raised p-7 md:p-8">
              <h3 className="display text-[24px] leading-tight text-ink">
                {c.title}
              </h3>
              <p className="mt-3 max-w-[44ch] text-[15px] leading-relaxed text-stone">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="border-t border-line">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
          <Photo
            src="gift-bottles.jpg"
            alt="Olives ripening from green to purple on a branch at Fenara Farms"
            brief="The mill, or oil running from the decanter. Green, fresh, slightly messy. Process rather than product."
            size="1200 x 1500px, portrait"
            className="aspect-[4/5] w-full"
          />
          <div>
            <h2 className="display text-[clamp(1.9rem,4vw,2.75rem)] leading-tight text-olive">
              Harvested Once a Year.
            </h2>
            <div className="prose-body mt-6 space-y-5 text-[16px] leading-relaxed text-stone">
              <p>
                When the olives are ready, the grove is harvested at the peak of
                the season. The fruit is carefully selected and cold-extracted
                shortly after picking to preserve the character, freshness, and
                natural qualities of the olive.
              </p>
              <p>
                The oil is then bottled from that harvest and prepared for its
                journey to you. Nothing is blended in from another region or
                another year, because there is nothing else to blend it with.
              </p>
              <p>
                This is not oil sitting on a shelf waiting for a label. It is
                the harvest of a living grove, cared for throughout the year.
              </p>
            </div>

            <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-line-strong pt-7">
              {[
                ["Variety", "Picual, single origin"],
                ["Grade", "Extra virgin"],
                ["Extraction", "Cold, within hours of picking"],
                ["Farming", "Regenerative, cover cropped"],
                ["Batch", "Small, from one estate"],
                ["Bottle", "500ml dark glass"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
                    {label}
                  </dt>
                  <dd className="mt-1.5 text-[15px] text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      <Section className="border-t border-line bg-olive text-paper">
        <div className="mx-auto max-w-[46ch] text-center">
          <h2 className="display text-[clamp(2rem,4.6vw,3.25rem)] leading-[1.08] text-paper">
            The only way to get it is to adopt a tree.
          </h2>
          <p className="mt-6 text-[16px] leading-relaxed text-olive-soft">
            We do not sell through shops. The grove produces once a year, and
            the harvest goes directly to the people who adopted the trees it
            came from.
          </p>
          <div className="mt-9 flex justify-center">
            <ButtonLink href="/adopt" variant="light">
              Adopt a Tree
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
