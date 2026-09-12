import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Shipping and returns" };

export default function ShippingPage() {
  return (
    <LegalPage
      title="Shipping and returns"
      updated="September 2026"
      intro="The grove is harvested once a year, so oil ships once a year. Here is when your delivery moves, what it costs, and what happens if something goes wrong on the way."
      sections={[
        {
          heading: "When your oil ships",
          body: [
            "Harvest runs through November. Oil is cold extracted within hours of picking, then left to settle before bottling. First shipments leave the estate in December.",
            "Tiers with more than one shipment have the rest of the allocation sent across the following months, so the last bottles you open are not the oldest.",
          ],
        },
        {
          heading: "Where we ship",
          body: [
            "Across the EU, the UK and the United States. If you are somewhere else and you want to adopt, write to us before you buy and we will tell you honestly whether we can get it to you.",
          ],
        },
        {
          heading: "What it costs",
          body: [
            "Shipping is calculated at checkout from your address and the weight of your allocation. It is not included in the adoption price, because the difference between shipping within Spain and shipping to California is large enough that burying it in the price would be unfair to one of you.",
            "Import duties and taxes charged by your own country are your responsibility.",
          ],
        },
        {
          heading: "If it arrives damaged",
          body: [
            "Bottles travel in moulded protective packaging and most arrive fine. If yours does not, send us a photo within 14 days of delivery and we will replace the damaged bottles at our cost.",
            "If a delivery does not arrive at all, tell us and we will chase the carrier and resend.",
          ],
        },
        {
          heading: "Returns",
          body: [
            "You can cancel an adoption for a full refund within 14 days, provided harvest has not begun.",
            "We cannot accept returns of opened food products for hygiene reasons. If there is something wrong with the oil itself, tell us. We would rather know.",
          ],
        },
      ]}
    />
  );
}
