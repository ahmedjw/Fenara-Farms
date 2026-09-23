import type { Metadata } from "next";
import { Medal } from "@phosphor-icons/react/dist/ssr";
import { Photo } from "@/components/photo";
import { ButtonLink, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "Three thousand years after the Phoenicians planted the first olive trees in Southern Spain, we are restoring a tired grove in Andalusia.",
};

export default function StoryPage() {
  return (
    <>
      <Section bottom={false} className="pb-12">
        <h1 className="display max-w-[19ch] text-[clamp(2.5rem,6.5vw,4.5rem)] leading-[1.03] text-olive">
          We didn’t just want to farm the land. We wanted to heal it.
        </h1>
        <p className="mt-7 max-w-[50ch] text-[17px] leading-relaxed text-stone">
          Because this isn’t just a farm. It’s land worth restoring. Trees
          worth protecting. And a legacy worth passing on.
        </p>
      </Section>

      <div className="px-5 md:px-8">
        <div className="mx-auto w-full max-w-[1240px]">
          <Photo
            src="story-hero.jpg"
            alt="Fenara Farms in Andalusia at the end of the day"
            brief="Landscape of the whole estate. Wide, calm, showing the land rather than the product."
            size="2000 x 1000px, wide landscape"
            className="aspect-[2/1] w-full"
          />
        </div>
      </div>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr] lg:gap-20">
          <div className="order-last lg:order-none">
            <Photo
              src="story-farm.jpg"
              alt="On the hillside above the groves of Fenara Farms, the olive rows running down the valley behind"
              brief="Someone from the family on the estate. Unposed, with the land behind them."
              size="1200 x 1500px, portrait"
              className="aspect-[4/5] w-full lg:sticky lg:top-28"
            />
          </div>
          <div className="prose-body space-y-6 text-[17px] leading-relaxed text-stone">
            <p className="display text-[clamp(1.5rem,2.6vw,2rem)] leading-[1.35] text-ink">
              Long before any of us were here, the Phoenicians crossed the
              Mediterranean. With them came more than goods. They brought
              knowledge, culture, and the olive tree, planting roots in the
              soil of Southern Spain that would endure for thousands of years.
            </p>

            <p>
              Olive oil has always been deeply rooted in our own culture as
              well. It has been part of our tables, our traditions, and our way
              of bringing people together for generations. So, when we found
              our farm in Andalusia, we felt an immediate connection to
              something much older than ourselves.
            </p>

            <p className="display pt-2 text-[26px] leading-snug text-ink">
              But the land needed help.
            </p>

            <p>
              Years of farming for maximum production had taken their toll. The
              soil was tired. The grove was withered. Much of the life that once
              existed between the trees had disappeared.
            </p>

            <p>
              Year after year, we began rebuilding the soil using regenerative
              practices. We introduced cover crops to return nutrients to the
              earth. We encouraged pollinators and brought back the biodiversity
              that had been lost. We learned to work with the land rather than
              simply taking from it.
            </p>

            <p className="display pt-2 text-[26px] leading-snug text-ink">
              It has taken patience. Nature does not work on our schedule.
            </p>

            <p>
              But slowly, the farm began to change. The soil became alive again.
              The grove became healthier. And with that came something we had
              not set out to manufacture: a truly exceptional olive oil.
            </p>

            <p>
              Today, our Picual olive oil is estate-grown and produced from the
              very land we have worked so hard to restore. It is an oil we are
              genuinely proud to share.
            </p>
          </div>
        </div>
      </Section>

      {/* The award. Given its own moment rather than a badge in a row. */}
      <Section className="border-y border-line bg-olive text-paper">
        <div className="mx-auto flex max-w-[62ch] flex-col items-center text-center">
          <Medal size={34} weight="light" className="text-olive-soft" />
          <p className="display mt-6 text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.25] text-paper">
            In 2025, Fenara Farms was honoured with a Silver Medal at the
            Córdoba Mezquita Olive Oil Competition.
          </p>
          <p className="mt-5 text-[16px] leading-relaxed text-olive-soft">
            A recognition that meant even more because of the journey behind it.
          </p>
        </div>
      </Section>

      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <Photo
            src="story-tree.jpg"
            alt="An old olive tree with a forked trunk at Fenara Farms, lit by the setting sun"
            brief="Portrait of one old, characterful tree. Trunk detail. This is the emotional anchor of the page."
            size="1200 x 1500px, portrait"
            className="aspect-[4/5] w-full"
          />
          <div>
            <h2 className="display text-[clamp(1.9rem,4vw,2.75rem)] leading-tight text-olive">
              Fenara Farms is about more than Olive Oil.
            </h2>
            <div className="prose-body mt-6 space-y-5 text-[16px] leading-relaxed text-stone">
              <p>
                It is about heritage and renewal. It is about respecting what
                was entrusted to us and leaving it better than we found it.
              </p>
              <p>
                Three thousand years after the first olive trees took root in
                Southern Spain, we are still here, tending the land, honouring
                its history, and carrying it forward.
              </p>
              <p className="display text-[22px] leading-snug text-ink">
                From Our Grove to Your Table.
              </p>
            </div>
            <ButtonLink href="/adopt" className="mt-9">
              Adopt a Tree
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
