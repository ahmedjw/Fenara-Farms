/**
 * Adoption store.
 *
 * Backed by Postgres. Every read and write goes through the functions below,
 * so the rest of the site never writes a query and swapping the database
 * again means rewriting this one file.
 *
 * Two tables, for two different questions. `adoptions` is the record of what
 * someone bought, and it keeps its trees listed even after it is cancelled.
 * `adoption_holds` answers only "is this tree spoken for right now", and its
 * primary key on tree_id is what makes selling the same tree twice impossible
 * rather than merely unlikely. See db.ts for the schema.
 */

import { db, type Row, type Sql } from "./db";

export type AdoptionStatus = "pending" | "active" | "cancelled";

export type Adoption = {
  /** Human readable adoption number, e.g. FEN-2026-0043. */
  number: string;
  tierId: string;
  /**
   * Spot ids from the land map, e.g. ["A-R41-C55"]. Adoptions made before the
   * land map hold tree ids from the grove plan instead, e.g. ["NAV-014"].
   */
  trees: string[];
  /** Tree id mapped to the name the customer gave it. */
  names: Record<string, string>;
  customerName: string;
  email: string;
  status: AdoptionStatus;
  /** The harvest season this adoption currently covers. Moves on with each renewal. */
  season: number;
  stripeSessionId?: string;
  /** Set once checkout completes. Adoptions renew yearly as a Stripe subscription. */
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  /** When Stripe next charges for renewal, ISO date. */
  renewsAt?: string;
  /** The customer cancelled: the adoption ends at renewsAt instead of renewing. */
  cancelAtPeriodEnd?: boolean;
  /** Renewal invoices already counted, so a webhook Stripe retries cannot count one twice. */
  renewalInvoices?: string[];
  createdAt: string;
  giftFrom?: string;
  giftMessage?: string;
};

export type Billing = Pick<
  Adoption,
  "stripeCustomerId" | "stripeSubscriptionId" | "renewsAt" | "cancelAtPeriodEnd"
>;

/** Thrown when an adoption asks for a tree that another adoption already holds. */
export class TreesTakenError extends Error {
  constructor(readonly ids: string[]) {
    super(`Already adopted: ${ids.join(", ")}`);
    this.name = "TreesTakenError";
  }
}

/**
 * How long a checkout session may be paid for.
 *
 * Stripe's own minimum. The shorter it is, the sooner an abandoned checkout
 * gives its trees back.
 */
export const CHECKOUT_WINDOW_MS = 30 * 60 * 1000;

/**
 * How long an unpaid adoption holds its trees.
 *
 * Deliberately longer than the checkout window, so a session can never still
 * be payable after its hold has lapsed and sell the same tree twice.
 *
 * Without a limit, a customer who closed the tab held their trees until a
 * checkout.session.expired webhook released them — and forever if the
 * deployment had no webhook configured. The webhook is still the tidy path;
 * this is what happens when it does not arrive.
 */
export const PENDING_HOLD_MS = CHECKOUT_WINDOW_MS + 5 * 60 * 1000;

export const SEASON = 2026;

const HOLD_SECONDS = PENDING_HOLD_MS / 1000;

/** Postgres error code for a unique constraint violation. */
const UNIQUE_VIOLATION = "23505";

/** Everything an Adoption is built from. created_at is set by the default. */
const WRITTEN_COLUMNS = `
  number, tier_id, trees, names, customer_name, email, status, season,
  stripe_session_id, stripe_customer_id, stripe_subscription_id,
  renews_at, cancel_at_period_end, renewal_invoices, gift_from, gift_message
`;
const ADOPTION_COLUMNS = `${WRITTEN_COLUMNS}, created_at`;

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length ? value : undefined;
}

function iso(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? new Date(value).toISOString() : undefined;
}

function toAdoption(row: Row): Adoption {
  const adoption: Adoption = {
    number: String(row.number),
    tierId: String(row.tier_id),
    trees: (row.trees as string[] | null) ?? [],
    names: (row.names as Record<string, string> | null) ?? {},
    customerName: String(row.customer_name),
    email: String(row.email),
    status: row.status as AdoptionStatus,
    season: Number(row.season),
    createdAt: iso(row.created_at) ?? new Date(0).toISOString(),
  };
  // Left off entirely when absent, so the shape matches what the pages expect
  // of an optional field rather than carrying nulls around.
  const stripeSessionId = text(row.stripe_session_id);
  if (stripeSessionId) adoption.stripeSessionId = stripeSessionId;
  const stripeCustomerId = text(row.stripe_customer_id);
  if (stripeCustomerId) adoption.stripeCustomerId = stripeCustomerId;
  const stripeSubscriptionId = text(row.stripe_subscription_id);
  if (stripeSubscriptionId) adoption.stripeSubscriptionId = stripeSubscriptionId;
  const renewsAt = iso(row.renews_at);
  if (renewsAt) adoption.renewsAt = renewsAt;
  if (typeof row.cancel_at_period_end === "boolean") {
    adoption.cancelAtPeriodEnd = row.cancel_at_period_end;
  }
  const invoices = row.renewal_invoices as string[] | null;
  if (invoices?.length) adoption.renewalInvoices = invoices;
  const giftFrom = text(row.gift_from);
  if (giftFrom) adoption.giftFrom = giftFrom;
  const giftMessage = text(row.gift_message);
  if (giftMessage) adoption.giftMessage = giftMessage;
  return adoption;
}

