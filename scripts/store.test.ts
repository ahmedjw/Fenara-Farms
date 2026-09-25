/**
 * Store tests.
 *
 * Runs the real schema and the real statements against Postgres compiled to
 * WebAssembly, so no server is needed and the SQL is genuinely exercised
 * rather than mocked.
 *
 *   npm test
 */

import { PGlite } from "@electric-sql/pglite";
import { configure, SCHEMA, type Driver, type Row } from "../src/lib/db";
import {
  activateAdoption,
  createAdoption,
  expireAdoption,
  findForCustomer,
  getAdoption,
  getAdoptionBySession,
  PENDING_HOLD_MS,
  recordRenewal,
  syncSubscription,
  takenTreeIds,
  treeHolds,
  TreesTakenError,
} from "../src/lib/store";

let failures = 0;
let checks = 0;

function ok(condition: boolean, what: string) {
  checks++;
  if (condition) {
    console.log(`  ✓ ${what}`);
  } else {
    failures++;
    console.log(`  ✗ ${what}`);
  }
}

function eq(actual: unknown, expected: unknown, what: string) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  ok(a === b, `${what}${a === b ? "" : `  (got ${a}, wanted ${b})`}`);
}

async function main() {
  const pg = await PGlite.create();
  let queue: Promise<unknown> = Promise.resolve();

  const driver: Driver = {
    query: <R extends Row = Row>(text: string, params?: unknown[]) =>
      pg.query<R>(text, params as unknown[]) as Promise<{ rows: R[] }>,
    exec: async (text) => {
      await pg.exec(text);
    },
    // PGlite is one connection, so overlapping BEGINs would collide where a
    // real pool hands each transaction its own. Queue them instead. The
    // guarantee that matters under genuine concurrency is the primary key on
    // adoption_holds, asserted directly below.
    transaction: async (fn) => {
      const run = async () => {
        await pg.exec("begin");
        try {
          const result = await fn(driver);
          await pg.exec("commit");
          return result;
        } catch (e) {
          await pg.exec("rollback");
          throw e;
        }
      };
      const next = queue.then(run, run);
      queue = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
  };
  configure(driver);
  await pg.exec(SCHEMA);

  const base = {
    tierId: "mi-olivo",
    customerName: "Marisol Aguirre",
    email: "Marisol@Example.com",
    names: {},
  };

  console.log("\nrecording an adoption");
  const first = await createAdoption({
    ...base,
    trees: ["A-R46-C51"],
    names: { "A-R46-C51": "Abuela" },
    stripeSessionId: "cs_one",
    giftFrom: "The family",
  });
  eq(first.number, "FEN-2026-0001", "gets the first adoption number");
  eq(first.status, "pending", "starts pending");
  eq(first.trees, ["A-R46-C51"], "keeps its trees");
  eq(first.names, { "A-R46-C51": "Abuela" }, "keeps the names given");
  eq(first.giftFrom, "The family", "keeps the gift sender");
  ok(!("renewsAt" in first), "leaves unset fields off rather than null");
  eq(await takenTreeIds(), ["A-R46-C51"], "the tree is now spoken for");

  const second = await createAdoption({
    ...base,
    trees: ["A-R46-C52"],
    stripeSessionId: "cs_two",
  });
  eq(second.number, "FEN-2026-0002", "numbers keep counting");

  console.log("\nthe same tree cannot be sold twice");
  let taken: unknown = null;
  try {
    await createAdoption({ ...base, trees: ["A-R46-C51"], stripeSessionId: "cs_three" });
  } catch (e) {
    taken = e;
  }
  ok(taken instanceof TreesTakenError, "refuses a tree another adoption holds");
  eq((taken as TreesTakenError).ids, ["A-R46-C51"], "names the tree that clashed");
  const after = await getAdoptionBySession("cs_three");
  ok(after === null, "and writes nothing: the transaction rolled back");

  console.log("\nconcurrent checkouts for one tree");
  const racers = await Promise.allSettled(
    ["cs_r1", "cs_r2", "cs_r3"].map((id) =>
      createAdoption({ ...base, trees: ["A-R47-C50"], stripeSessionId: id }),
    ),
  );
  eq(
    racers.filter((r) => r.status === "fulfilled").length,
    1,
    "exactly one of three wins",
  );
  ok(
    racers
      .filter((r) => r.status === "rejected")
      .every((r) => (r as PromiseRejectedResult).reason instanceof TreesTakenError),
    "the losers are told the tree was taken",
  );

  // What makes that safe when three checkouts land on three instances at the
  // same moment, where nothing can queue them: the database refuses the second
  // hold outright, and createAdoption turns that into TreesTakenError.
  let violation: { code?: string } = {};
  try {
    await pg.query(
      `insert into adoption_holds (tree_id, adoption_number) values ($1, $2)`,
      ["A-R47-C50", "FEN-2026-0001"],
    );
  } catch (e) {
    violation = e as { code?: string };
  }
  eq(
    violation.code,
    "23505",
    "the database itself refuses a second hold on one tree",
  );

  console.log("\npaying");
  const activated = await activateAdoption("cs_one", {
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
    renewsAt: "2027-09-25T00:00:00.000Z",
    cancelAtPeriodEnd: false,
  });
  eq(activated?.status, "active", "the adoption goes active");
  eq(activated?.stripeSubscriptionId, "sub_1", "records the subscription");
  eq(activated?.renewsAt, "2027-09-25T00:00:00.000Z", "records the renewal date");
  eq(activated?.cancelAtPeriodEnd, false, "false is stored, not skipped as empty");

  const untouched = await activateAdoption("cs_one", {});
  eq(untouched?.stripeSubscriptionId, "sub_1", "an empty update keeps what was there");

  console.log("\ntelling paid from merely held");
  const split = await treeHolds();
  eq(split.adopted, ["A-R46-C51"], "a paid tree is adopted");
  ok(
    split.reserved.includes("A-R46-C52") && split.reserved.includes("A-R47-C50"),
    "an unfinished checkout's trees are on hold, not adopted",
  );
  ok(
    !split.reserved.includes("A-R46-C51"),
    "and a tree is never both at once",
  );

  console.log("\nan unpaid checkout that lapses");
  await pg.query(
    `update adoptions set created_at = now() - make_interval(secs => $1)
      where stripe_session_id = 'cs_two'`,
    [PENDING_HOLD_MS / 1000 + 60],
  );
  ok(
    !(await takenTreeIds()).includes("A-R46-C52"),
    "its tree stops counting as taken once the hold lapses",
  );
  const reused = await createAdoption({
    ...base,
    trees: ["A-R46-C52"],
    stripeSessionId: "cs_four",
  });
  ok(Boolean(reused.number), "and someone else can adopt it");
  eq(
    (await getAdoption("FEN-2026-0002"))?.status,
    "cancelled",
    "the lapsed adoption is marked cancelled, not left pending forever",
  );

  console.log("\na paid adoption is never released by time");
  await pg.query(
    `update adoptions set created_at = now() - make_interval(secs => $1)
      where stripe_session_id = 'cs_one'`,
    [PENDING_HOLD_MS / 1000 + 86_400],
  );
  ok(
    (await takenTreeIds()).includes("A-R46-C51"),
    "an active adoption keeps its tree however old it is",
  );

  console.log("\nexpiring and cancelling");
  await expireAdoption("cs_four");
  ok(!(await takenTreeIds()).includes("A-R46-C52"), "expiry hands the tree back");
  await expireAdoption("cs_one");
  ok(
    (await takenTreeIds()).includes("A-R46-C51"),
    "expiry leaves a paid adoption alone",
  );

  await syncSubscription("sub_1", { renewsAt: "2028-01-01T00:00:00.000Z" });
  eq(
    (await getAdoption("FEN-2026-0001"))?.renewsAt,
    "2028-01-01T00:00:00.000Z",
    "a subscription update moves the renewal date",
  );
  await syncSubscription("sub_1", { ended: true });
  eq(
    (await getAdoption("FEN-2026-0001"))?.status,
    "cancelled",
    "a subscription that ends cancels the adoption",
  );
  ok(
    !(await takenTreeIds()).includes("A-R46-C51"),
    "and returns its tree to the map",
  );
  eq(
    (await getAdoption("FEN-2026-0001"))?.trees,
    ["A-R46-C51"],
    "while the record still says what it covered",
  );

  console.log("\nrenewals");
  const renewing = await createAdoption({
    ...base,
    trees: ["A-R47-C51"],
    stripeSessionId: "cs_five",
  });
  await activateAdoption("cs_five", { stripeSubscriptionId: "sub_5" });
  await recordRenewal("sub_5", "in_1");
  eq((await getAdoption(renewing.number))?.season, 2027, "a renewal moves the season on");
  await recordRenewal("sub_5", "in_1");
  eq(
    (await getAdoption(renewing.number))?.season,
    2027,
    "the same invoice twice does not count twice",
  );
  await recordRenewal("sub_5", "in_2");
  eq((await getAdoption(renewing.number))?.season, 2028, "a new invoice does");

  console.log("\nlooking an adoption up");
  eq(
    (
      await findForCustomer(
        `  ${renewing.number.toLowerCase()} `,
        "  MARISOL@example.com ",
      )
    )?.number,
    renewing.number,
    "number and email match whatever the case or spacing",
  );
  ok(
    (await findForCustomer(renewing.number, "someone@else.com")) === null,
    "the wrong email finds nothing",
  );

  console.log(`\n${checks - failures}/${checks} passed`);
  if (failures) process.exitCode = 1;
  await pg.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
