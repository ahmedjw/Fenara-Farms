import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { activateAdoption } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Stripe webhook.
 *
 * The single source of truth for whether an adoption is paid. The success page
 * is a redirect the customer can reach without paying, so nothing is activated
 * there. Only a signed checkout.session.completed event flips an adoption to
 * active.
 *
 * Local:      stripe listen --forward-to localhost:3000/api/stripe/webhook
 * Production: add the endpoint in the Stripe dashboard and paste the signing
 *             secret into STRIPE_WEBHOOK_SECRET.
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await activateAdoption(session.id);
    // Hook your transactional email in here: send the adoption number, the
    // certificate and the welcome note.
  }

  return NextResponse.json({ received: true });
}
