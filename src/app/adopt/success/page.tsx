import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle, Warning } from "@phosphor-icons/react/dist/ssr";
import { Certificate } from "@/components/certificate";
import { Section } from "@/components/ui";
import { getAdoptionBySession, activateAdoption } from "@/lib/store";
import { billingOfSession, getStripe } from "@/lib/stripe";
import { formatDate, getTier, site } from "@/lib/site";

export const metadata: Metadata = { title: "Your adoption is confirmed" };
export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    return (
      <Notice title="No adoption to show">
        This page is reached after checkout. If you have just paid and landed
        here, check your email for your adoption number, or write to us and we
        will sort it out.
      </Notice>
    );
  }

  let adoption = await getAdoptionBySession(sessionId);

  // The webhook is authoritative, but it can land after the redirect. Confirm
  // payment directly with Stripe so the customer is not left staring at a
  // pending state that is actually paid.
  const stripe = getStripe();
  if (stripe && adoption && adoption.status === "pending") {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid") {
        adoption =
          (await activateAdoption(
            sessionId,
            await billingOfSession(stripe, session),
          )) ?? adoption;
      }
    } catch {
      // Leave it pending. The webhook will catch up.
    }
  }

  if (!adoption) {
    return (
      <Notice title="We could not find that adoption">
        The checkout session did not match an adoption on our side. Nothing is
        lost. Email us with your payment confirmation and we will register your
        trees by hand.
      </Notice>
    );
  }

  const tier = getTier(adoption.tierId);

  return (
    <>
      <Section bottom={false} className="pb-8">
        <div className="flex items-start gap-4">
          <CheckCircle
            size={30}
            weight="light"
            className="mt-1 shrink-0 text-olive-mid"
          />
          <div>
            <h1 className="display text-[clamp(2.25rem,5vw,3.5rem)] leading-tight text-olive">
              {adoption.trees.length === 1
                ? "Your tree is yours."
                : "Your trees are yours."}
            </h1>
            <p className="mt-5 max-w-[54ch] text-[17px] leading-relaxed text-stone">
              Adoption{" "}
              <span className="font-mono text-[15px] text-ink">
                {adoption.number}
              </span>{" "}
              is registered for the {adoption.season} season. We have sent a
              confirmation to {adoption.email}. Keep your adoption number: it is
              how you reach your grove.
            </p>
            <p className="mt-4 max-w-[54ch] text-[15px] leading-relaxed text-stone">
              Your adoption renews every year
              {adoption.renewsAt ? `, next on ${formatDate(adoption.renewsAt)}` : ""}
              , and Stripe charges the card you used unless renewal is switched
              off. Write to us at {site.email} and we will sort it.
            </p>

            {adoption.status === "pending" && (
              <div className="mt-6 flex max-w-[54ch] gap-3 border border-line-strong bg-paper-raised p-4">
                <Warning
                  size={18}
                  weight="light"
                  className="mt-0.5 shrink-0 text-stone"
                />
                <p className="text-[14px] leading-relaxed text-stone">
                  Payment is still settling. This usually clears within a
                  minute. Your trees are held for you in the meantime.
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-[14px]">
              <Link
                href="/account"
                className="border-b border-ink pb-1 text-ink transition-colors hover:border-brick hover:text-brick"
              >
                Go to your grove
              </Link>
            </div>
          </div>
        </div>
      </Section>

      <Section top={false}>
        <Certificate adoption={adoption} tierName={tier?.name ?? ""} />
      </Section>

      <Section className="border-t border-line bg-paper-raised">
        <h2 className="display text-[clamp(1.75rem,3.6vw,2.5rem)] text-olive">
          What happens next.
        </h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {[
            [
              "This week",
              "We mark your trees on the grove plan and set a marker at the base of each trunk with the name you chose.",
            ],
            [
              "Through the season",
              "Updates from the estate as the fruit develops: grove and soil conditions, tree health, and the run up to harvest.",
            ],
            [
              "After harvest",
              "The olives are picked at their peak and cold-extracted within hours. Your oil is bottled from that harvest and shipped to you.",
            ],
          ].map(([when, what]) => (
            <li key={when} className="border-t border-line-strong pt-5">
              <h3 className="display text-[22px] leading-tight text-ink">
                {when}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-stone">
                {what}
              </p>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}

function Notice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Section>
      <h1 className="display text-[clamp(2rem,4.5vw,3rem)] text-olive">
        {title}
      </h1>
      <p className="mt-5 max-w-[54ch] text-[16px] leading-relaxed text-stone">
        {children}
      </p>
      <Link
        href="/adopt"
        className="mt-8 inline-block border-b border-ink pb-1 text-[14px] text-ink transition-colors hover:border-brick hover:text-brick"
      >
        Back to adoption
      </Link>
    </Section>
  );
}
