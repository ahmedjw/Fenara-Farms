/**
 * Rebuild adoptions from Stripe.
 *
 * Stripe is the only place a payment is certain to be recorded. When our own
 * record is missing — as it was for every order taken while adoptions lived in
 * a file on an ephemeral disk — the subscription in Stripe still carries the
 * metadata checkout put on it, and the adoption can be put back from that.
 *
 * Also worth running now and then as a reconciliation: it reports any paid
 * subscription with no adoption behind it.
 *
 *   npm run recover              list what is missing, change nothing
 *   npm run recover -- --apply   write the missing adoptions
 *
 * Needs STRIPE_SECRET_KEY and DATABASE_URL in the environment.
 *
 * What it cannot bring back: the names the customer gave each tree, and any
 * gift sender or message. Those were only ever in our own store. Trees are
 * restored named after themselves; ask the customer and edit afterwards.
 */

import Stripe from "stripe";
import { treeForSpot } from "../src/lib/farm";
import {
  createAdoption,
  getAdoption,
  TreesTakenError,
  type AdoptionStatus,
  type Billing,
} from "../src/lib/store";
import { db } from "../src/lib/db";
import { billingOf } from "../src/lib/stripe";

const apply = process.argv.includes("--apply");

type Found = {
  subscriptionId: string;
  email: string;
  customerName: string;
  tierId: string;
  trees: string[];
  status: AdoptionStatus;
  billing: Billing;
  created: string;
  sessionId?: string;
};

function statusOf(subscription: Stripe.Subscription): AdoptionStatus {
  if (subscription.status === "active" || subscription.status === "trialing") {
    return "active";
  }
  if (subscription.status === "canceled" || subscription.status === "incomplete_expired") {
    return "cancelled";
  }
  return "pending";
}

async function emailFor(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<string> {
  const customer =
    typeof subscription.customer === "string"
      ? await stripe.customers.retrieve(subscription.customer)
      : subscription.customer;
  if (!customer || customer.deleted) return "";
  return customer.email ?? "";
}

async function sessionFor(
  stripe: Stripe,
  subscriptionId: string,
): Promise<string | undefined> {
  try {
    const sessions = await stripe.checkout.sessions.list({
      subscription: subscriptionId,
      limit: 1,
    });
    return sessions.data[0]?.id;
  } catch {
    return undefined;
  }
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  const stripe = new Stripe(key);

  // Touch the database first, so a bad connection string fails here rather
  // than halfway through writing.
  const driver = await db();

  const missing: Found[] = [];
  let seen = 0;

  for await (const subscription of stripe.subscriptions.list({
    status: "all",
    limit: 100,
    expand: ["data.customer"],
  })) {
    const meta = subscription.metadata ?? {};
    if (!meta.tierId || !meta.trees) continue; // not one of ours
    seen++;

    const { rows } = await driver.query<{ number: string }>(
      `select number from adoptions where stripe_subscription_id = $1`,
      [subscription.id],
    );
    if (rows.length) continue;

    missing.push({
      subscriptionId: subscription.id,
      email: await emailFor(stripe, subscription),
      customerName: meta.customerName ?? "",
      tierId: meta.tierId,
      trees: meta.trees.split(",").map((t) => t.trim()).filter(Boolean),
      status: statusOf(subscription),
      billing: billingOf(subscription),
      created: new Date(subscription.created * 1000).toISOString(),
      sessionId: await sessionFor(stripe, subscription.id),
    });
  }

  console.log(`\n${seen} Fenara subscriptions in Stripe, ${missing.length} with no adoption on our side.`);

  for (const m of missing) {
    console.log(`\n  ${m.subscriptionId}  ${m.created.slice(0, 10)}  ${m.status}`);
    console.log(`    ${m.customerName || "(no name)"} <${m.email || "no email"}>`);
    console.log(`    tier ${m.tierId}`);
    for (const spot of m.trees) {
      const tree = treeForSpot(spot);
      console.log(
        `    ${spot}  ->  ${tree ? tree.id : "NO TREE ON TODAY'S MAP — check this one by hand"}`,
      );
    }
  }

  if (!missing.length) {
    console.log("\nNothing to recover.");
    return;
  }

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to write these adoptions.");
    return;
  }

  console.log("\nWriting...");
  for (const m of missing) {
    if (!m.email) {
      console.log(`  ${m.subscriptionId}: skipped, no email on the customer.`);
      continue;
    }
    try {
      const adoption = await createAdoption({
        tierId: m.tierId,
        trees: m.trees,
        // The real names are gone. A tree named after itself is honest and
        // obvious to spot when you go to correct it.
        names: Object.fromEntries(m.trees.map((t) => [t, t])),
        customerName: m.customerName || m.email,
        email: m.email,
        status: m.status,
        stripeSessionId: m.sessionId,
        ...m.billing,
      });
      console.log(`  ${m.subscriptionId}: recorded as ${adoption.number}`);
    } catch (e) {
      if (e instanceof TreesTakenError) {
        const holders = await Promise.all(
          e.ids.map(async (id) => {
            const { rows } = await driver.query<{ adoption_number: string }>(
              `select adoption_number from adoption_holds where tree_id = $1`,
              [id],
            );
            const number = rows[0]?.adoption_number;
            const held = number ? await getAdoption(number) : null;
            return `${id} held by ${number ?? "?"} (${held?.email ?? "?"})`;
          }),
        );
        console.log(
          `  ${m.subscriptionId}: NOT recorded, its trees belong to someone else:\n      ${holders.join("\n      ")}`,
        );
        continue;
      }
      console.log(`  ${m.subscriptionId}: failed — ${(e as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
