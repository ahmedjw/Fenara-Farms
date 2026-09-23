/**
 * Central brand + commerce configuration.
 *
 * Anything a non-developer is likely to want to change lives in this file.
 * Prices are in the smallest currency unit (cents) because that is what
 * Stripe expects.
 */

/**
 * Public base URL, used for metadataBase and the Stripe redirects.
 *
 * An environment variable can be present but empty, which is what a blank
 * field in the Vercel dashboard gives you. `??` only catches undefined, so an
 * empty value used to reach `new URL("")` in the root layout and fail the
 * build with ERR_INVALID_URL. Treat empty as missing, fall back to the domain
 * Vercel provides, and never return something `new URL()` cannot parse.
 */
function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelHost =
    process.env.NEXT_PUBLIC_VERCEL_URL?.trim() || process.env.VERCEL_URL?.trim();
  // Replit names the domains it serves the deployment on. Both are plain
  // server variables, so unlike NEXT_PUBLIC_SITE_URL they are read at
  // runtime and a deployment picks up its own domain without a rebuild.
  const replitHost =
    process.env.REPLIT_DOMAINS?.split(",")[0]?.trim() ||
    process.env.REPLIT_DEV_DOMAIN?.trim();

  const host = vercelHost || replitHost;
  const candidate = configured || (host ? `https://${host}` : "");
  if (!candidate) return "http://localhost:3000";

  const withScheme = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  try {
    return new URL(withScheme).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export const site = {
  name: "Fenara Farms",
  tagline: "Rooted In History. Restored By Nature. Made For Today.",
  shortDescription:
    "Adopt a Picual olive tree on our regenerative estate in Andalusia and receive the oil it produces.",
  estate: "Setenil de las Bodegas, Andalusia in Southern Spain",
  /** What the maps call the whole property. */
  estateName: "La Finca",
  /**
   * Order by this moment to have the oil arrive before the holidays, with the
   * Madrid offset. The header counts down to it and hides the countdown once it
   * has passed. Spain leaves summer time on 25 October 2026, so the offset at
   * the end of the month is +01:00.
   */
  orderByAt: "2026-10-31T23:59:59+01:00",
  email: "info@fenarafarms.com",
  instagram: "https://instagram.com/",
  url: resolveSiteUrl(),
} as const;

/**
 * Headline facts about the grove, shown on the home and grove pages.
 *
 * How many trees are open is not here. It used to be, set by hand, and it
 * drifted: the page advertised 100 while the map offered 65. Count it from
 * the map instead, with `adoptableTrees.length`, so removing a tree from
 * assets/farm-data.json corrects every page that quotes the number.
 */
export const groveFacts = {
  treesOnEstate: "Over 1,000",
  treeAge: "20–35 years",
};

/**
 * Change these two lines to switch the whole site to euros.
 * currency must be a Stripe-supported ISO code, lowercase.
 */
export const currency = "usd";
export const currencySymbol = "$";

/** A date as the estate would write it, e.g. "15 October 2026", in Madrid time. */
export function formatDate(date: string | number | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(new Date(date));
}

export function formatPrice(cents: number): string {
  const whole = cents / 100;
  return `${currencySymbol}${whole % 1 === 0 ? whole.toFixed(0) : whole.toFixed(2)}`;
}

/**
 * Shipping.
 *
 * A flat charge per tier, set by how many bottles travel, not by where they
 * are going. It is billed as its own yearly line beside the adoption, so it
 * recurs with the adoption and is charged again on each renewal, for each
 * year's shipment.
 *
 * Stripe's own shipping rates are not used. Those only work in a Checkout
 * Session in payment mode, and an adoption is a subscription.
 */
export const shippingLabel = "Shipping, one harvest";

export type Tier = {
  id: string;
  name: string;
  englishName: string;
  /** The one-line voice of the tier, e.g. "This is my tree." */
  tagline: string;
  /** Yearly price in cents. Stripe charges it at checkout and again on each renewal. */
  price: number;
  /** Yearly shipping in cents, flat for the tier. Charged beside the price. */
  shipping: number;
  trees: number;
  /** Total litres of oil per season. */
  litres: number;
  bottles: string;
  shipments: string;
  blurb: string;
  includes: string[];
  featured?: boolean;
  /** A short tab shown above the card, e.g. "Top adopter". */
  badge?: string;
};

export const tiers: Tier[] = [
  {
    id: "mi-olivo",
    name: "Mi Olivo",
    englishName: "One tree",
    tagline: "This is my tree.",
    price: 12900,
    shipping: 3500,
    trees: 1,
    litres: 1.5,
    bottles: "3 bottles of 500ml",
    shipments: "Ships in early November, after harvest",
    blurb:
      "Your own Picual olive tree at Fenara. The simplest way to become part of the grove.",
    includes: [
      "One named olive tree with its own adoption number",
      "3 bottles of 500ml estate early-harvest extra virgin olive oil",
      "Your name displayed with your tree",
      "Season updates from flowering through harvest",
    ],
  },
  {
    id: "la-familia",
    name: "La Familia",
    englishName: "Two trees",
    tagline: "These are our family trees.",
    price: 24900,
    shipping: 6500,
    trees: 2,
    litres: 3,
    bottles: "6 bottles of 500ml",
    shipments: "Ships in early November, after harvest",
    blurb:
      "Two neighbouring Picual trees, growing side by side in the grove. A little more oil, a little more connection — and enough to share around the family table.",
    includes: [
      "Two named trees, adjacent in the same block",
      "6 bottles of 500ml estate early-harvest extra virgin olive oil",
      "Your name displayed with your trees",
      "Season updates from flowering through harvest",
      "First refusal on your trees next season",
    ],
    featured: true,
    badge: "Top adopter",
  },
  {
    id: "el-olivar",
    name: "El Olivar",
    englishName: "Four trees",
    tagline: "Our little corner of Fenara.",
    price: 48900,
    shipping: 9500,
    trees: 4,
    litres: 6,
    bottles: "12 bottles of 500ml",
    shipments: "Ships in early November, after harvest",
    blurb:
      "Your own little corner of Fenara. Four neighbouring Picual trees that become part of your story — a place to share with family, give as a gift, or simply call your own.",
    includes: [
      "Four named trees forming your own small block",
      "12 bottles of 500ml estate early-harvest extra virgin olive oil",
      "Your name displayed with your trees",
      "Season updates from flowering through harvest",
      "First refusal on your trees next season",
    ],
  },
];

export function getTier(id: string): Tier | undefined {
  return tiers.find((t) => t.id === id);
}

/** What the card is charged at checkout and on each renewal. */
export function tierTotal(tier: Tier): number {
  return tier.price + tier.shipping;
}
