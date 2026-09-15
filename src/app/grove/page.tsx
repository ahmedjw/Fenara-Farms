import type { Metadata } from "next";
import { Photo } from "@/components/photo";
import { LandMap } from "@/components/land-map";
import { ButtonLink, Section } from "@/components/ui";
import { openZoneNames } from "@/lib/land";
import { groveFacts } from "@/lib/site";
import { blocks } from "@/lib/trees";
import { takenTreeIds } from "@/lib/store";

export const metadata: Metadata = {
  title: "The grove",
  description:
    "The Picual olive grove at Fenara Farms in Andalusia, seen from above, with the spots open for adoption this season.",
};

/* The plan is the point of this page, so keep availability close to live. */
export const revalidate = 60;

export default async function GrovePage() {
  const taken = await takenTreeIds();

  return (
    <>
      <Section bottom={false} className="pb-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <h1 className="display text-[clamp(2.5rem,6vw,4.25rem)] leading-[1.04] text-olive">
              The grove, tree by tree.
            </h1>
            <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-stone">
              {groveFacts.treesOnEstate} Picual olive trees across four blocks
              on a single estate in Andalusia. This season,{" "}
              {groveFacts.availableThisSeason} of them are available to adopt in{" "}
              {openZoneNames.join(" and ")}.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-6 self-end border-t border-line-strong pt-6">
            <Stat value={groveFacts.treesOnEstate} label="Trees on the Estate" />
            <Stat
              value={String(groveFacts.availableThisSeason)}
              label="Available this season"
            />
            <Stat
              value={String(openZoneNames.length)}
              label={
                openZoneNames.length === 1
                  ? "Block available now"
                  : "Blocks available now"
              }
              note={openZoneNames.join(", ")}
            />
          </dl>
        </div>
      </Section>

      <Section top={false}>
        <LandMap takenCellIds={taken} />
      </Section>

      <Section className="border-t border-line bg-paper-raised">
        <h2 className="display max-w-[20ch] text-[clamp(1.9rem,4vw,2.75rem)] text-olive">
          Four blocks, four characters.
        </h2>
        <p className="mt-5 max-w-[58ch] text-[16px] leading-relaxed text-stone">
          The estate is not uniform. Aspect, altitude and water change how a
          tree ripens, and you can taste the difference between blocks in the
          same season.
        </p>

        <Photo
          src="grove-blocks.jpg"
          alt="Blocks of olive trees planted across the hillside at Fenara Farms"
          brief="The hillside from a distance, showing how the blocks sit on the land."
          size="1600 x 900px, wide landscape"
          className="mt-12 aspect-[16/9] w-full"
        />

        <div className="mt-5 grid gap-px overflow-hidden border border-line bg-line md:grid-cols-2">
          {blocks.map((block) => (
            <div key={block.id} className="bg-paper-raised p-7 md:p-8">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="display text-[28px] leading-none text-olive">
                  {block.name}
                </h3>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
                  {block.prefix}
                </span>
              </div>
              {block.note && (
                <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-stone">
                  {block.note}
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section className="border-t border-line">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <h2 className="display text-[clamp(1.9rem,4vw,2.75rem)] leading-tight text-olive">
              Come and stand in it.
            </h2>
            <p className="mt-6 max-w-[44ch] text-[16px] leading-relaxed text-stone">
              Adopters are welcome at the estate by arrangement, and harvest is
              the best time to come. There is no charge to walk the grove and
              find your tree. Write to us and we will find a date.
            </p>
            <ButtonLink href="/contact" variant="outline" className="mt-8">
              Arrange a visit
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
