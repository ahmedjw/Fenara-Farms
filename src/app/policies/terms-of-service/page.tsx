import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="September 2026"
      intro={[
        "Welcome to Fenara Farms. These Terms of Service govern your use of our website and our olive tree adoption program, including every adoption you buy and renew. By using our website or adopting a tree, you agree to these Terms. If you do not agree, please do not use our services.",
        "We may update these Terms from time to time. When we make a material change, we will post the updated Terms on this page and change the date above, and we will tell current adopters by email before the change affects their next renewal.",
      ]}
      sections={[
        {
          heading: "Acceptance of these Terms",
          body: [
            "By adopting a tree, making a purchase, or otherwise using our services, you confirm that you have read and agree to these Terms and to our Privacy Policy.",
            "You must be at least 18 years old to adopt a tree.",
          ],
        },
        {
          heading: "What an adoption includes",
          body: [
            "Fenara Farms offers yearly adoption plans for Picual olive trees on our estate in Setenil de las Bodegas, Andalusia, Spain.",
            "Depending on the plan you choose, an adoption includes one or more named olive trees, each with its own spot on our grove map and an adoption number, with your name displayed with your trees. It includes the early-harvest extra virgin olive oil stated for your plan, season updates from flowering through harvest, a printable adoption certificate, and visits to the estate by arrangement.",
            "The exact number of trees and bottles in your plan is shown on the plan page and in your checkout confirmation.",
          ],
        },
        {
          heading: "Adoption period and renewal",
          body: [
            "Each adoption lasts one year from the date of purchase and includes the oil from the harvest that follows your adoption, as described in our Shipping & Returns policy.",
            "Adoptions renew automatically every year until you cancel. On each renewal date, Stripe, our payment provider, charges the card you adopted with the yearly price of your plan. We will let you know ahead of each renewal.",
            "New adopters receive the plans currently offered on our website. If we change a plan’s price or what it includes, we will tell you before your next renewal, and you can cancel before the change takes effect.",
          ],
        },
        {
          heading: "Cancelling your renewal",
          body: [
            "You can cancel your renewal at any time before your renewal date from your grove page on our website, or by writing to us. Cancelling stops future charges. Your adoption continues until the end of the year you have already paid for, and then ends.",
            "When an adoption ends, your trees’ spots return to the grove map and may be adopted by someone else.",
          ],
        },
        {
          heading: "Refunds",
          body: [
            "You may cancel your adoption for a full refund within 14 days, provided the annual harvest has not yet begun.",
            "Once harvest begins, your tree’s oil is being made specifically for that harvest, so cancellations for a refund are no longer possible.",
          ],
        },
        {
          heading: "Tree ownership",
          body: [
            "Adoption is a yearly sponsorship of the care of a tree. It is not a purchase of the tree or the land, and it does not transfer ownership of either. The trees and the land remain the property of Fenara Farms, and we remain responsible for farming them.",
          ],
        },
        {
          heading: "Your spots on the grove map",
          body: [
            "When you adopt, you choose a spot on our grove map for each tree in your plan, from the spots that are open at the time. Spots are offered only in the parts of the estate that are open for adoption.",
            "Your spots and the names you give your trees are fixed once your adoption is confirmed. The website does not currently let you switch, transfer or rename a spot. If you need a change, write to us and we will help where we can.",
            "Renewing keeps your spots registered to you. Olive trees are living things, and natural conditions may change a tree over time.",
          ],
        },
        {
          heading: "Harvest, weather and yield",
          body: [
            "Olive trees alternate between heavy and light years, and weather affects every harvest. If your tree underproduces, we make up your stated allocation from the same block and we tell you that we have done so.",
            "In the event of a total crop failure across the estate, for example from frost or fire, we will offer you either a full refund or the following season’s harvest at no additional cost. That choice is yours.",
          ],
        },
        {
          heading: "Shipping",
          body: [
            "We ship across the EU, the UK and the United States. Shipping is calculated at checkout based on your delivery address and the weight of your allocation. Import duties, customs charges and taxes imposed by your country are the responsibility of the recipient, where applicable. Our Shipping & Returns policy has the details.",
          ],
        },
        {
          heading: "Visiting",
          body: [
            "Adopters are welcome at the estate by prior arrangement, at no charge. It is a working farm, so visits happen when we can host you safely, and we may need to move a date at short notice during harvest.",
          ],
        },
        {
          heading: "Changes to our services",
          body: [
            "We may change, suspend or stop parts of our services, but we will keep our commitments for every adoption year that has already been paid for, as the law requires.",
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
