import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "@/components/faq-accordion";
import { Section } from "@/components/ui";
import { faq } from "@/lib/faq";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description:
    "How olive tree adoption works at Fenara Farms: what you receive, when the harvest ships, renewals, visits, gifting and shipping.",
};

export default function FaqPage() {
  return (
    <>
      <Section bottom={false} className="pb-8">
        <h1 className="display max-w-[16ch] text-[clamp(2.5rem,6vw,4.25rem)] leading-[1.04] text-olive">
          Questions people ask.
        </h1>
        <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-stone">
          If yours is not here, write to us. A person reads every message.
        </p>
      </Section>

      <Section top={false}>
        <div className="max-w-[880px]">
          <FaqAccordion items={faq} />
        </div>
      </Section>

      <Section className="border-t border-line bg-paper-raised">
        <div className="max-w-[52ch]">
          <h2 className="display text-[clamp(1.75rem,3.6vw,2.5rem)] leading-tight text-olive">
            Still deciding?
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-stone">
            Ask us anything about the grove, the oil or how adoption works. We
            would rather answer a question than have you guess.
          </p>
          <p className="mt-6 text-[16px]">
            <Link
              href="/contact"
              className="border-b border-ink pb-1 text-ink transition-colors hover:border-brick hover:text-brick"
            >
              Contact us
            </Link>
            <span className="mx-3 text-stone-light">or</span>
            <a
              href={`mailto:${site.email}`}
              className="border-b border-ink pb-1 text-ink transition-colors hover:border-brick hover:text-brick"
            >
              {site.email}
            </a>
          </p>
        </div>
      </Section>
    </>
  );
}
