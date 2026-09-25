# Fenara Farms

Adopt an olive tree in Andalusia. Marketing site plus the full adoption flow,
from picking a tree off the grove plan through to a paid Stripe checkout and a
printable certificate.

Built with Next.js 15 (App Router), TypeScript, Tailwind v4 and Motion.

---

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000

---

## Connecting Stripe

The site runs without Stripe keys. Everything works up to the final step of the
adoption flow, where it tells you payments are not connected yet. To take real
payments:

1. Create a Stripe account and open the **test mode** API keys page:
   https://dashboard.stripe.com/test/apikeys

2. Open `.env.local` and paste in the two keys:

   ```
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

3. Forward webhooks to your machine, in a second terminal:

   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

   That prints a signing secret starting `whsec_`. Put it in `.env.local`:

   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

4. Restart `npm run dev`.

Test card `4242 4242 4242 4242`, any future expiry, any CVC.

### Yearly renewals

Adoptions are yearly Stripe subscriptions: checkout charges the plan price and
Stripe charges it again on each anniversary until the adopter cancels. Three
settings in the Stripe dashboard make that work the way the site describes it:

1. **Customer portal** (Settings > Billing > Customer portal). Allow customers
   to cancel subscriptions, at the end of the billing period, and save. Copy the
   login link into `NEXT_PUBLIC_STRIPE_PORTAL_URL`. The account page links to
   it as "Manage or cancel renewal"; adopters confirm their email there with a
   one-time code.
2. **Renewal reminders** (Settings > Billing > Subscriptions and emails). Turn
   on emails about upcoming renewals. The FAQ and terms promise adopters
   notice before each renewal.
3. **Webhook events.** Send `checkout.session.completed`,
   `checkout.session.expired`, `invoice.paid`, `customer.subscription.updated`
   and `customer.subscription.deleted` to the endpoint. They record renewals,
   cancellations and endings, and release the spots of checkouts that expire
   unpaid.

### Going live

Swap the test keys for live keys, add a webhook endpoint in the Stripe
dashboard pointing at `https://yourdomain.com/api/stripe/webhook` with the
events above, repeat the customer portal and renewal email settings in live
mode, and set `NEXT_PUBLIC_SITE_URL` to your real domain.

---

## Photos

Drop your farm photos into `public/photos/` using the filenames in
[`public/photos/README.md`](public/photos/README.md). Until a file is there, that
slot shows a labelled placeholder naming the shot needed, so the site stays
presentable while you shoot.

---

## Changing prices, tiers and currency

Everything commercial is in [`src/lib/site.ts`](src/lib/site.ts).

- Prices are in cents. `16500` is $165.00.
- To switch to euros, change `currency` to `"eur"` and `currencySymbol` to `"€"`.
- Tier names, taglines, badges and what is included are all in the `tiers`
  array.
- The grove's headline numbers (trees on the estate, trees available this season
  and the age range of the trees) are in `groveFacts`. Which blocks are open
  comes from each zone's `status` in `assets/land-zones.json`.

## Changing the grove

The map on the home, grove and adoption pages draws
[`assets/farm-data.json`](assets/farm-data.json): the four plots traced from the
estate's aerial photograph, the ridge above them, the pond in Lago, and a
position for every tree. The file is layout only. Whether a tree is adopted
comes from the adoption store, and every tree is Picual.

- To open another plot for adoption, add its id to `OPEN_PLOTS` in
  [`src/lib/farm.ts`](src/lib/farm.ts).
- Adoptions store the spot ids of the older survey map, and each adoptable tree
  is paired with one of those spots, so opening a plot needs enough spots to go
  round: set another zone `"active"` in
  [`assets/land-zones.json`](assets/land-zones.json) at the same time. Customers
  only ever see the tree number.
- That survey map, its zones and
  [`scripts/process-land-image.py`](scripts/process-land-image.py) are still
  here because the spot ids come from them.

[`src/lib/trees.ts`](src/lib/trees.ts) holds the four block names and the tree
ids used by adoptions made before either map, so those still display.

---

## Where the data lives

Adoptions live in Postgres. Set `DATABASE_URL` and the schema is created on
first use — there is no migration step to remember. Anything that speaks
Postgres works: Replit's built-in database, Neon, Supabase, or your own server.

