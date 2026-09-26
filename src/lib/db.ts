/**
 * Postgres connection.
 *
 * Adoptions used to live in a JSON file on disk. That worked locally and lost
 * a paid order in production: the deployment's filesystem is not shared
 * between instances and does not survive a cold start, so the record written
 * during checkout was gone by the time Stripe redirected the customer back.
 * Everything durable now goes through here.
 *
 * `DATABASE_URL` is the only setting. Anything that speaks Postgres will do:
 * Replit's built-in database, Neon, Supabase, or a server you run yourself.
 * There is deliberately no fallback to local storage. A store that quietly
 * works and then loses an order is worse than one that refuses to start.
 */

import { Pool, type PoolConfig } from "pg";

export type Row = Record<string, unknown>;

/** Anything that can run a parameterised statement. */
export type Sql = {
  query<R extends Row = Row>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: R[] }>;
};

export type Driver = Sql & {
  /** Runs a script of several statements. No parameters. */
  exec(text: string): Promise<void>;
  /** Runs `fn` inside a transaction, rolling back if it throws. */
  transaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T>;
};

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set, so adoptions cannot be read or recorded. Add a Postgres connection string to the environment this site runs in.",
    );
    this.name = "StorageNotConfiguredError";
  }
}

/**
 * Hosted Postgres almost always wants TLS, and almost never presents a
 * certificate chain Node trusts out of the box. Verify when the operator asks
 * for it with `PGSSLMODE=verify-full`, skip TLS entirely for a local server,
 * and otherwise encrypt without verifying, which is what the connection
 * strings these providers hand out assume.
 */
function sslFor(url: string): PoolConfig["ssl"] {
  const mode = process.env.PGSSLMODE?.trim();
  if (mode === "disable") return undefined;
  if (mode === "verify-full") return { rejectUnauthorized: true };
  try {
    const { hostname } = new URL(url);
    if (hostname === "localhost" || hostname === "127.0.0.1") return undefined;
  } catch {
    // Not a URL we can parse; let pg deal with it and keep TLS on.
  }
  return { rejectUnauthorized: false };
}

function poolDriver(url: string): Driver {
  const pool = new Pool({
    connectionString: url,
    ssl: sslFor(url),
    // Serverless hosts run many short-lived instances, so a big pool per
    // instance just exhausts the server's connection limit.
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  // A dropped idle connection must not take the process down with it.
  pool.on("error", () => undefined);

  return {
    query: (text, params) =>
      pool.query(text, params as never[]) as never,
    exec: async (text) => {
      await pool.query(text);
    },
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn({
          query: (text, params) => client.query(text, params as never[]) as never,
        });
        await client.query("commit");
        return result;
      } catch (e) {
        await client.query("rollback").catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

/**
 * The schema, created on first use.
 *
 * `adoptions.trees` is the permanent record of what an adoption covers and
 * stays put when it is cancelled. `adoption_holds` is the separate, much
 * smaller question of which trees are spoken for right now, and its primary
 * key on tree_id is what actually stops the same tree being sold twice: two
 * checkouts racing for one tree cannot both insert, whichever instances they
 * land on.
 */
const SCHEMA = `
create table if not exists adoptions (
  number                 text primary key,
  tier_id                text not null,
  trees                  text[] not null,
  names                  jsonb not null default '{}'::jsonb,
  customer_name          text not null,
  email                  text not null,
  status                 text not null check (status in ('pending', 'active', 'cancelled')),
  season                 integer not null,
  stripe_session_id      text unique,
  stripe_customer_id     text,
  stripe_subscription_id text,
  renews_at              timestamptz,
  cancel_at_period_end   boolean,
  renewal_invoices       text[] not null default '{}',
  created_at             timestamptz not null default now(),
  gift_from              text,
  gift_message           text
);

create table if not exists adoption_holds (
  tree_id         text primary key,
  adoption_number text not null references adoptions (number) on delete cascade
);

create index if not exists adoption_holds_number_idx
  on adoption_holds (adoption_number);
create index if not exists adoptions_subscription_idx
  on adoptions (stripe_subscription_id);
create index if not exists adoptions_email_idx
  on adoptions (lower(email));

create sequence if not exists adoption_number_seq;

-- Added after the first adoptions were taken. "add column if not exists" is
-- idempotent, so this doubles as the migration for a database that already
-- has the table: it runs on every boot and does nothing once applied.
alter table adoptions add column if not exists delivery jsonb;
alter table adoptions add column if not exists confirmation_sent_at timestamptz;
`;

let configured: Driver | null = null;
let schemaReady: Promise<void> | null = null;

/**
 * Point the store at a driver of your own. Used by the tests, which run the
 * real schema against an in-process Postgres, and by the recovery script.
 */
export function configure(driver: Driver | null): void {
  configured = driver;
  schemaReady = null;
}

export function storageConfigured(): boolean {
  return Boolean(configured ?? process.env.DATABASE_URL?.trim());
}

/** The driver, with the schema guaranteed to exist. */
export async function db(): Promise<Driver> {
  if (!configured) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) throw new StorageNotConfiguredError();
    configured = poolDriver(url);
  }
  const driver = configured;
  if (!schemaReady) {
    schemaReady = driver.exec(SCHEMA).catch((e: unknown) => {
      // Let the next call try again rather than caching the failure forever.
      schemaReady = null;
      throw e;
    });
  }
  await schemaReady;
  return driver;
}

export { SCHEMA };
