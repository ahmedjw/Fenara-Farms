"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { formatDate, site } from "@/lib/site";

const orderBy = Date.parse(site.orderByAt);

/**
 * "Order before the end of October for holiday delivery" strip under the
 * header.
 *
 * Renders nothing on the server and until the page has mounted, so a cached
 * page cannot show it after the date has passed.
 */
export function OrderByBanner() {
  const [passed, setPassed] = useState<boolean | null>(null);

  useEffect(() => setPassed(Date.now() >= orderBy), []);

  if (passed !== false) return null;

  return (
    <Link
      href="/adopt"
      className="mx-auto flex w-fit items-center gap-2 rounded-b-[2px] bg-brick px-4 py-1.5 text-center text-[12px] text-white transition-colors hover:bg-brick-dark"
    >
      <span>
        Order before the end of October
        <span className="hidden sm:inline"> for holiday delivery</span>
      </span>
      <ArrowRight size={13} weight="bold" className="shrink-0" aria-hidden />
      <span className="sr-only">
        Order by {formatDate(orderBy)} to have your oil arrive before the
        holidays.
      </span>
    </Link>
  );
}
