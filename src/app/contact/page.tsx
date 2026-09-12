import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { Section } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Questions about adopting an olive tree, an existing adoption, or visiting Fenara Farms in Andalusia.",
};

export default function ContactPage() {
  return (
    <Section>
      <div className="grid gap-14 lg:grid-cols-[1fr_1fr] lg:gap-20">
        <div>
          <h1 className="display max-w-[14ch] text-[clamp(2.5rem,6vw,4rem)] leading-[1.04] text-olive">
            Talk to us.
          </h1>
          <p className="mt-6 max-w-[44ch] text-[17px] leading-relaxed text-stone">
            About adopting, about an adoption you already have, or about coming
            to see the grove. A person reads every message.
          </p>

          <dl className="mt-12 space-y-7 border-t border-line-strong pt-8">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
                Email
              </dt>
              <dd className="mt-1.5 text-[16px]">
                <a
                  href={`mailto:${site.email}`}
                  className="border-b border-ink pb-0.5 text-ink transition-colors hover:border-brick hover:text-brick"
                >
                  {site.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
                The estate
              </dt>
              <dd className="mt-1.5 text-[16px] text-ink">{site.estate}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
                Visiting
              </dt>
              <dd className="mt-1.5 max-w-[38ch] text-[15px] leading-relaxed text-stone">
                By arrangement, and free for adopters. Harvest is the best time
                to come. Tell us roughly when you are in Andalusia and we will
                find a date.
              </dd>
            </div>
          </dl>
        </div>

        <ContactForm />
      </div>
    </Section>
  );
}
