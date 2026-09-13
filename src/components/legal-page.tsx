import { Section } from "./ui";

export type LegalSection = { heading: string; body: string[] };

/**
 * Shared shell for the policy pages. These are working drafts written to be
 * accurate to how the site actually behaves. Have a lawyer in your jurisdiction
 * review them before you take live payments.
 */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string | string[];
  sections: LegalSection[];
}) {
  return (
    <Section>
      <div className="max-w-[70ch]">
        <h1 className="display text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.06] text-olive">
          {title}
        </h1>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
          Last updated {updated}
        </p>
        <div className="mt-8 space-y-4">
          {(Array.isArray(intro) ? intro : [intro]).map((p, i) => (
            <p key={i} className="text-[17px] leading-relaxed text-stone">
              {p}
            </p>
          ))}
        </div>

        <div className="mt-14 space-y-12">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="display text-[26px] leading-tight text-ink">
                {section.heading}
              </h2>
              <div className="mt-4 space-y-4">
                {section.body.map((p, i) => (
                  <p key={i} className="text-[16px] leading-relaxed text-stone">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-16 border-t border-line pt-6 text-[14px] leading-relaxed text-stone">
          This policy is a working draft prepared for the Fenara Farms site. Have it
          reviewed by a lawyer in your jurisdiction before trading.
        </p>
      </div>
    </Section>
  );
}
