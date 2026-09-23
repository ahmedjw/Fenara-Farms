import { formatPrice, site, tiers } from "./site";

export type FaqItem = { q: string; a: string };

/** "$35, $65 or $95", in tier order, so the shipping answer cannot drift. */
const shippingRates = (() => {
  const amounts = tiers.map((t) => formatPrice(t.shipping));
  return `${amounts.slice(0, -1).join(", ")} or ${amounts[amounts.length - 1]}`;
})();

export const faq: FaqItem[] = [
  {
    q: "What exactly am I adopting?",
    a: "A real Picual olive tree growing on our estate in Andalusia, identified by its own adoption number and by the name you give it. It is registered to you for the season, cared for by us all year, and marked as yours on the grove plan.",
  },
  {
    q: "How much oil do I receive, and when?",
    a: "It depends on the tier you choose, starting at three 500ml bottles from a single tree. The grove is harvested once a year, in late October. The oil is cold-extracted within hours of picking, left to settle naturally and filtered three times before bottling. Our first shipments leave Fenara in early November.",
  },
  {
    q: "Why is the adoption annual?",
    a: "Because the grove produces one harvest each year. Each adoption covers a single harvest and renews automatically, so your tree remains registered in your name for the following season. Either way, your tree remains part of the grove, and we continue to care for it year-round.",
  },
  {
    q: "What happens after the first year?",
    a: `Your adoption covers one year. You can choose whether to renew, and you can switch off renewal at any time. Just write to us at ${site.email}, and we\u2019ll take care of the rest.`,
  },
  {
    q: "What does regenerative farming actually mean here?",
    a: "We stopped farming for maximum yield. We sow cover crops between the rows to return nutrients to the soil, create habitat for pollinators, and keep the ground covered. The soil holds water again, and the grove is measurably healthier. It took years, not one season.",
  },
  {
    q: "Can I visit my tree?",
    a: "Yes. Adopters are welcome at the estate by arrangement, and harvest is the best time to come. Write to us and we will find a date that works. Visits are not included in the adoption price, but there is no charge to walk the grove and see your tree.",
  },
  {
    q: "Can I adopt a tree as a gift?",
    a: "Yes, and it is one of the most common reasons people adopt. At checkout, you can mark the adoption as a gift, add the recipient's details, and write a short message to be included on the certificate. Nothing arrives with a price on it.",
  },
  {
    q: "What makes this oil different from oil in a shop?",
    a: "It comes from a single estate, one variety, and one harvest, and is cold-extracted and bottled in small batches. Oil sold in supermarkets is often blended across regions and seasons and may sit for a long time before reaching you. You will know the block your oil came from and the year it was picked.",
  },
  {
    q: "What happens if my tree has a bad year?",
    a: "Olive trees naturally alternate between heavier and lighter harvests. A heavy year is often followed by a light one, and weather does what it wants. If your tree underproduces, we make up the difference from the same block and tell you plainly that we have done so. You always receive the quantity you paid for.",
  },
  {
    q: "Where do you ship, and what does it cost?",
    a: `We ship across the EU, the UK and the United States. If you are somewhere else, write to us before purchasing and we will tell you whether we can ship to you. Shipping is a flat rate set by the size of your adoption, ${shippingRates} a year, shown as its own line at checkout. We package every bottle carefully, and we replace anything that arrives damaged.`,
  },
];
