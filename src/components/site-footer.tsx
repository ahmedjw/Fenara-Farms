import Link from "next/link";
import { site } from "@/lib/site";

const columns = [
  {
    heading: "The estate",
    links: [
      { href: "/story", label: "Our story" },
      { href: "/grove", label: "The grove" },
      { href: "/oil", label: "The oil" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Adoption",
    links: [
      { href: "/adopt", label: "Adopt a tree" },
      { href: "/adopt#included", label: "What is included" },
      { href: "/faq", label: "FAQ" },
      { href: "/account", label: "Your grove" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/policies/privacy-policy", label: "Privacy policy" },
      { href: "/policies/terms-of-service", label: "Terms of service" },
      { href: "/policies/shipping", label: "Shipping and returns" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-raised px-5 pb-10 pt-16 md:px-8">
      <div className="mx-auto w-full max-w-[1240px]">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <span className="display block text-[30px] leading-none text-olive">{site.name}</span>
            <p className="mt-4 max-w-[30ch] text-[14px] leading-relaxed text-stone">
              {site.tagline}
            </p>
            <p className="mt-6 text-[14px] text-stone">
              <a href={`mailto:${site.email}`} className="underline underline-offset-4 hover:text-ink">
                {site.email}
              </a>
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.heading}>
              <h3 className="font-sans text-[12px] font-medium uppercase tracking-[0.12em] text-ink">
                {col.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-[14px] text-stone transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="rule mt-14 flex flex-col gap-3 pt-6 text-[13px] text-stone sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} {site.name}. {site.estate}.</p>
          <p>Estate grown, cold extracted, regeneratively farmed.</p>
        </div>
      </div>
    </footer>
  );
}
