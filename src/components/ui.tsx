import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Buttons. All 2px radius per the project radius rule.
 * Contrast is checked: paper on olive, olive on transparent over paper, and
 * olive on paper for buttons sitting in dark olive sections.
 *
 * Use a variant rather than overriding colours through className: Tailwind
 * orders utilities itself, so a className "text-olive" does not reliably beat
 * a variant's "text-paper".
 */

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[2px] px-6 py-3 text-[14px] font-medium tracking-wide transition-all duration-200 active:translate-y-[1px]";

const variants = {
  primary: "bg-olive text-paper hover:bg-olive-mid",
  light: "bg-paper text-olive hover:bg-olive-soft",
  outline: "border border-line-strong text-ink hover:border-ink hover:bg-paper-raised",
  /** For buttons laid over a photo. */
  "outline-light": "border border-paper/70 text-paper hover:border-paper hover:bg-paper/10",
  brick: "bg-brick text-white hover:bg-brick-dark",
} as const;

type Variant = keyof typeof variants;

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
  ...rest
}: { href: string; variant?: Variant; children: ReactNode } & Omit<
  ComponentProps<typeof Link>,
  "href" | "children"
>) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </Link>
  );
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: { variant?: Variant; children: ReactNode } & ComponentProps<"button">) {
  return (
    <button
      className={`${base} ${variants[variant]} disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Section shell. Keeps vertical rhythm consistent across the whole site. */
export function Section({
  children,
  className = "",
  id,
  top = true,
  bottom = true,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Set false to drop the standard padding and supply your own. */
  top?: boolean;
  bottom?: boolean;
}) {
  return (
    <section
      id={id}
      className={`px-5 md:px-8 ${top ? "pt-20 md:pt-28" : ""} ${
        bottom ? "pb-20 md:pb-28" : ""
      } ${className}`}
    >
      <div className="mx-auto w-full max-w-[1240px]">{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mono-label">{children}</p>;
}
