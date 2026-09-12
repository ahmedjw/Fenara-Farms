/**
 * Central brand + commerce configuration.
 *
 * Anything a non-developer is likely to want to change lives in this file.
 * Prices are in the smallest currency unit (cents) because that is what
 * Stripe expects.
 */

export const site = {
  name: "Fenara Farms",
  tagline: "Rooted in history. Restored by nature. Made for today.",
  shortDescription:
    "Adopt a Picual olive tree on our regenerative estate in Andalusia and receive the oil it produces.",
  estate: "Andalusia, Southern Spain",
  email: "hello@fenara.com",
  instagram: "https://instagram.com/",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

/**
 * Change these two lines to switch the whole site to euros.
 * currency must be a Stripe-supported ISO code, lowercase.
 */
export const currency = "usd";
export const currencySymbol = "$";

export function formatPrice(cents: number): string {
  const whole = cents / 100;
  return `${currencySymbol}${whole % 1 === 0 ? whole.toFixed(0) : whole.toFixed(2)}`;
}

export type Tier = {
  id: string;
  name: string;
  englishName: string;
  /** Annual price in cents. */
  price: number;
  trees: number;
  /** Total litres of oil per season. */
  litres: number;
  bottles: string;
  shipments: string;
  blurb: string;
  includes: string[];
  /** Roughly how many of this tier are left this season. Real inventory. */
  remaining: number;
  featured?: boolean;
};

export const tiers: Tier[] = [
  {
    id: "un-olivo",
    name: "Un Olivo",
    englishName: "One tree",
    price: 11500,
    trees: 1,
    litres: 2,
    bottles: "4 bottles of 500ml",
    shipments: "1 shipment after harvest",
    blurb:
      "A single Picual, yours for the season. The simplest way into the grove.",
    includes: [
      "One named olive tree with its own adoption number",
      "4 bottles of 500ml estate extra virgin olive oil",
      "Adoption certificate with your tree's location",
      "Season updates from flowering through harvest",
    ],
    remaining: 34,
  },
  {
    id: "la-familia",
    name: "La Familia",
    englishName: "Three trees",
    price: 26500,
    trees: 3,
    litres: 6,
    bottles: "12 bottles of 500ml",
    shipments: "2 shipments across the year",
    blurb:
      "Three neighbouring trees, enough oil for a household that actually cooks with it.",
    includes: [
      "Three named trees, adjacent in the same block",
      "12 bottles of 500ml estate extra virgin olive oil",
      "Adoption certificates for all three trees",
      "Season updates from flowering through harvest",
      "First refusal on your trees next season",
    ],
    remaining: 12,
    featured: true,
  },
  {
    id: "el-olivar",
    name: "El Olivar",
    englishName: "Eight trees",
    price: 59500,
    trees: 8,
    litres: 16,
    bottles: "32 bottles of 500ml",
    shipments: "2 shipments across the year",
    blurb:
      "A corner of the grove under your name. For gifting, for a table that hosts, or for a business that cares where things come from.",
    includes: [
      "Eight named trees forming your own block",
      "32 bottles of 500ml estate extra virgin olive oil",
      "Adoption certificates for all eight trees",
      "Season updates from flowering through harvest",
      "Split shipping to up to 4 addresses",
      "First refusal on your block next season",
    ],
    remaining: 5,
  },
];

export function getTier(id: string): Tier | undefined {
  return tiers.find((t) => t.id === id);
}
