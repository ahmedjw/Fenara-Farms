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
import { buildReport, toCsv } from "../src/lib/admin";
import { newSession, passwordMatches, sessionValid } from "../src/lib/admin-auth";
import { configure, SCHEMA, type Driver, type Row } from "../src/lib/db";
import {
  activateAdoption,
  claimConfirmationEmail,
  createAdoption,
  expireAdoption,
  findForCustomer,
  getAdoption,
  getAdoptionBySession,
  listAdoptions,
  listHolds,
  PENDING_HOLD_MS,
  recordRenewal,
  releaseConfirmationEmail,
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

  console.log("\nwhere the oil goes");
  const posted = await activateAdoption(
    "cs_one",
    {},
    {
      name: "Marisol Aguirre",
      phone: "+34 600 123 456",
      line1: "Calle Mayor 14",
      city: "Setenil de las Bodegas",
      postalCode: "11692",
      country: "ES",
    },
  );
  eq(posted?.delivery?.phone, "+34 600 123 456", "a phone number is kept");
  eq(posted?.delivery?.line1, "Calle Mayor 14", "and the address with it");
  const keptAddress = await activateAdoption("cs_one", {});
  eq(
    keptAddress?.delivery?.line1,
    "Calle Mayor 14",
    "a later update carrying no address does not wipe it",
  );

  console.log("\nthe confirmation email, exactly once");
  ok(await claimConfirmationEmail("FEN-2026-0001"), "the first caller may send");
  ok(
    !(await claimConfirmationEmail("FEN-2026-0001")),
    "and the second is told not to",
  );
  ok(
    Boolean((await getAdoption("FEN-2026-0001"))?.confirmationSentAt),
    "the adoption records that it went",
  );
  await releaseConfirmationEmail("FEN-2026-0001");
  ok(
    await claimConfirmationEmail("FEN-2026-0001"),
    "a failed send can be claimed again, so nobody is left without one",
  );

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

  console.log("\nthe admin dashboard");
  // LN-005 was marked not available after this adoption was taken.
  const stranded = await createAdoption({
    ...base,
    trees: ["A-R46-C55"],
    stripeSessionId: "cs_six",
  });
  await activateAdoption("cs_six", { stripeSubscriptionId: "sub_6" }, {
    line1: "Calle Real 2",
    city: "Ronda",
    country: "ES",
  });
  await claimConfirmationEmail(stranded.number);

  const all = await listAdoptions();
  eq(all.length, (await pg.query("select 1 from adoptions")).rows.length, "lists every adoption");
  eq(all[0].number, stranded.number, "newest first");

  const holds = await listHolds();
  ok(
    holds.some((h) => h.treeId === "A-R47-C51" && h.adoptionNumber === renewing.number && h.paid),
    "says whose hold each tree is",
  );

  const now = Date.parse("2027-01-01T00:00:00Z");
  const report = buildReport(all, holds, now);
  const one = 12900 + 3500;
  const row = (n: string) => report.adoptions.find((r) => r.number === n)!;
  eq(row("FEN-2026-0001").payments, 1, "an ended subscription still counts its payment");
  eq(row("FEN-2026-0002").payments, 0, "a checkout that lapsed was never paid");
  eq(row(renewing.number).payments, 3, "a purchase and two renewals are three payments");
  eq(row(renewing.number).collected, 3 * one, "each at the tier price plus shipping");
  eq(report.totals.collected, 5 * one, "collected adds up every paid adoption");
  eq(report.totals.renewals, 2 * one, "and splits out renewals");
  eq(report.totals.yearly, 2 * one, "yearly counts only active adoptions that will renew");
  eq(report.totals.customers, 1, "one customer however many adoptions");
  ok(
    row(renewing.number).flags.some((f) => f.text === "No delivery address"),
    "an active adoption with no address is flagged",
  );
  ok(
    row(renewing.number).flags.some((f) => f.text === "Confirmation email not sent"),
    "and one whose confirmation never went",
  );
  ok(
    row(stranded.number).flags.some((f) => f.text === "LN-005 no longer available"),
    "an adoption on a tree that is gone is flagged by its tree number",
  );
  eq(
    report.attention.map((r) => r.number).sort(),
    [renewing.number, stranded.number].sort(),
    "both land in needs attention",
  );
  const ln005 = report.trees.find((t) => t.id === "LN-005");
  eq(ln005?.status, "unavailable", "the tree list shows it as not available");
  eq(ln005?.adoptionNumber, stranded.number, "while still naming who holds it");
  eq(
    report.treeTotals.adopted + report.treeTotals.available +
      report.treeTotals.reserved + report.treeTotals.unavailable,
    report.trees.length,
    "every tree is counted exactly once",
  );

  const csv = toCsv([["=HYPERLINK(1)", "+34 600 123 456", 'say "hi"']]);
  ok(csv.includes(`"'=HYPERLINK(1)"`), "a formula typed by a customer is defused in CSV");
  ok(csv.includes(`"+34 600 123 456"`), "a phone number is left as it is");
  ok(csv.includes(`"say ""hi"""`), "quotes are escaped");

  console.log("\nadmin sign-in");
  delete process.env.ADMIN_PASSWORD;
  ok(!passwordMatches(""), "with no password set, nothing signs in");
  ok(newSession() === null, "and no session can be made");
  process.env.ADMIN_PASSWORD = "olive grove";
  ok(passwordMatches("olive grove"), "the right password signs in");
  ok(!passwordMatches("olive"), "a wrong one does not");
  const session = newSession()!;
  ok(sessionValid(session.token), "a fresh session is valid");
  ok(!sessionValid(session.token.replace(/.$/, "0")), "a tampered one is not");
  const [, sig] = session.token.split(".");
  ok(!sessionValid(`${Date.now() + 9e12}.${sig}`), "nor one with its expiry pushed out");
  process.env.ADMIN_PASSWORD = "a new password";
  ok(!sessionValid(session.token), "changing the password signs everyone out");

  console.log(`\n${checks - failures}/${checks} passed`);
  if (failures) process.exitCode = 1;
  await pg.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
