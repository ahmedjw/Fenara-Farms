import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { formatPrice, tiers } from "@/lib/site";

/** "Mi Olivo (3 bottles) is $35." for each tier, so the page cannot drift. */
const rates = tiers
  .map(
    (tier) =>
      `${tier.name}, ${tier.bottles.replace(" of 500ml", "")}: ${formatPrice(tier.shipping)}.`,
  )
  .join(" ");

export const metadata: Metadata = { title: "Shipping & Returns" };

export default function ShippingPage() {
  return (
    <LegalPage
      title="Shipping & Returns"
      updated="September 2026"
      intro={[
        "Our grove is harvested once a year. That means your oil is made once a year, too.",
        "We harvest the olives in late October, cold-extract the oil within hours of picking, allow it to settle naturally, then filter it three times before bottling. Your allocation then begins its journey to you.",
        "Here’s what to expect.",
      ]}
      sections={[
        {
          heading: "When your oil ships",
          body: [
            "Harvest takes place in late October.",
            "Once the olives are picked, they are cold-extracted within hours. The oil is then allowed to settle naturally and filtered three times before bottling. Our first shipments leave Fenara in early November.",
            "Your oil comes from the harvest that follows your adoption—not from a warehouse shelf.",
          ],
        },
        {
          heading: "Where we ship",
          body: [
            "We currently ship across the EU, the UK, and the United States.",
            "If you are somewhere else in the world and would like to adopt a tree, write to us before purchasing. We’ll let you know whether we can ship to you and whether any additional shipping costs apply.",
          ],
        },
        {
          heading: "What shipping costs",
          body: [
            "Shipping is a flat rate, set by how many bottles travel rather than by how far they go.",
            rates,
            "It appears as its own line at checkout, separate from the adoption, and it is charged once a year alongside it — one charge for the one shipment each harvest produces.",
            "Import duties, customs charges, and taxes imposed by your country are the responsibility of the recipient, where applicable.",
          ],
        },
        {
          heading: "If your oil arrives damaged",
          body: [
            "We package every bottle carefully for its journey. But once it leaves Fenara, it is in the hands of the carrier.",
            "If your shipment arrives damaged, please send us a photo within 14 days of delivery. We’ll make it right and replace the damaged bottles at our cost.",
            "If your shipment never arrives, let us know. We’ll contact the carrier and, if necessary, arrange for a replacement shipment.",
            "We want your Fenara oil to arrive exactly as it should: safely, beautifully, and ready to enjoy.",
          ],
        },
        {
          heading: "Returns & cancellations",
          body: [
            "You may cancel your adoption for a full refund within 14 days, provided the annual harvest has not yet begun.",
            "Once harvest begins, your tree’s oil is being made specifically for that harvest, so cancellations are no longer possible.",
            "Because olive oil is a food product, we cannot accept returns of opened bottles for hygiene and food-safety reasons.",
            "If there is ever a problem with the oil itself, please tell us. We mean that. We put a great deal of care into what comes out of our grove, and we want to know if something isn’t right.",
          ],
        },
      ]}
    />
  );
}
