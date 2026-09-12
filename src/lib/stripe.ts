/**
 * Stripe client.
 *
 * Returns null when no secret key is configured so the site still builds and
 * renders without keys. Every caller must handle the null case and show the
 * "payments not configured yet" path rather than throwing.
 */

import Stripe from "stripe";

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

export function stripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  );
}
