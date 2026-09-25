"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  Check,
  Warning,
} from "@phosphor-icons/react";
import { FarmMap } from "./farm-map";
import { Button } from "./ui";
import { openPlotNames } from "@/lib/farm";
import type { TreeHolds } from "@/lib/store";
import { describePlot } from "@/lib/plots";
import {
  formatDate,
  formatPrice,
  site,
  tierTotal,
  type Tier,
} from "@/lib/site";

/**
 * The adoption flow.
 *
 * Four steps, one screen each, state held here and posted to Stripe at the
 * end. Steps are gated: you cannot advance until the current one is valid,
 * and the step indicator lets you walk back to anything already completed.
 */

type Step = 0 | 1 | 2 | 3;

const stepNames = ["Choose trees", "Name them", "Your details", "Review"];

export function AdoptFlow({
  tier,
  holds,
  paymentsReady,
}: {
  tier: Tier;
  holds: TreeHolds;
  paymentsReady: boolean;
}) {
  const reduce = useReducedMotion();

  const [step, setStep] = useState<Step>(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [isGift, setIsGift] = useState(false);
  const [giftFrom, setGiftFrom] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // The first render must be visible without waiting for Motion, otherwise a
  // slow JS load leaves the customer staring at an empty step.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [error, setError] = useState<string | null>(null);
  /** Trees that went while this person was still deciding. */
  const [lost, setLost] = useState<string[]>([]);

  // The map keeps asking the server what is free. When something we are
  // holding on screen turns out to be gone, take it off the list here and say
  // so, rather than letting them carry it all the way to a failed payment.
  const onHoldsChange = useCallback((next: TreeHolds) => {
    const held = new Set([...next.adopted, ...next.reserved]);
    setSelected((prev) => {
      const kept = prev.filter((id) => !held.has(id));
      if (kept.length === prev.length) return prev;
      setLost(prev.filter((id) => held.has(id)));
      return kept;
    });
  }, []);

  const treesChosen = selected.length === tier.trees;
  const allNamed = selected.every((id) => (names[id] ?? "").trim().length > 0);
  const detailsValid =
    customerName.trim().length > 1 && /^\S+@\S+\.\S+$/.test(email.trim());

  const canAdvance =
    step === 0 ? treesChosen : step === 1 ? allNamed : step === 2 ? detailsValid : true;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId: tier.id,
          trees: selected,
          names,
          customerName,
          email,
          giftFrom: isGift ? giftFrom : undefined,
          giftMessage: isGift ? giftMessage : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No checkout session was returned.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setError(message);
      setSubmitting(false);
      // "was adopted while you were choosing" means the map is behind. Go back
      // to it, where the live check will show what is actually free now.
      if (/adopted while you were choosing/i.test(message)) setStep(0);
    }
  }

  return (
    <div className="px-5 py-12 md:px-8 md:py-16">
      <div className="mx-auto w-full max-w-[1240px]">
        {/* Header and step indicator */}
        <div className="flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mono-label">
              Adopting {tier.name}, {tier.trees}{" "}
              {tier.trees === 1 ? "tree" : "trees"}
            </p>
            <h1 className="display mt-3 text-[clamp(2rem,4.6vw,3.25rem)] text-olive">
              {stepNames[step]}
            </h1>
          </div>
          <div>
            <p className="display text-[34px] leading-none text-ink">
              {formatPrice(tier.price)}
              <span className="ml-2 font-sans text-[14px] text-stone">
                per year
              </span>
            </p>
            <p className="mt-1.5 text-[13px] text-stone md:text-right">
              Plus {formatPrice(tier.shipping)} shipping
            </p>
          </div>
        </div>

        <ol className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
          {stepNames.map((name, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={name}>
                <button
                  type="button"
                  disabled={i > step}
                  onClick={() => setStep(i as Step)}
                  className={`flex items-center gap-2 text-[13px] transition-colors disabled:cursor-not-allowed ${
                    current
                      ? "text-ink"
                      : done
                        ? "text-olive-mid hover:text-ink"
                        : "text-stone-light"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-[2px] border text-[10px] ${
                      current
                        ? "border-olive bg-olive text-paper"
                        : done
                          ? "border-olive-mid text-olive-mid"
                          : "border-line-strong"
                    }`}
                  >
                    {done ? <Check size={11} weight="bold" /> : i + 1}
                  </span>
                  {name}
                </button>
              </li>
            );
          })}
        </ol>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduce || !mounted ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10"
          >
            {step === 0 && (
              <div>
                <p className="mb-6 max-w-[60ch] text-[15px] leading-relaxed text-stone">
                  Pick {tier.trees} {tier.trees === 1 ? "tree" : "trees"} from
                  the map below. You do not have to hit a dot exactly — click
                  anywhere near a tree and it takes the closest one. Solid dots
                  are free, hollow ones are adopted, and a broken ring means
                  someone is at the checkout with that tree right now. The map
                  opens on {openPlotNames}, the one block open this season;
                  choose <span className="text-ink">All plots</span> to see the
                  whole estate.
                </p>
                {lost.length > 0 && (
                  <div className="mb-4 flex gap-3 border border-brick bg-paper-raised p-4">
                    <Warning
                      size={19}
                      weight="light"
                      className="mt-0.5 shrink-0 text-brick"
                    />
                    <p className="text-[14px] leading-relaxed text-ink">
                      {lost.map((id) => describePlot(id).label).join(", ")}{" "}
                      {lost.length === 1 ? "was" : "were"} taken while you were
                      choosing, so {lost.length === 1 ? "it has" : "they have"}{" "}
                      come off your list. Please pick again.
                    </p>
                  </div>
                )}
                <FarmMap
                  limit={tier.trees}
                  adoptedSpotIds={holds.adopted}
                  reservedSpotIds={holds.reserved}
                  selectedSpotIds={selected}
                  live
                  onHoldsChange={onHoldsChange}
                  onSelect={(_, ids) => {
                    setLost([]);
                    setSelected(ids);
                  }}
                />
                <p className="mt-5 text-[14px] text-stone">
                  {selected.length} of {tier.trees} chosen
                  {selected.length > 0 && (
                    <span className="ml-2 font-mono text-[13px] text-ink">
                      {selected.map((id) => describePlot(id).label).join(", ")}
                    </span>
                  )}
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="max-w-[640px]">
                <p className="mb-8 text-[15px] leading-relaxed text-stone">
                  Give each tree a name. It goes on your certificate, on the
                  grove plan, and on a small marker at the base of the trunk.
                </p>
                <div className="space-y-6">
                  {selected.map((id) => (
                    <div key={id}>
                      <label
                        htmlFor={`name-${id}`}
                        className="block text-[13px] font-medium text-ink"
                      >
                        Tree {describePlot(id).label}
                      </label>
                      <input
                        id={`name-${id}`}
                        type="text"
                        maxLength={28}
                        value={names[id] ?? ""}
                        onChange={(e) =>
                          setNames((n) => ({ ...n, [id]: e.target.value }))
                        }
                        className="mt-2 w-full rounded-[2px] border border-line-strong bg-paper-raised px-4 py-3 text-[15px] text-ink placeholder:text-stone-light focus:border-olive focus:outline-none"
                        placeholder="Abuela, Old Faithful, whatever it should be"
                      />
                      <p className="mt-1.5 text-[12px] text-stone">
                        {(names[id] ?? "").length} of 28 characters
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="max-w-[640px] space-y-6">
                <div>
                  <label
                    htmlFor="customerName"
                    className="block text-[13px] font-medium text-ink"
                  >
                    Full name
                  </label>
                  <input
                    id="customerName"
                    type="text"
                    autoComplete="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="mt-2 w-full rounded-[2px] border border-line-strong bg-paper-raised px-4 py-3 text-[15px] text-ink placeholder:text-stone-light focus:border-olive focus:outline-none"
                    placeholder="Marisol Aguirre"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-[13px] font-medium text-ink"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-2 w-full rounded-[2px] border border-line-strong bg-paper-raised px-4 py-3 text-[15px] text-ink placeholder:text-stone-light focus:border-olive focus:outline-none"
                    placeholder="you@example.com"
                  />
                  <p className="mt-1.5 text-[12px] text-stone">
                    Season updates and your adoption number go here. Shipping
                    address is collected by Stripe at payment.
                  </p>
                </div>

                <div className="border-t border-line pt-6">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isGift}
                      onChange={(e) => setIsGift(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-[color:var(--color-olive)]"
                    />
                    <span>
                      <span className="block text-[15px] text-ink">
                        This is a gift
                      </span>
                      <span className="block text-[13px] text-stone">
                        The certificate is made out to the recipient and carries
                        your message. No prices are included.
                      </span>
                    </span>
                  </label>

                  {isGift && (
                    <div className="mt-6 space-y-6 border-l border-line pl-5">
                      <div>
                        <label
                          htmlFor="giftFrom"
                          className="block text-[13px] font-medium text-ink"
                        >
                          From
                        </label>
                        <input
                          id="giftFrom"
                          type="text"
                          value={giftFrom}
                          onChange={(e) => setGiftFrom(e.target.value)}
                          className="mt-2 w-full rounded-[2px] border border-line-strong bg-paper-raised px-4 py-3 text-[15px] text-ink placeholder:text-stone-light focus:border-olive focus:outline-none"
                          placeholder="Who the gift is from"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="giftMessage"
                          className="block text-[13px] font-medium text-ink"
                        >
                          Message on the certificate
                        </label>
                        <textarea
                          id="giftMessage"
                          rows={3}
                          maxLength={200}
                          value={giftMessage}
                          onChange={(e) => setGiftMessage(e.target.value)}
                          className="mt-2 w-full rounded-[2px] border border-line-strong bg-paper-raised px-4 py-3 text-[15px] text-ink placeholder:text-stone-light focus:border-olive focus:outline-none"
                          placeholder="A few words to go with it"
                        />
                        <p className="mt-1.5 text-[12px] text-stone">
                          {giftMessage.length} of 200 characters
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="max-w-[640px]">
                <dl className="divide-y divide-line border-y border-line">
                  <Summary label="Tier">
                    {tier.name}, {tier.trees}{" "}
                    {tier.trees === 1 ? "tree" : "trees"}
                  </Summary>
                  <Summary label="Your trees">
                    <ul className="space-y-1">
                      {selected.map((id) => (
                        <li key={id}>
                          <span className="font-mono text-[13px] text-stone">
                            {describePlot(id).label}
                          </span>{" "}
                          {names[id]}
                        </li>
                      ))}
                    </ul>
                  </Summary>
                  <Summary label="Oil">{tier.bottles}</Summary>
                  <Summary label="Delivery">{tier.shipments}</Summary>
                  <Summary label="Registered to">
                    {customerName}
                    <br />
                    <span className="text-stone">{email}</span>
                  </Summary>
                  {isGift && (
                    <Summary label="Gift">
                      From {giftFrom || "not given"}
                      {giftMessage && (
                        <span className="mt-1 block text-stone">
                          &ldquo;{giftMessage}&rdquo;
                        </span>
                      )}
                    </Summary>
                  )}
                  <Summary label="Adoption">
                    {formatPrice(tier.price)}{" "}
                    <span className="text-stone">per year</span>
                  </Summary>
                  <Summary label="Shipping">
                    {formatPrice(tier.shipping)}{" "}
                    <span className="text-stone">
                      flat rate, one shipment per harvest
                    </span>
                  </Summary>
                  <Summary label="Total">
                    <span className="display text-[26px] text-ink">
                      {formatPrice(tierTotal(tier))}
                    </span>{" "}
                    <span className="text-stone">per year</span>
                  </Summary>
                </dl>

                {/* Stated plainly before payment: what recurs, when, and how to stop it. */}
                <div className="mt-6 flex gap-3 border border-line-strong bg-paper-raised p-4">
                  <ArrowsClockwise
                    size={19}
                    weight="light"
                    className="mt-0.5 shrink-0 text-olive-mid"
                  />
                  <p className="text-[14px] leading-relaxed text-ink">
                    Your adoption renews automatically every year. Stripe charges{" "}
                    {formatPrice(tierTotal(tier))} to your card today and again on{" "}
                    {formatDate(oneYearFromNow())} and each year after. Renewal
                    can be switched off: write to us at {site.email} and we will
                    sort it.
                  </p>
                </div>

                {!paymentsReady && (
                  <div className="mt-6 flex gap-3 border border-brick bg-paper-raised p-4">
                    <Warning
                      size={19}
                      weight="light"
                      className="mt-0.5 shrink-0 text-brick"
                    />
                    <p className="text-[14px] leading-relaxed text-ink">
                      Payments are not connected yet. Set{" "}
                      <code className="font-mono text-[13px]">
                        STRIPE_SECRET_KEY
                      </code>{" "}
                      in the environment this site runs in, then restart or
                      redeploy it to take real payments.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="mt-6 flex gap-3 border border-brick bg-paper-raised p-4">
                    <Warning
                      size={19}
                      weight="light"
                      className="mt-0.5 shrink-0 text-brick"
                    />
                    <p className="text-[14px] leading-relaxed text-ink">{error}</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-12 flex items-center justify-between gap-4 border-t border-line pt-6">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1) as Step)}
            disabled={step === 0}
            className="inline-flex items-center gap-2 text-[14px] text-stone transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft size={15} weight="light" />
            Back
          </button>

          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => Math.min(3, s + 1) as Step)}
              disabled={!canAdvance}
            >
              Continue
              <ArrowRight size={15} weight="light" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting || !paymentsReady}>
              {submitting ? "Opening secure checkout" : "Pay and adopt"}
              {!submitting && <ArrowRight size={15} weight="light" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The first renewal: Stripe charges again on the anniversary of today's payment. */
function oneYearFromNow() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date;
}

function Summary({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[160px_1fr] sm:gap-6">
      <dt className="text-[13px] text-stone">{label}</dt>
      <dd className="text-[15px] text-ink">{children}</dd>
    </div>
  );
}
