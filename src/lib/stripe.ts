/**
 * Stripe client.
 *
 * Returns null when no secret key is configured so the site still builds and
 * renders without keys. Every caller must handle the null case and show the
 * "payments not configured yet" path rather than throwing.
 */

import Stripe from "stripe";
import type { Billing } from "./store";

let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached) {
    // No apiVersion pinned: the installed SDK version sets its own default.
    cached = new Stripe(key);
  }
  return cached;
}

/** What an adoption keeps from its yearly subscription. */
export function billingOf(subscription: Stripe.Subscription): Billing {
  return {
    stripeCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    renewsAt: new Date(subscription.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

/** Billing for a completed checkout, fetching the subscription it created. */
export async function billingOfSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<Billing> {
  if (!session.subscription) return {};
  const subscription =
    typeof session.subscription === "string"
      ? await stripe.subscriptions.retrieve(session.subscription)
      : session.subscription;
  return billingOf(subscription);
}

export function stripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  );
}