Every read and write goes through [`src/lib/store.ts`](src/lib/store.ts), and
the connection lives in [`src/lib/db.ts`](src/lib/db.ts). Two tables:

- `adoptions` — the record of what someone bought. Keeps its trees listed even
  after it is cancelled.
- `adoption_holds` — only "is this tree spoken for right now". Its primary key
  on `tree_id` is what makes selling one tree twice impossible rather than
  merely unlikely, however many instances are running.

There is no fallback to local storage when `DATABASE_URL` is missing. Checkout
refuses rather than taking money it cannot record. This used to be a JSON file
on disk, and that lost a paid order: the deployment's filesystem is not shared
between instances and does not survive a cold start, so the record written
during checkout was gone by the time Stripe redirected the customer back.

An unpaid checkout holds its trees for 35 minutes, and its Stripe session is
created with a 30 minute life, so an abandoned basket gives the trees back on
its own. The `checkout.session.expired` webhook is still the tidy path; the
timeout is what happens when it does not arrive.

```bash
npm test          # the store, against Postgres compiled to WebAssembly
npm run test:e2e  # picking a tree, in a real browser, on a phone and a desktop
```

The map is the one part of the site that cannot be checked by reading the
markup: it all happens on hydration, under a finger, at a screen size. The end
to end test drives a real Chromium at iPhone and desktop sizes. It needs the
site running, with a database behind it:

```bash
npm run dev:db                                        # terminal one
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres   npm run build && npm start                          # terminal two
npm run test:e2e                                      # terminal three
```

**If a `next dev` server is running, build somewhere else.** `next dev` and
`next build` both own `.next`, and a dev server left running rewrites it under
a production build. The page then renders but never hydrates, because the
manifest names chunks the other build renamed — nothing works and nothing says
why. It cost an afternoon once:

```bash
NEXT_DIST_DIR=.next-test npm run build && NEXT_DIST_DIR=.next-test npm start
```

For local work without installing anything, `npm run dev:db` serves a
throwaway Postgres on 5433 that the site talks to exactly as it will talk to
Replit or Neon:

```bash
npm run dev:db    # one terminal
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres npm run dev
```

---

## Recovering an order Stripe took but we did not record

Checkout writes `tierId`, `trees` and `customerName` into the Stripe session
and subscription metadata, so a lost adoption can be rebuilt from Stripe:

```bash
npm run recover              # list what is missing, change nothing
npm run recover -- --apply   # write the missing adoptions
```

Worth running now and then either way: it reports any paid subscription with no
adoption behind it. It cannot bring back the names the customer gave each tree,
or a gift message — those were only ever in our own store.

---

## Previewing the account page

The account page needs an adoption to show. With `DATABASE_URL` set:

```bash
npm run recover              # if you have real Stripe orders
```

or insert one by hand from `data/adoptions.sample.json` and look it up at
`/account` with its number and email.

---

## Structure

```
src/
  app/
    page.tsx                     home
    story/                       the restoration story
    grove/                       interactive estate plan
    oil/                         the product
    adopt/                       tier selection
    adopt/[tier]/                the 4 step adoption flow
    adopt/success/               confirmation and certificate
    account/                     grove lookup and season dashboard
    faq/  contact/  policies/
    api/stripe/checkout/         creates the Stripe session
    api/stripe/webhook/          marks adoptions paid, follows renewals
    api/account/  api/contact/
  components/
    farm-map.tsx                 the farm map, browsing plots and picking trees
    adopt-flow.tsx               the 4 step flow
    certificate.tsx              printable adoption certificate
    photo.tsx                    photo slot with labelled placeholder
  lib/
    site.ts                      brand, tiers, prices, currency
    trees.ts                     block names, and tree ids from before the land map
    farm.ts                      plots and trees from assets/farm-data.json
    land.ts                      the spot ids adoptions are stored under
    store.ts                     adoption persistence
    db.ts                        the Postgres connection and schema
    faq.ts  stripe.ts
scripts/
  store.test.ts                  store tests, run with npm test
  recover-from-stripe.ts         rebuild adoptions Stripe has and we do not
```

---

## Still to do before launch

- Wire `api/contact` to an email provider so contact form messages reach an
  inbox. The route has the Resend snippet in a comment.
- Send a confirmation email with the adoption number from the Stripe webhook.
- Have the three policy pages reviewed by a lawyer. They are accurate drafts,
  not legal advice.
- Shoot and drop in the photos.
