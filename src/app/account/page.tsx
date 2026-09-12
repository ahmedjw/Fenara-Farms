import type { Metadata } from "next";
import { AccountPanel } from "@/components/account-panel";
import { Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Your grove",
  description:
    "Look up your Fenara Farms adoption to see your trees, where the season has got to, and your certificate.",
};

export default function AccountPage() {
  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.3fr] lg:gap-20">
        <div>
          <h1 className="display text-[clamp(2.5rem,6vw,4rem)] leading-[1.04] text-olive">
            Your grove.
          </h1>
          <p className="mt-6 max-w-[40ch] text-[17px] leading-relaxed text-stone">
            Your adoption number and the email you adopted with are all you
            need. No password to forget.
          </p>
        </div>
        <AccountPanel />
      </div>
    </Section>
  );
}
