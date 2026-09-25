/**
 * Picking a tree, in a real browser.
 *
 * The map is the one part of this site that cannot be checked by reading the
 * markup: everything that matters happens on hydration, under a finger, at a
 * screen size. Reasoning about it was not enough — the first version of the
 * nearest-tree overlay looked perfect in the HTML and did nothing at all,
 * because a stale .next manifest meant React never hydrated. This catches
 * both kinds of failure.
 *
 *   npm run dev:db                                    # one terminal
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres \
 *     npm run build && npm start                      # another
 *   npm run test:e2e                                  # a third
 *
 * Point it elsewhere with E2E_URL.
 */

import { chromium, devices, type BrowserContextOptions } from "playwright";

const BASE = process.env.E2E_URL ?? "http://localhost:3000";

let failures = 0;
function ok(condition: boolean, what: string, extra = "") {
  if (!condition) failures++;
  console.log(`  ${condition ? "✓" : "✗"} ${what}${extra ? `  ${extra}` : ""}`);
}

type Case = BrowserContextOptions & { isMobile?: boolean; hasTouch?: boolean };

async function run(label: string, opts: Case) {
  console.log(`\n${label}`);
  const browser = await chromium.launch();
  const context = await browser.newContext(opts);
  const page = await context.newPage();

  const broken: string[] = [];
  page.on("response", (r) => {
    if (r.status() >= 400) broken.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  page.on("pageerror", (e) => broken.push(`page error: ${String(e).slice(0, 120)}`));

  await page.goto(`${BASE}/adopt/mi-olivo`, { waitUntil: "networkidle" });
  const map = page.locator("svg[role=group]");
  await map.scrollIntoViewIfNeeded();
  const box = (await map.boundingBox())!;
  console.log(`  map is ${Math.round(box.width)}x${Math.round(box.height)} CSS px`);

  // React has to be running for any of this to mean anything. The filter
  // chips are pure client state, so they are the cheapest proof of it.
  const before = await map.locator("circle").count();
  await page.getByRole("button", { name: "Available", exact: true }).click();
  await page.waitForTimeout(300);
  ok((await map.locator("circle").count()) !== before, "the page has hydrated");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.waitForTimeout(300);

  // The counter and the live-region announcement share their text.
  const chosen = async () => {
    const t = await page.getByText(/\d+ of 1 chosen/).first().innerText();
    return Number(t.match(/(\d+) of 1 chosen/)![1]);
  };
  ok((await chosen()) === 0, "starts with nothing chosen");

  // The middle of the map, aimed at no dot in particular. The whole point of
  // the nearest-tree overlay is that it does not have to be.
  const tap = async (position: { x: number; y: number }) =>
    opts.hasTouch ? map.tap({ position }) : map.click({ position });
  await tap({ x: box.width / 2, y: box.height / 2 });
  await page.waitForTimeout(400);
  ok((await chosen()) === 1, "one tap in open space picks the nearest tree");

  const bar = page.locator("div.lg\\:hidden").filter({ hasText: /LN-\d+/ }).first();
  const barShown = await bar.isVisible().catch(() => false);

  if (opts.isMobile) {
    ok(barShown, "the bar under the map names the tree you got");
    const onScreen = await bar.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
    });
    ok(onScreen, "and it is on screen, not below the fold");

    const from = (await bar.innerText()).match(/LN-\d+/)![0];
    await page.getByLabel("Next tree").click();
    await page.waitForTimeout(250);
    const to = (await bar.innerText()).match(/LN-\d+/)![0];
    ok(to !== from, "the arrows step one tree along the planting", `${from} → ${to}`);

    await page.getByRole("button", { name: /^Choose$/ }).click();
    await page.waitForTimeout(250);
    const said = await page.getByText(/Chose tree LN-\d+/).last().innerText();
    ok((await chosen()) === 1 && said.includes(to), "Choose commits that one", said.trim());
  } else {
    ok(!barShown, "the bar stays out of the way on a desktop layout");
  }

  // A tree someone has already paid for must not be selectable, and the map
  // must say why. LN-001 is seeded as adopted, LN-002 as on hold.
  //
  // Counting is not enough to prove this: at a limit of one, taking a
  // different tree replaces the first and the count never moves. Read which
  // trees the map itself calls a pick.
  const picks = async () =>
    (
      await page.$$eval('[aria-label*="your pick"]', (els) =>
        els.map((e) => (e.getAttribute("aria-label") ?? "").split(",")[0]),
      )
    )
      .sort()
      .join(",");
  const wasPicked = await picks();

  for (const [id, word] of [
    ["LN-001", "adopted"],
    ["LN-002", "on hold"],
  ] as const) {
    const locked = page.locator(`[aria-label^="Tree ${id},"]`).first();
    const label = await locked.getAttribute("aria-label");
    ok(label?.includes(word) ?? false, `${id} reads as ${word}`, label ?? "missing");
    const spot = await locked.boundingBox();
    if (!spot) continue;
    await tap({
      x: spot.x + spot.width / 2 - box.x,
      y: spot.y + spot.height / 2 - box.y,
    });
    await page.waitForTimeout(300);
    ok((await picks()) === wasPicked, `tapping ${id} does not take it`, `picks: ${await picks()}`);
    // Opening it to read why is fine, and is what should happen instead.
    if (opts.isMobile) {
      ok(
        (await bar.innerText()).includes(id),
        `but it does open ${id} so you can see why`,
      );
    }
  }
  const held = await chosen();

  // Empty ground must not grab a tree from across the estate.
  await map.click({ position: { x: 6, y: 6 } });
  await page.waitForTimeout(300);
  ok((await chosen()) === held, "tapping empty ground changes nothing");

  ok(broken.length === 0, "no failed requests or page errors", broken.join(", "));
  await browser.close();
}

async function main() {
  await run("iPhone 13, touch", {
    ...devices["iPhone 13"],
    isMobile: true,
    hasTouch: true,
  });
  await run("Desktop, mouse", {
    viewport: { width: 1280, height: 900 },
    hasTouch: false,
    isMobile: false,
  });
  console.log(failures ? `\n${failures} failed` : "\nall passed");
  process.exitCode = failures ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
