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

### Going live

Swap the test keys for live keys, add a webhook endpoint in the Stripe
dashboard pointing at `https://yourdomain.com/api/stripe/webhook` listening for
`checkout.session.completed`, and set `NEXT_PUBLIC_SITE_URL` to your real
domain.

---

## Photos

Drop your farm photos into `public/photos/` using the filenames in
[`public/photos/README.md`](public/photos/README.md). Until a file is there, that
slot shows a labelled placeholder naming the shot needed, so the site stays
presentable while you shoot.

---

## Changing prices, tiers and currency

Everything commercial is in [`src/lib/site.ts`](src/lib/site.ts).

- Prices are in cents. `11500` is $115.00.
- To switch to euros, change `currency` to `"eur"` and `currencySymbol` to `"€"`.
- Tier names, what is included, and how many are left this season are all in the
  `tiers` array.

## Changing the grove

[`src/lib/trees.ts`](src/lib/trees.ts) generates the estate: four blocks, their
names and descriptions, and every tree with an age and a last yield. Tree
positions come from a seeded generator so the map is identical on every load.

When you have a real survey of the estate, replace `buildGrove()` with a loader
that reads your own coordinates. Nothing else needs to change.

---

## Where the data lives

Adoptions are written to `data/adoptions.json`. That is deliberate: it makes the
whole flow work end to end without standing up a database.

**Before taking live payments, move this to a real database.** File storage does
not survive a redeploy on serverless hosts like Vercel, so adoptions would be
lost. Every read and write goes through [`src/lib/store.ts`](src/lib/store.ts),
so this means rewriting that one file and nothing else.

---

## Previewing the account page

The account page needs an adoption to show. Before you have real ones, copy the
sample record over:

```bash
cp data/adoptions.sample.json data/adoptions.json
```

Then go to `/account` and look up `FEN-2026-0001` with `marisol@example.com`.
Delete `data/adoptions.json` when you are done. It is git ignored, and real
adoptions get written to that same file once Stripe is connected.

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
    api/stripe/webhook/          marks adoptions paid
    api/account/  api/contact/
  components/
    grove-map.tsx                the estate plan, browse and select modes
    adopt-flow.tsx               the 4 step flow
    certificate.tsx              printable adoption certificate
    photo.tsx                    photo slot with labelled placeholder
  lib/
    site.ts                      brand, tiers, prices, currency
    trees.ts                     the grove
    store.ts                     adoption persistence
    faq.ts  stripe.ts
```

---

## Still to do before launch

- Move adoptions from the JSON file to a real database.
- Wire `api/contact` to an email provider so contact form messages reach an
  inbox. The route has the Resend snippet in a comment.
- Send a confirmation email with the adoption number from the Stripe webhook.
- Have the three policy pages reviewed by a lawyer. They are accurate drafts,
  not legal advice.
- Shoot and drop in the photos.
