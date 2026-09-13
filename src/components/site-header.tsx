"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { site } from "@/lib/site";
import { ButtonLink } from "./ui";

const nav = [
  { href: "/story", label: "Our story" },
  { href: "/grove", label: "The grove" },
  { href: "/oil", label: "The oil" },
  { href: "/faq", label: "FAQ" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  // A bar floating just inside the page edges. On the home page it is fixed,
  // so the hero photo runs up behind it; elsewhere it keeps its own space so
  // it never covers the top of the page.
  const overHero = pathname === "/";

  return (
    <header
      className={`${overHero ? "fixed" : "sticky"} inset-x-0 top-0 z-50 px-3 pt-3 md:px-6 md:pt-5`}
    >
      <div className="mx-auto w-full max-w-[1280px] rounded-[2px] border border-line/70 bg-paper/90 shadow-[0_10px_30px_-14px_rgba(20,24,26,0.35)] backdrop-blur-md">
        <div className="flex h-[64px] items-center justify-between gap-6 px-4 md:px-6">
          <Link href="/" className="shrink-0" aria-label={`${site.name}, home`}>
            <span className="display text-[26px] leading-none tracking-[0.02em] text-olive">
              {site.name}
            </span>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="Main">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-[14px] transition-colors hover:text-ink ${
                  pathname === item.href ? "text-ink" : "text-stone"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/account"
              className="hidden text-[14px] text-stone transition-colors hover:text-ink sm:block"
            >
              Account
            </Link>
            <ButtonLink href="/adopt" className="hidden px-5 py-2.5 sm:inline-flex">
              Adopt a tree
            </ButtonLink>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="p-1.5 text-ink lg:hidden"
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X size={22} weight="light" /> : <List size={22} weight="light" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-line lg:hidden">
            <nav className="px-4 py-4 md:px-6" aria-label="Mobile">
              {[...nav, { href: "/account", label: "Account" }].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block border-b border-line py-3.5 text-[15px] text-ink last:border-0"
                >
                  {item.label}
                </Link>
              ))}
              <ButtonLink href="/adopt" className="mt-4 w-full">
                Adopt a tree
              </ButtonLink>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
