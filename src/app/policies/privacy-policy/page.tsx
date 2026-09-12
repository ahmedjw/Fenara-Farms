import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="September 2026"
      intro="We collect the minimum we need to register your tree, take payment and send you your oil. We do not sell your data, and we do not share it with anyone who is not part of getting your adoption to you."
      sections={[
        {
          heading: "What we collect",
          body: [
            "When you adopt a tree we collect your name, email address and shipping address, along with the trees you chose and the names you gave them. If the adoption is a gift we also collect the message you wrote and who it is from.",
            "Payment card details are handled entirely by Stripe. They never reach our servers and we never see them.",
            "Like most sites we record basic technical information when you visit, such as your browser type and the pages you looked at. This is used to keep the site working, not to build a profile of you.",
          ],
        },
        {
          heading: "Why we hold it",
          body: [
            "To register your tree in your name for the season, to send you updates from the grove, to ship your oil, and to answer you when you write to us.",
            "We also keep a record of your adoption so you can look up your grove later using your adoption number.",
          ],
        },
        {
          heading: "Who we share it with",
          body: [
            "Stripe, to take payment. Our shipping carrier, to deliver your oil. Our email provider, to send you season updates and your confirmation.",
            "That is the whole list. We do not sell personal data, and we do not pass it to advertisers.",
          ],
        },
        {
          heading: "How long we keep it",
          body: [
            "For as long as your adoption is active, and then for as long as tax and accounting law requires us to keep a record of the sale.",
            "You can ask us to delete everything else at any time.",
          ],
        },
        {
          heading: "Your rights",
          body: [
            "You can ask for a copy of what we hold, ask us to correct it, ask us to delete it, or ask us to stop emailing you. Write to hello@fenara.com and we will action it.",
            "If you are in the EU or the UK you have these rights under the GDPR, and you can complain to your national data protection authority if you are not satisfied with how we handle your request.",
          ],
        },
        {
          heading: "Cookies",
          body: [
            "The site uses only what it needs to function, including a session cookie set by Stripe during checkout. We do not run advertising trackers.",
          ],
        },
      ]}
    />
  );
}