/**
 * Hands back the trees of unpaid checkouts that have run out of time.
 *
 * Runs inside the reservation transaction, so the trees a lapsed hold was
 * sitting on become available to the customer asking for them right now.
 */
async function releaseLapsedHolds(sql: Sql): Promise<void> {
  await sql.query(
    `delete from adoption_holds h
       using adoptions a
      where a.number = h.adoption_number
        and a.status = 'pending'
        and a.created_at <= now() - make_interval(secs => $1)`,
    [HOLD_SECONDS],
  );
  await sql.query(
    `update adoptions
        set status = 'cancelled'
      where status = 'pending'
        and created_at <= now() - make_interval(secs => $1)`,
    [HOLD_SECONDS],
  );
}

/**
 * Records an adoption and takes its trees off the market in one transaction.
 * Throws TreesTakenError if another adoption holds any of them.
 */
export async function createAdoption(
  input: Omit<Adoption, "number" | "createdAt" | "season" | "status"> & {
    status?: AdoptionStatus;
  },
): Promise<Adoption> {
  const driver = await db();
  return driver.transaction(async (sql) => {
    await releaseLapsedHolds(sql);

    const clash = await sql.query<{ tree_id: string }>(
      `select tree_id from adoption_holds where tree_id = any($1::text[])`,
      [input.trees],
    );
    if (clash.rows.length) {
      throw new TreesTakenError(clash.rows.map((r) => r.tree_id));
    }

    const created = await sql.query(
      `insert into adoptions (${WRITTEN_COLUMNS})
       values (
         'FEN-' || $1::int || '-' || lpad(nextval('adoption_number_seq')::text, 4, '0'),
         $2, $3::text[], $4::jsonb, $5, $6, $7, $1::int,
         $8, $9, $10, $11::timestamptz, $12::boolean,
         coalesce($13::text[], '{}'::text[]), $14, $15
       )
       returning ${ADOPTION_COLUMNS}`,
      [
        SEASON,
        input.tierId,
        input.trees,
        JSON.stringify(input.names ?? {}),
        input.customerName,
        input.email,
        input.status ?? "pending",
        input.stripeSessionId ?? null,
        input.stripeCustomerId ?? null,
        input.stripeSubscriptionId ?? null,
        input.renewsAt ?? null,
        input.cancelAtPeriodEnd ?? null,
        input.renewalInvoices ?? null,
        input.giftFrom ?? null,
        input.giftMessage ?? null,
      ],
    );
    const adoption = toAdoption(created.rows[0]);

    try {
      await sql.query(
        `insert into adoption_holds (tree_id, adoption_number)
         select unnest($1::text[]), $2`,
        [input.trees, adoption.number],
      );
    } catch (e) {
      // Another checkout won the race between the check above and here. The
      // primary key on tree_id is what caught it; say which trees went.
      if ((e as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new TreesTakenError(input.trees);
      }
      throw e;
    }

    return adoption;
  });
}

export async function getAdoption(number: string): Promise<Adoption | null> {
  const driver = await db();
  const { rows } = await driver.query(
    `select ${ADOPTION_COLUMNS} from adoptions where upper(number) = upper($1)`,
    [number.trim()],
  );
  return rows[0] ? toAdoption(rows[0]) : null;
}

export async function getAdoptionBySession(
  sessionId: string,
): Promise<Adoption | null> {
  const driver = await db();
  const { rows } = await driver.query(
    `select ${ADOPTION_COLUMNS} from adoptions where stripe_session_id = $1`,
    [sessionId],
  );
  return rows[0] ? toAdoption(rows[0]) : null;
}

/** Marks a paid checkout's adoption active and records its subscription. */
export async function activateAdoption(
  sessionId: string,
  billing: Billing = {},
): Promise<Adoption | null> {
  const driver = await db();
  const { rows } = await driver.query(
    `update adoptions
        set status = 'active',
            stripe_customer_id = coalesce($2, stripe_customer_id),
            stripe_subscription_id = coalesce($3, stripe_subscription_id),
            renews_at = coalesce($4::timestamptz, renews_at),
            cancel_at_period_end = coalesce($5::boolean, cancel_at_period_end)
      where stripe_session_id = $1
      returning ${ADOPTION_COLUMNS}`,
    [
      sessionId,
      billing.stripeCustomerId ?? null,
      billing.stripeSubscriptionId ?? null,
      billing.renewsAt ?? null,
      billing.cancelAtPeriodEnd ?? null,
    ],
  );
  return rows[0] ? toAdoption(rows[0]) : null;
}

/**
 * A checkout that expired unpaid. Its adoption was holding trees; releasing
 * them lets someone else adopt. An adoption that was paid is left alone.
 */
export async function expireAdoption(sessionId: string): Promise<void> {
  const driver = await db();
  await driver.transaction(async (sql) => {
    const { rows } = await sql.query<{ number: string }>(
      `update adoptions set status = 'cancelled'
        where stripe_session_id = $1 and status = 'pending'
        returning number`,
      [sessionId],
    );
    if (!rows[0]) return;
    await sql.query(`delete from adoption_holds where adoption_number = $1`, [
      rows[0].number,
    ]);
  });
}

/**
 * Keeps an adoption in step with its subscription: the next renewal date,
 * whether the customer has cancelled, and the end of the adoption when the
 * subscription itself ends, which also returns its trees to the map.
 */
export async function syncSubscription(
  subscriptionId: string,
  update: Billing & { ended?: boolean },
): Promise<void> {
  const driver = await db();
  await driver.transaction(async (sql) => {
    const { rows } = await sql.query<{ number: string }>(
      `update adoptions
          set stripe_customer_id = coalesce($2, stripe_customer_id),
              renews_at = coalesce($3::timestamptz, renews_at),
              cancel_at_period_end = coalesce($4::boolean, cancel_at_period_end),
              status = case when $5::boolean then 'cancelled' else status end
        where stripe_subscription_id = $1
        returning number`,
      [
        subscriptionId,
        update.stripeCustomerId ?? null,
        update.renewsAt ?? null,
        update.cancelAtPeriodEnd ?? null,
        update.ended ?? false,
      ],
    );
    if (!rows[0] || !update.ended) return;
    await sql.query(`delete from adoption_holds where adoption_number = $1`, [
      rows[0].number,
    ]);
  });
}

/**
 * A yearly renewal was paid: the adoption moves on to the next season.
 *
 * The invoice guard is in the statement itself, so a webhook Stripe retries
 * cannot advance the season twice however many instances receive it.
 */
export async function recordRenewal(
  subscriptionId: string,
  invoiceId: string,
): Promise<void> {
  const driver = await db();
  await driver.query(
    `update adoptions
        set renewal_invoices = renewal_invoices || $2::text,
            season = season + 1,
            status = 'active'
      where stripe_subscription_id = $1
        and not (renewal_invoices @> array[$2]::text[])`,
    [subscriptionId, invoiceId],
  );
}

/** Tree and spot ids already spoken for, so the maps can grey them out. */
export async function takenTreeIds(): Promise<string[]> {
  const driver = await db();
  const { rows } = await driver.query<{ tree_id: string }>(
    `select h.tree_id
       from adoption_holds h
       join adoptions a on a.number = h.adoption_number
      where a.status <> 'cancelled'
        and (a.status <> 'pending'
             or a.created_at > now() - make_interval(secs => $1))`,
    [HOLD_SECONDS],
  );
  return rows.map((r) => r.tree_id);
}

/**
 * Which trees are spoken for, and how firmly.
 *
 * Two different things, and the map should not pretend otherwise. A tree is
 * `adopted` when someone has paid for it and it is gone for the season. It is
 * `reserved` when someone is in checkout with it right now: a hold that
 * lapses on its own if they do not finish, so it may well come back.
 */
export type TreeHolds = { adopted: string[]; reserved: string[] };

export async function treeHolds(): Promise<TreeHolds> {
  const driver = await db();
  const { rows } = await driver.query<{ tree_id: string; paid: boolean }>(
    `select h.tree_id, (a.status = 'active') as paid
       from adoption_holds h
       join adoptions a on a.number = h.adoption_number
      where a.status <> 'cancelled'
        and (a.status <> 'pending'
             or a.created_at > now() - make_interval(secs => $1))`,
    [HOLD_SECONDS],
  );
  return {
    adopted: rows.filter((r) => r.paid).map((r) => r.tree_id),
    reserved: rows.filter((r) => !r.paid).map((r) => r.tree_id),
  };
}

/**
 * As treeHolds, but an outage leaves the map drawn rather than broken.
 *
 * For the pages that only draw the map. Nothing is sold on the strength of
 * this list: createAdoption re-checks every tree inside its own transaction,
 * so the worst case is a tree that looks free until someone tries to buy it.
 */
export async function treeHoldsForDisplay(): Promise<TreeHolds> {
  try {
    return await treeHolds();
  } catch (e) {
    console.error("Could not read adoption holds:", e);
    return { adopted: [], reserved: [] };
  }
}

/** Lookup for the account page: adoption number plus matching email. */
export async function findForCustomer(
  number: string,
  email: string,
): Promise<Adoption | null> {
  const driver = await db();
  const { rows } = await driver.query(
    `select ${ADOPTION_COLUMNS} from adoptions
      where upper(number) = upper($1) and lower(email) = lower($2)`,
    [number.trim(), email.trim()],
  );
  return rows[0] ? toAdoption(rows[0]) : null;
}
