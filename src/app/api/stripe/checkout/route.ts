import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { currency, getTier, site } from "@/lib/site";
import { getCell } from "@/lib/land";
import { createAdoption, takenTreeIds, TreesTakenError } from "@/lib/store";

export const runtime = "nodejs";

type Body = {
  tierId?: string;
  trees?: string[];
  names?: Record<string, string>;
  customerName?: string;
  email?: string;
  giftFrom?: string;
  giftMessage?: string;
};

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      {
        error:
          "Payments are not connected. Add STRIPE_SECRET_KEY to .env.local and restart the server.",
      },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { tierId, trees, names, customerName, email, giftFrom, giftMessage } =
    body;

  const tier = tierId ? getTier(tierId) : undefined;
  if (!tier) {
    return NextResponse.json({ error: "Unknown adoption tier." }, { status: 400 });
  }

  if (!Array.isArray(trees) || trees.length !== tier.trees) {
    return NextResponse.json(
      { error: `Please choose exactly ${tier.trees} trees.` },
      { status: 400 },
    );
  }

  if (new Set(trees).size !== trees.length) {
    return NextResponse.json(
      { error: "Each spot can only be chosen once." },
      { status: 400 },
    );
  }

  if (!customerName?.trim() || !email?.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json(
      { error: "A name and a valid email address are required." },
      { status: 400 },
    );
  }

  // Every spot must be on the land map, in a zone that is open, and not
  // already spoken for. createAdoption checks the last part again at the
  // moment it writes, in case another checkout gets there first.
  const alreadyTaken = new Set(await takenTreeIds());
  for (const id of trees) {
    const cell = typeof id === "string" ? getCell(id) : undefined;
    if (!cell) {
      return NextResponse.json(
        { error: `Spot ${id} is not part of the grove.` },
        { status: 400 },
      );
    }
    if (cell.zone.status !== "active") {
      return NextResponse.json(
        { error: `Spot ${id} is not open for adoption yet.` },
        { status: 400 },
      );
    }
    if (alreadyTaken.has(cell.id)) {
      return NextResponse.json(
        {
          error: `Spot ${id} was adopted while you were choosing. Please pick another.`,
        },
        { status: 409 },
      );
    }
  }

  const cleanNames: Record<string, string> = {};
  for (const id of trees) {
    cleanNames[id] = (names?.[id] ?? "").trim().slice(0, 28) || id;
  }

  // site.url already resolves the env var, the Vercel domain and the local
  // fallback, and guarantees a parseable absolute URL.
  const baseUrl = site.url;

  const metadata = {
    tierId: tier.id,
    trees: trees.join(","),
    customerName: customerName.trim(),
  };

  try {
    // Adoptions renew every year until cancelled, so checkout starts a yearly
    // subscription. Stripe charges the plan price now and on each anniversary.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email.trim(),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: tier.price,
            recurring: { interval: "year" },
            product_data: {
              name: `Fenara Farms adoption, ${tier.name}`,
              description: `${tier.trees} Picual ${
                tier.trees === 1 ? "tree" : "trees"
              } at Fenara Farms. ${tier.bottles} from each harvest. Renews yearly until cancelled.`,
            },
          },
        },
      ],
      subscription_data: { metadata },
      // The EU, the UK and the United States, as the shipping policy states.
      shipping_address_collection: {
        allowed_countries: [
          "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE",
          "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT",
          "RO", "SK", "SI", "ES", "SE", "GB", "US",
        ],
      },
      metadata,
      success_url: `${baseUrl}/adopt/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/adopt/${tier.id}`,
    });

    try {
      await createAdoption({
        tierId: tier.id,
        trees,
        names: cleanNames,
        customerName: customerName.trim(),
        email: email.trim(),
        stripeSessionId: session.id,
        giftFrom: giftFrom?.trim() || undefined,
        giftMessage: giftMessage?.trim().slice(0, 200) || undefined,
      });
    } catch (e) {
      // The session exists but nothing on our side backs it, so close it
      // before anyone can pay for a spot they will not get.
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      throw e;
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    if (e instanceof TreesTakenError) {
      return NextResponse.json(
        {
          error: `Spot ${e.ids.join(", ")} was adopted while you were choosing. Please pick another.`,
        },
        { status: 409 },
      );
    }
    const message =
      e instanceof Error ? e.message : "Could not start checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
