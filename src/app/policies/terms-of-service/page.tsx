import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="September 2026"
      intro="Adopting a tree at Fenara Farms means you sponsor the care of a specific olive tree on our estate for one harvest season, and you receive the oil allocation that comes with your tier. These terms set out what that does and does not include."
      sections={[
        {
          heading: "What adoption is",
          body: [
            "Adoption is a seasonal sponsorship, not a purchase of land, and not a transfer of ownership of the tree. The tree stays part of Fenara Farms and we remain responsible for farming it.",
            "For the season you have adopted, the tree is registered in your name, marked on the grove plan, and carries the name you gave it on a marker at its base.",
          ],
        },
        {
          heading: "What you receive",
          body: [
            "The oil allocation stated for your tier, produced from that season's harvest, extra virgin, cold extracted and bottled on the estate.",
            "An adoption certificate, and updates from the grove through the season.",
            "Your allocation is fixed by your tier and does not vary with how much your individual tree happens to yield.",
          ],
        },
        {
          heading: "Harvest, weather and yield",
          body: [
            "Olive trees alternate between heavy and light years, and weather affects every harvest. If your tree underproduces, we make up your stated allocation from the same block and we tell you that we have done so.",
            "In the event of a total crop failure across the estate, for example from frost or fire, we will offer you either a full refund or the following season's harvest at no additional cost. That choice is yours.",
          ],
        },
        {
          heading: "Term and renewal",
          body: [
            "Each adoption covers one harvest season. It does not renew automatically. We will write to you before the next season opens and you can choose to renew.",
            "Renewing keeps your specific trees registered to you. If you do not renew, your trees return to the pool and may be adopted by someone else.",
          ],
        },
        {
          heading: "Cancellation and refunds",
          body: [
            "You can cancel for a full refund within 14 days of adopting, provided the harvest has not yet begun.",
            "After harvest begins, the oil has been produced against your adoption and we cannot refund it. If your delivery arrives damaged or does not arrive at all, tell us and we will replace it.",
          ],
        },
        {
          heading: "Shipping",
          body: [
            "We ship across the EU, the UK and the United States. Shipping is calculated at checkout based on your address and the weight of your allocation.",
            "You are responsible for any import duties or taxes charged by your own country.",
          ],
        },
        {
          heading: "Visiting",
          body: [
            "Adopters are welcome at the estate by prior arrangement, at no charge. It is a working farm, so visits happen when we can host you safely, and we may need to move a date at short notice during harvest.",
          ],
        },
        {
          heading: "Governing law",
          body: [
            "These terms are governed by the law of Spain, and the courts of Andalusia have jurisdiction over any dispute arising from them.",
          ],
        },
      ]}
    />
  );
}
