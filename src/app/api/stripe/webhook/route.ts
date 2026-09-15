import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { billingOf, billingOfSession, getStripe } from "@/lib/stripe";
import {
  activateAdoption,
  expireAdoption,
  recordRenewal,
  syncSubscription,
} from "@/lib/store";

export const runtime = "nodejs";

/**
 * Stripe webhook.
 *
 * The single source of truth for whether an adoption is paid. The success page
 * is a redirect the customer can reach without paying, so nothing is activated
 * there without checking with Stripe. Adoptions are yearly subscriptions, so
 * this also follows renewals, cancellations and checkouts that expire unpaid.
 *
 * Events to send to this endpoint:
 *   checkout.session.completed   the first year is paid
 *   checkout.session.expired     an unpaid checkout lapsed; its spots are released
 *   invoice.paid                 a yearly renewal was paid
 *   customer.subscription.updated  renewal date moved, or the customer cancelled
 *   customer.subscription.deleted  the subscription ended; its spots are released
 *
 * Local:      stripe listen --forward-to localhost:3000/api/stripe/webhook
 * Production: add the endpoint in the Stripe dashboard with the events above
 *             and paste the signing secret into STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      await activateAdoption(session.id, await billingOfSession(stripe, session));
      // Hook your transactional email in here: send the adoption number, the
      // certificate and the welcome note.
      break;
    }
    case "checkout.session.expired":
      await expireAdoption(event.data.object.id);
      break;
    case "invoice.paid": {
      const invoice = event.data.object;
      const subscription =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;
      // The first invoice is the purchase itself; only yearly cycles are renewals.
      if (subscription && invoice.billing_reason === "subscription_cycle") {
        await recordRenewal(subscription, invoice.id);
      }
      break;
    }
    case "customer.subscription.updated":
      await syncSubscription(
        event.data.object.id,
        billingOf(event.data.object),
      );
      break;
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object.id, {
        cancelAtPeriodEnd: false,
        ended: true,
      });
      break;
  }

  return NextResponse.json({ received: true });
}
