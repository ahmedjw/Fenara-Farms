import type { Metadata } from "next";
import { Photo } from "@/components/photo";
import { FarmMap } from "@/components/farm-map";
import { ButtonLink, Section } from "@/components/ui";
import { adoptableTrees, openPlotNames, plots } from "@/lib/farm";
import { groveFacts } from "@/lib/site";
import { treeHoldsForDisplay } from "@/lib/store";

export const metadata: Metadata = {
  title: "The Grove",
  description:
    "The Picual olive grove at Fenara Farms in Andalusia, seen from above, with the spots open for adoption this season.",
};

/* The plan is the point of this page, so keep availability close to live. */
export const revalidate = 60;

export default async function GrovePage() {
  const holds = await treeHoldsForDisplay();

  return (
    <>
      <Section bottom={false} className="pb-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <h1 className="display text-[clamp(2.5rem,6vw,4.25rem)] leading-[1.04] text-olive">
              The Grove, Tree by Tree.
            </h1>
            <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-stone">
              {groveFacts.treesOnEstate} Picual olive trees across four blocks
              on a single estate in Andalusia. One block opens at a time. This
              season it is {openPlotNames}, where {adoptableTrees.length} trees
              are open to adopt.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-6 self-end border-t border-line-strong pt-6">
            <Stat value={groveFacts.treesOnEstate} label="Trees on the Estate" />
            <Stat
              value={String(adoptableTrees.length)}
              label="Open to adopt this season"
            />
            <Stat
              value={openPlotNames}
              label="The one block open now"
              note="The other three open later"
            />
          </dl>
        </div>
      </Section>

      <Section top={false}>
        <FarmMap
          adoptedSpotIds={holds.adopted}
          reservedSpotIds={holds.reserved}
        />
      </Section>

      <Section className="border-t border-line bg-paper-raised">
        <h2 className="display max-w-[20ch] text-[clamp(1.9rem,4vw,2.75rem)] text-olive">
          Four Blocks, Four Characters.
        </h2>
        <p className="mt-5 max-w-[58ch] text-[16px] leading-relaxed text-stone">
          The estate is not uniform. Aspect, altitude, and water all influence
          how the trees ripen, and you can taste the difference between blocks
          in the same season.
        </p>

        <Photo
          src="grove-blocks.jpg"
          alt="Blocks of olive trees planted across the hillside at Fenara Farms"
          brief="The hillside from a distance, showing how the blocks sit on the land."
          size="1600 x 900px, wide landscape"
          className="mt-12 aspect-[16/9] w-full"
        />

        <div className="mt-5 grid gap-px overflow-hidden border border-line bg-line md:grid-cols-2">
          {plots.map((plot) => (
            <div key={plot.id} className="bg-paper-raised p-7 md:p-8">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="display text-[28px] leading-none text-olive">
                  {plot.name}
                </h3>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
                  {plot.code}
                </span>
              </div>
              <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-stone">
                {plot.description}
              </p>
              <span
                className={`mt-5 inline-block rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
                  plot.open
                    ? "bg-olive text-paper"
                    : "border border-line-strong text-stone"
                }`}
              >
                {plot.open ? "Open to adopt now" : "Opens in a later season"}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section className="border-t border-line">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <h2 className="display text-[clamp(1.9rem,4vw,2.75rem)] leading-tight text-olive">
              Come Stand in the Grove.
            </h2>
            <p className="mt-6 max-w-[44ch] text-[16px] leading-relaxed text-stone">
              Adopters are welcome at the estate by arrangement, and harvest is
              the best time to come. There is no charge to walk the grove and
              find your tree. Write to us and we will find a date.
            </p>
            <ButtonLink href="/contact" variant="outline" className="mt-8">
              Arrange a Visit
            </ButtonLink>
          </div>
          <Photo
            src="grove-path.jpg"
            alt="Harvest nets laid down a row of olive trees at Fenara Farms during picking"
            brief="Eye level shot looking down a row or track through the grove, so the viewer can imagine walking it."
            size="1400 x 1050px, landscape"
            className="aspect-[4/3] w-full"
          />
        </div>
      </Section>
    </>
  );
}

function Stat({
  value,
  label,
  note,
}: {
  value: string;
  label: string;
  note?: string;
}) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="display block text-[38px] leading-none text-ink">
          {value}
        </span>
        <span className="mt-2 block text-[13px] leading-snug text-stone">
          {label}
        </span>
        {note && (
          <span className="mt-0.5 block text-[13px] leading-snug text-ink">
            {note}
          </span>
        )}
      </dd>
    </div>
  );
}
