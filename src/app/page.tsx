import Link from "next/link";
import {
  ArrowRight,
  Drop,
  Leaf,
  MapTrifold,
  Medal,
  Package,
} from "@phosphor-icons/react/dist/ssr";
import { EvooSeal } from "@/components/evoo-seal";
import { Photo } from "@/components/photo";
import { Reveal } from "@/components/reveal";
import { FarmMap } from "@/components/farm-map";
import { TierCards } from "@/components/tier-cards";
import { FaqAccordion } from "@/components/faq-accordion";
import { ButtonLink, Eyebrow, Section } from "@/components/ui";
import { faq } from "@/lib/faq";
import { adoptableTrees, openPlotNames } from "@/lib/farm";
import { groveFacts } from "@/lib/site";
import { takenTreeIdsForDisplay } from "@/lib/store";

/* Availability on the embedded map refreshes every 5 minutes. */
export const revalidate = 300;

export default async function HomePage() {
  const taken = await takenTreeIdsForDisplay();

  return (
    <>
      {/* Hero. The photo fills the whole first screen and runs up behind the
          floating header; the message sits low on the left, the seal on the right. */}
      <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden">
        <Photo
          src="hero-grove.jpg"
          alt="The sun setting over rows of Picual olive trees at Fenara Farms in Andalusia"
          brief="Wide shot of the grove, low sun, rows receding. The single most important photo on the site."
          size="2400 x 1600px, landscape"
          priority
          className="absolute inset-0 -z-10 h-full w-full object-[50%_60%]"
        />
        {/* Darkens the lower part of the photo so the type stays readable over bright grass. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/75 via-ink/25 to-ink/5"
        />

        <div className="relative mx-auto w-full max-w-[1280px] px-5 pb-12 pt-40 md:px-10 md:pb-20">
          <div className="pr-0 md:pr-44">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper/90 sm:text-[11px] sm:tracking-[0.28em] md:text-[12px]">
              Setenil de las Bodegas
              <span aria-hidden className="mx-2.5">
                •
              </span>
              Andalusia
              <span aria-hidden className="mx-2.5">
                •
              </span>
              Spain
            </p>
            <h1 className="display mt-6 text-[clamp(2.75rem,6.5vw,5.25rem)] leading-[1.02] text-paper">
              Adopt an Olive Tree
              <span className="display-italic block">in Andalusia</span>
            </h1>
            <a
              href="#explore"
              className="mt-8 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-paper/90 transition-colors hover:text-paper"
            >
              Scroll to explore
              <span aria-hidden className="h-px w-8 bg-current" />
            </a>
          </div>

          {/* Pinned to the corner rather than sharing a row, so the headline keeps the full width on a phone. */}
          <EvooSeal className="absolute bottom-10 right-5 h-24 w-24 drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)] md:bottom-16 md:right-10 md:h-36 md:w-36" />
        </div>
      </section>

      {/* Credentials. Sits under the hero, never inside it. */}
      <div
        id="explore"
        className="scroll-mt-24 border-y border-line bg-paper-raised px-5 py-6 md:px-8"
      >
        <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-x-10 gap-y-4">
          <span className="flex items-center gap-2.5 text-[14px] text-ink">
            <Medal size={19} weight="light" className="text-brick" />
            Silver Medal, Córdoba Mezquita Olive Oil Competition 2025
          </span>
          <span className="text-[14px] text-stone">Single origin Picual</span>
          <span className="text-[14px] text-stone">Cold-extracted</span>
          <span className="text-[14px] text-stone">Regeneratively farmed</span>
        </div>
      </div>

      {/* The story. Editorial two column with a pulled opening line. */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
          <div className="lg:pt-10">
            <Photo
              src="story-soil.jpg"
              alt="An olive tree at Fenara Farms with the low sun shining through its branches"
              brief="Ground level shot of cover crop and wildflowers growing between the tree rows. This is the proof of the restoration story."
              size="1200 x 1500px, portrait"
              className="aspect-[4/5] w-full"
            />
          </div>

          <div>
            <h2 className="display text-[clamp(2rem,4.4vw,3.25rem)] text-olive">
              Long before any of us were here, the Phoenicians crossed the
              Mediterranean.
            </h2>

            <div className="prose-body mt-8 space-y-5 text-[16px] leading-relaxed text-stone">
              <p>
                They brought more than goods. They brought knowledge, culture
                and the olive tree, planting roots in the soil of Southern Spain
                that would endure for thousands of years.
              </p>
              <p>
                Olive oil has always been deeply rooted in our own culture too.
                It has been part of our tables, our traditions and our way of
                bringing people together for generations. So when we found our
                farm in Andalusia, we felt an immediate connection to something
                much older than ourselves.
              </p>
              <p className="display text-[22px] not-italic leading-snug text-ink">
                But the land needed help.
              </p>
              <p>
                Years of farming for maximum production had taken their toll.
                The soil was tired. The grove was withered. Much of the life
                that once existed between the trees had disappeared. We decided
                not simply to farm the land, but to restore it.
              </p>
            </div>

            <Link
              href="/story"
              className="mt-8 inline-flex items-center gap-2 border-b border-ink pb-1 text-[14px] text-ink transition-colors hover:border-brick hover:text-brick"
            >
              Read the whole story
              <ArrowRight size={15} weight="light" />
            </Link>
          </div>
        </div>
      </Section>

      {/* How it works. Numbered sequence, not three matching cards. */}
      <Section className="border-t border-line">
        <Eyebrow>How adoption works</Eyebrow>
        <h2 className="display mt-4 max-w-[16ch] text-[clamp(2rem,4.4vw,3.25rem)] text-olive">
          Adopt a tree. Follow its journey. Taste its harvest.
        </h2>

        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {[
            {
              icon: MapTrifold,
              title: "Choose your tree",
              body: "Open the grove plan and pick the tree you want. Give it a name and we mark it as yours for the season, on the map and on the trunk.",
            },
            {
              icon: Leaf,
              title: "Watch the season unfold",
              body: "From flowering through fruit set to harvest readiness, we send updates from the estate: grove and soil conditions, tree health, how the fruit is coming on.",
            },
            {
              icon: Drop,
              title: "Taste the harvest",
              body: "The olives are picked at their peak and cold-extracted within hours. Your oil is bottled from that harvest and sent to you.",
            },
          ].map((step, i) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.title} delay={i * 0.09}>
                <li className="border-t border-line-strong pt-6">
                  <div className="flex items-center justify-between">
                    <Icon size={26} weight="light" className="text-olive-mid" />
                    <span className="display text-[38px] leading-none text-olive-soft">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="display mt-6 text-[26px] leading-tight text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-stone">
                    {step.body}
                  </p>
                </li>
              </Reveal>
            );
          })}
        </ol>
      </Section>

      {/* The grove plan. Full width, the signature interaction. */}
      <Section className="border-t border-line bg-paper-raised" id="grove">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h2 className="display max-w-[18ch] text-[clamp(2rem,4.4vw,3.25rem)] text-olive">
            The estate, drawn to plan.
          </h2>
          <p className="max-w-[38ch] text-[15px] leading-relaxed text-stone">
            {groveFacts.treesOnEstate} Picual trees across four blocks. Only{" "}
            {openPlotNames} is open this season, and{" "}
            {adoptableTrees.length} of its trees can be adopted. The other
            three blocks follow in later seasons.
          </p>
        </div>

        <div className="mt-10">
          <FarmMap takenSpotIds={taken} />
        </div>
      </Section>

      {/* What is included. Bento with real visual variation between cells. */}
      <Section className="border-t border-line" id="included">
        <h2 className="display max-w-[20ch] text-[clamp(2rem,4.4vw,3.25rem)] text-olive">
          You do not just receive olive oil. You get to see where it came from.
        </h2>

        {/* A fixed top row: equal rows would copy the tall harvest photo's
            height onto the cards below and stretch the bottle card with them. */}
        <div className="mt-12 grid gap-5 md:grid-cols-3 md:grid-rows-[360px_auto]">
          {/* The bottle fills the card; the text sits on a dark fade at the foot of it. */}
          <div className="relative isolate flex min-h-[520px] flex-col justify-end overflow-hidden bg-olive p-7 text-paper md:row-span-2 md:min-h-0">
            <Photo
              src="bottle.jpg"
              alt="A bottle of Fenara La Reserva Privada, early-harvest Picual extra virgin olive oil"
              brief="The bottle on its own, label facing the camera, soft background."
              size="1200 x 1600px, portrait"
              className="absolute inset-0 -z-10 h-full w-full object-[50%_35%]"
            />
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/85 via-ink/30 to-ink/0"
            />
            <h3 className="display text-[28px] leading-tight text-paper">
              Your own tree, by name and number
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-paper/85">
              Registered to you on the estate, marked on the grove plan, and
              named whatever you decide to call it.
            </p>
          </div>

          <Photo
            src="harvest-hands.jpg"
            alt="Freshly picked olives on harvest nets beneath the trees at Fenara Farms"
            brief="Close crop of hands and olives at harvest. Warm, tactile, human."
            size="1200 x 900px, landscape"
            className="aspect-[4/3] w-full md:col-span-2 md:aspect-auto md:h-full"
          />

          <div className="border border-line bg-paper-raised p-7">
            <Package size={26} weight="light" className="text-olive-mid" />
            <h3 className="display mt-14 text-[24px] leading-tight text-ink">
              Oil from your own harvest
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-stone">
              Extra virgin, cold-extracted, bottled from the season your tree
              produced it.
            </p>
          </div>

          <div className="border border-line bg-paper-raised p-7">
            <MapTrifold size={26} weight="light" className="text-olive-mid" />
            <h3 className="display mt-14 text-[24px] leading-tight text-ink">
              Updates through the season
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-stone">
              Grove and soil conditions, fruit development, tree health, and the
              run up to harvest.
            </p>
          </div>
        </div>
      </Section>

      {/* Manifesto. Centered on purpose: the message is the design here. */}
      <Section className="border-t border-line bg-olive text-paper">
        <div className="mx-auto max-w-[52ch] text-center">
          <h2 className="display text-[clamp(2.25rem,5.5vw,4rem)] leading-[1.05] text-paper">
            Harvested, not manufactured.
          </h2>
          <p className="mt-7 text-[17px] leading-relaxed text-olive-soft">
            This is not oil sitting on a shelf waiting for a label. It is the
            harvest of a living grove, grown on our estate in Andalusia and
            cared for throughout the year.
          </p>
        </div>

        <div className="mx-auto mt-14 flex max-w-[900px] flex-wrap justify-center gap-3">
          {[
            "Single origin estate harvest",
            "Extra virgin",
            "Cold-extracted",
            "Regeneratively farmed",
            "Small batch production",
          ].map((spec) => (
            <span
              key={spec}
              className="rounded-[2px] border border-olive-mid px-4 py-2 text-[13px] text-olive-soft"
            >
              {spec}
            </span>
          ))}
        </div>
      </Section>

      {/* Pricing. */}
      <Section className="border-t border-line" id="pricing">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h2 className="display max-w-[16ch] text-[clamp(2rem,4.4vw,3.25rem)] text-olive">
            Choose how much of the grove is yours.
          </h2>
          <p className="max-w-[36ch] text-[15px] leading-relaxed text-stone">
            Each adoption covers a year and its harvest, and renews yearly
            until you cancel. The grove is picked once a year, so adoptions open
            only in the run up to harvest.
          </p>
        </div>

        <div className="mt-12">
          <TierCards />
        </div>
      </Section>

      {/* Gifting. */}
      <Section className="border-t border-line bg-paper-raised">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <Photo
            src="gift-bottles.jpg"
            alt="Olives ripening from green to purple on a branch at Fenara Farms"
            brief="Bottles in their shipping packaging, styled but not glossy. Used for the gifting section."
            size="1200 x 1000px, landscape"
            className="aspect-[6/5] w-full"
          />
          <div>
            <h2 className="display text-[clamp(2rem,4.4vw,3.25rem)] text-olive">
              A gift that grows.
            </h2>
            <p className="mt-6 max-w-[44ch] text-[16px] leading-relaxed text-stone">
              Adopt a tree for yourself, for your family, or give someone a
              connection to a piece of Andalusia they can experience from home.
              Gift adoptions arrive with a named certificate and your message.
              Nothing arrives with a price on it.
            </p>
            <ButtonLink href="/adopt" variant="outline" className="mt-8">
              Adopt a Tree
            </ButtonLink>
          </div>
        </div>
      </Section>

      {/* FAQ preview. */}
      <Section className="border-t border-line">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.4fr] lg:gap-16">
          <h2 className="display text-[clamp(2rem,4.4vw,3.25rem)] leading-tight text-olive">
            Questions People Ask.
          </h2>
          <div>
            <FaqAccordion items={faq.slice(0, 5)} />
            <Link
              href="/faq"
              className="mt-8 inline-flex items-center gap-2 border-b border-ink pb-1 text-[14px] text-ink transition-colors hover:border-brick hover:text-brick"
            >
              All questions
              <ArrowRight size={15} weight="light" />
            </Link>
          </div>
        </div>
      </Section>

      {/* Closing. */}
      <Section className="border-t border-line bg-olive text-paper">
        <div className="mx-auto max-w-[44ch] text-center">
          <h2 className="display text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.06] text-paper">
            From Our Grove to Your Table.
          </h2>
          <p className="mt-6 text-[16px] leading-relaxed text-olive-soft">
            Three thousand years after the first olive trees took root in
            Southern Spain, we are still here, tending the land and carrying it
            forward.
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
