/**
 * What the admin dashboard knows, worked out from the adoption store.
 *
 * Kept apart from the page and free of database calls, so the arithmetic can
 * be tested on plain data and the page only has to lay it out.
 *
 * Money is reckoned, not read. The store keeps which tier an adoption is on
 * and which renewal invoices have been paid, not the amounts Stripe charged,
 * so each payment is counted at the tier's price plus shipping as they stand
 * in site.ts today. That is right for as long as prices have not changed. It
 * knows nothing of Stripe's fees, refunds, discounts or tax: Stripe is the
 * ledger, and every paid adoption links to its customer there.
 */

import { adoptableTrees, spotUnavailable, trees } from "./farm";
import { describePlot } from "./plots";
import { getTier, tierTotal, tiers, type Tier } from "./site";
import type { Adoption } from "./store";

export type Hold = { treeId: string; adoptionNumber: string; paid: boolean };

/** Something about an adoption a person should look at. */
export type Flag = {
  tone: "alert" | "notice";
  text: string;
};

export type AdoptionRow = Adoption & {
  tier?: Tier;
  /** The adoption's trees as the customer sees them, e.g. "LN-012". */
  treeLabels: { id: string; label: string; name?: string; unavailable: boolean }[];
  /** How many times the card has been charged: the purchase, then each renewal. */
  payments: number;
  /** Reckoned total charged so far, in cents. */
  collected: number;
  /** What the next renewal will charge, in cents, or 0 if it will not renew. */
  nextCharge: number;
  /** The customer in the Stripe dashboard, when there is one. */
  stripeUrl?: string;
  flags: Flag[];
};

export type TreeRow = {
  id: string;
  spotId: string;
  row: number;
  pos: number;
  status: "available" | "reserved" | "adopted" | "unavailable";
  adoptionNumber?: string;
  customerName?: string;
  /** What the adopter named it. */
  name?: string;
};

export type Report = {
  generatedAt: string;
  adoptions: AdoptionRow[];
  trees: TreeRow[];
  totals: {
    active: number;
    pending: number;
    cancelled: number;
    /** Distinct email addresses with a paid adoption. */
    customers: number;
    collected: number;
    /** Collected from first-year purchases. */
    firstYear: number;
    /** Collected from renewals. */
    renewals: number;
    /** What active adoptions that will renew bring in a year. */
    yearly: number;
    /** The part of `yearly` that is shipping. */
    yearlyShipping: number;
    /** Active adoptions whose customer has cancelled; they end at renewal. */
    ending: number;
    gifts: number;
  };
  treeTotals: Record<TreeRow["status"], number> & { offered: number };
  byTier: {
    tier: Tier;
    active: number;
    trees: number;
    collected: number;
    yearly: number;
  }[];
  byMonth: { month: string; adoptions: number; collected: number }[];
  /** Active adoptions renewing within the next 60 days, soonest first. */
  renewingSoon: AdoptionRow[];
  /** Active adoptions with at least one alert. */
  attention: AdoptionRow[];
};

const DAY = 24 * 60 * 60 * 1000;

/** Whether an adoption was ever paid for. A checkout that lapsed never was. */
export function wasPaid(a: Adoption): boolean {
  return a.status === "active" || Boolean(a.stripeSubscriptionId);
}

function stripeCustomerUrl(customerId: string): string {
  // Test-mode customers live under /test in the dashboard.
  const test = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_");
  return `https://dashboard.stripe.com/${test ? "test/" : ""}customers/${customerId}`;
}

function rowFor(a: Adoption, now: number): AdoptionRow {
  const tier = getTier(a.tierId);
  const price = tier ? tierTotal(tier) : 0;
  const payments = wasPaid(a) ? 1 + (a.renewalInvoices?.length ?? 0) : 0;
  const treeLabels = a.trees.map((id) => ({
    id,
    label: describePlot(id).label,
    name: a.names[id] && a.names[id] !== id ? a.names[id] : undefined,
    unavailable: spotUnavailable(id),
  }));

  const flags: Flag[] = [];
  if (a.status === "active") {
    if (!a.delivery?.line1) {
      flags.push({ tone: "alert", text: "No delivery address" });
    }
    if (!a.confirmationSentAt) {
      flags.push({ tone: "alert", text: "Confirmation email not sent" });
    }
    const gone = treeLabels.filter((t) => t.unavailable).map((t) => t.label);
    if (gone.length) {
      flags.push({
        tone: "alert",
        text: `${gone.join(", ")} no longer available`,
      });
    }
    if (!tier) {
      flags.push({ tone: "alert", text: `Unknown tier "${a.tierId}"` });
    }
    if (a.cancelAtPeriodEnd) {
      flags.push({ tone: "notice", text: "Cancelled, ends at renewal" });
    } else if (a.renewsAt) {
      const days = Math.ceil((Date.parse(a.renewsAt) - now) / DAY);
      if (days >= 0 && days <= 30) {
        flags.push({
          tone: "notice",
          text: days === 0 ? "Renews today" : `Renews in ${days} days`,
        });
      }
    }
  }

  return {
    ...a,
    tier,
    treeLabels,
    payments,
    collected: payments * price,
    nextCharge: a.status === "active" && !a.cancelAtPeriodEnd ? price : 0,
    stripeUrl: a.stripeCustomerId ? stripeCustomerUrl(a.stripeCustomerId) : undefined,
    flags,
  };
}

function monthOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Europe/Madrid",
  })
    .format(new Date(iso))
    .slice(0, 7);
}

export function buildReport(
  adoptions: Adoption[],
  holds: Hold[],
  now: number = Date.now(),
): Report {
  const rows = adoptions.map((a) => rowFor(a, now));
  const byNumber = new Map(rows.map((r) => [r.number, r]));
  const holdBySpot = new Map(holds.map((h) => [h.treeId, h]));

  const treeRows: TreeRow[] = trees
    .filter((t) => t.spotId)
    .map((t) => {
      const spotId = t.spotId!;
      const hold = holdBySpot.get(spotId);
      const owner = hold ? byNumber.get(hold.adoptionNumber) : undefined;
      return {
        id: t.id,
        spotId,
        row: t.row,
        pos: t.pos,
        // A tree that is gone says so even if someone still holds it: that is
        // the case the attention list exists to catch.
        status: t.unavailable
          ? "unavailable"
          : hold
            ? hold.paid
              ? "adopted"
              : "reserved"
            : "available",
        adoptionNumber: hold?.adoptionNumber,
        customerName: owner?.customerName,
        name: owner?.names[spotId] !== spotId ? owner?.names[spotId] : undefined,
      };
    });

  const treeTotals = {
    available: 0,
    reserved: 0,
    adopted: 0,
    unavailable: 0,
    offered: adoptableTrees.length,
  };
  for (const t of treeRows) treeTotals[t.status] += 1;

  const paid = rows.filter(wasPaid);
  const active = rows.filter((r) => r.status === "active");

  let firstYear = 0;
  let renewals = 0;
  for (const r of paid) {
    const price = r.tier ? tierTotal(r.tier) : 0;
    firstYear += price;
    renewals += (r.payments - 1) * price;
  }

  const byTier = tiers.map((tier) => {
    const mine = rows.filter((r) => r.tierId === tier.id);
    const live = mine.filter((r) => r.status === "active");
    return {
      tier,
      active: live.length,
      trees: live.reduce((n, r) => n + r.trees.length, 0),
      collected: mine.reduce((n, r) => n + r.collected, 0),
      yearly: live.reduce((n, r) => n + r.nextCharge, 0),
    };
  });

  const months = new Map<string, { adoptions: number; collected: number }>();
  for (const r of paid) {
    const key = monthOf(r.createdAt);
    const m = months.get(key) ?? { adoptions: 0, collected: 0 };
    m.adoptions += 1;
    // The month a sale was made, at its first-year price. Renewals land in
    // the month they were charged, which the store does not record.
    m.collected += r.tier ? tierTotal(r.tier) : 0;
    months.set(key, m);
  }

  const renewingSoon = active
    .filter((r) => {
      if (!r.renewsAt) return false;
      const t = Date.parse(r.renewsAt);
      return t >= now && t <= now + 60 * DAY;
    })
    .sort((a, b) => Date.parse(a.renewsAt!) - Date.parse(b.renewsAt!));

  return {
    generatedAt: new Date(now).toISOString(),
    adoptions: rows,
    trees: treeRows,
    totals: {
      active: active.length,
      pending: rows.filter((r) => r.status === "pending").length,
      cancelled: rows.filter((r) => r.status === "cancelled").length,
      customers: new Set(paid.map((r) => r.email.trim().toLowerCase())).size,
      collected: firstYear + renewals,
      firstYear,
      renewals,
      yearly: active.reduce((n, r) => n + r.nextCharge, 0),
      yearlyShipping: active.reduce(
        (n, r) => n + (r.nextCharge && r.tier ? r.tier.shipping : 0),
        0,
      ),
      ending: active.filter((r) => r.cancelAtPeriodEnd).length,
      gifts: active.filter((r) => r.giftFrom || r.giftMessage).length,
    },
    treeTotals,
    byTier,
    byMonth: [...months.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, m]) => ({ month, ...m })),
    renewingSoon,
    attention: active.filter((r) => r.flags.some((f) => f.tone === "alert")),
  };
}

/** One line of the delivery address, for a table cell or a label. */
export function addressLines(a: Adoption): string[] {
  const d = a.delivery;
  if (!d) return [];
  return [
    d.line1,
    d.line2,
    [d.postalCode, d.city].filter(Boolean).join(" "),
    [d.region, d.country].filter(Boolean).join(", "),
  ].filter((line): line is string => Boolean(line));
}

const BOM = String.fromCharCode(0xfeff);

/** Rows to CSV, quoting every field so commas and newlines survive. */
export function toCsv(rows: (string | number | undefined)[][]): string {
  const cell = (v: string | number | undefined) => {
    let s = String(v ?? "");
    // Names and gift notes are typed by customers. One starting "=" or "@"
    // would run as a formula when the file is opened in Excel, so it is
    // defused. A phone number's leading "+" is left alone.
    if (/^[=@\t\r]|^[+-][^\d\s]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  // A BOM, so Excel opens accented names as UTF-8 rather than mangling them.
  return BOM + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

