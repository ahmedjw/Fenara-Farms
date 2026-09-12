import Link from "next/link";
import { Photo } from "@/components/photo";
import { Section } from "@/components/ui";

export default function NotFound() {
  return (
    <Section>
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
        <div className="max-w-[46ch]">
          <h1 className="display text-[clamp(2.5rem,6vw,4rem)] leading-[1.04] text-olive">
            This part of the grove does not exist.
          </h1>
          <p className="mt-6 text-[17px] leading-relaxed text-stone">
            The page you were looking for is not here. The trees are all still
            where we left them.
          </p>
          <div className="mt-9 flex flex-wrap gap-x-8 gap-y-3 text-[15px]">
            <Link
              href="/"
              className="border-b border-ink pb-1 text-ink transition-colors hover:border-brick hover:text-brick"
            >
              Back to the start
            </Link>
            <Link
              href="/grove"
              className="border-b border-ink pb-1 text-ink transition-colors hover:border-brick hover:text-brick"
            >
              See the grove
            </Link>
          </div>
        </div>

        <Photo
          src="grove-night.jpg"
          alt="Olive trees under the moon at Fenara Farms"
          brief="The grove at night or dusk. Quiet, a little mysterious."
          size="1200 x 1500px, portrait"
          className="aspect-[4/5] w-full"
        />
      </div>
    </Section>
  );
}
