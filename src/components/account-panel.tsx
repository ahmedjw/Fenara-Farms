"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Warning } from "@phosphor-icons/react";
import { Certificate } from "./certificate";
import { Button } from "./ui";
import { getTier } from "@/lib/site";
import { describePlot } from "@/lib/plots";
import type { Adoption } from "@/lib/store";

/**
 * Your grove.
 *
 * Lookup by adoption number and email, then the season dashboard: your trees,
 * where the season has got to, and your certificate.
 */
export function AccountPanel() {
  const [adoption, setAdoption] = useState<Adoption | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reduce = useReducedMotion();

  async function lookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: form.get("number"),
          email: form.get("email"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not find that adoption.");
      setAdoption(data.adoption as Adoption);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find that adoption.");
    } finally {
      setLoading(false);
    }
  }

  if (adoption) {
    return (
      <GroveDashboard adoption={adoption} onBack={() => setAdoption(null)} />
    );
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-[460px]"
    >
      <form onSubmit={lookup} className="space-y-6">
        <div>
          <label
            htmlFor="number"
            className="block text-[13px] font-medium text-ink"
          >
            Adoption number
          </label>
          <input
            id="number"
            name="number"
            required
            className="mt-2 w-full rounded-[2px] border border-line-strong bg-paper-raised px-4 py-3 font-mono text-[15px] text-ink placeholder:text-stone-light focus:border-olive focus:outline-none"
            placeholder="FEN-2026-0001"
          />
          <p className="mt-1.5 text-[12px] text-stone">
            On your confirmation email and your certificate.
          </p>
        </div>

        <div>
          <label
            htmlFor="account-email"
            className="block text-[13px] font-medium text-ink"
          >
            Email
          </label>
          <input
            id="account-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-2 w-full rounded-[2px] border border-line-strong bg-paper-raised px-4 py-3 text-[15px] text-ink placeholder:text-stone-light focus:border-olive focus:outline-none"
            placeholder="The email you adopted with"
          />
        </div>

        {error && (
          <div className="flex gap-3 border border-brick bg-paper-raised p-4">
            <Warning
              size={18}
              weight="light"
              className="mt-0.5 shrink-0 text-brick"
            />
            <p className="text-[14px] leading-relaxed text-ink">{error}</p>
          </div>
        )}

        <Button type="submit" disabled={loading}>
          {loading ? "Looking" : "Open my grove"}
        </Button>
      </form>
    </motion.div>
  );
}

/** Where the season currently stands. Drives the timeline below. */
const season = [
  { phase: "Flowering", months: "April to May", done: true },
  { phase: "Fruit set", months: "June", done: true },
  { phase: "Growing on", months: "July to September", done: true },
  { phase: "Ripening", months: "October", done: false, current: true },
  { phase: "Harvest", months: "November", done: false },
  { phase: "Extraction and bottling", months: "November", done: false },
  { phase: "Your oil ships", months: "December", done: false },
];

function GroveDashboard({
  adoption,
  onBack,
}: {
  adoption: Adoption;
  onBack: () => void;
}) {
  const tier = getTier(adoption.tierId);

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-[14px] text-stone transition-colors hover:text-ink print:hidden"
      >
        <ArrowLeft size={15} weight="light" />
        Look up a different adoption
      </button>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
        <div>
          <p className="mono-label">Adoption {adoption.number}</p>
          <h2 className="display mt-3 text-[clamp(2rem,4.6vw,3rem)] leading-tight text-olive">
            {adoption.customerName}
          </h2>
        </div>
        <p className="text-[14px] text-stone">
          {tier?.name}, season {adoption.season}
          {adoption.status === "pending" && (
            <span className="ml-3 rounded-[2px] border border-line-strong px-2 py-1 text-[12px]">
              Payment settling
            </span>
          )}
        </p>
      </div>

      {/* Your trees */}
      <section className="mt-12">
        <h3 className="display text-[26px] leading-none text-ink">
          Your {adoption.trees.length === 1 ? "tree" : "trees"}
        </h3>
        <ul className="mt-6 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {adoption.trees.map((id) => (
            <li key={id} className="bg-paper-raised p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
                {id}
              </p>
              <p className="display mt-1.5 text-[26px] leading-tight text-olive">
                {adoption.names[id]}
              </p>
              <dl className="mt-4 space-y-1.5 text-[13px]">
                {describePlot(id).facts.map((fact) => (
                  <div key={fact.label} className="flex justify-between gap-3">
                    <dt className="text-stone">{fact.label}</dt>
                    <dd className="text-ink">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </section>

      {/* Season progress */}
      <section className="mt-16">
        <h3 className="display text-[26px] leading-none text-ink">
          Where the season is
        </h3>
        <ol className="mt-6 border-t border-line">
          {season.map((s) => (
            <li
              key={s.phase}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line py-4"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  s.done
                    ? "bg-olive-mid"
                    : s.current
                      ? "bg-brick"
                      : "bg-line-strong"
                }`}
                aria-hidden
              />
              <span
                className={`min-w-[220px] flex-1 text-[15px] ${
                  s.done || s.current ? "text-ink" : "text-stone-light"
                }`}
              >
                {s.phase}
              </span>
              <span className="text-[13px] text-stone">{s.months}</span>
              <span
                className={`w-[92px] text-right font-mono text-[11px] uppercase tracking-[0.12em] ${
                  s.current ? "text-brick" : "text-stone-light"
                }`}
              >
                {s.done ? "Done" : s.current ? "Now" : ""}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-5 max-w-[56ch] text-[14px] leading-relaxed text-stone">
          We email an update at each stage. If the weather changes the timings,
          which it does most years, we will tell you rather than quietly slip
          the dates.
        </p>
      </section>

      <section className="mt-16">
        <Certificate adoption={adoption} tierName={tier?.name ?? ""} />
      </section>
    </div>
  );
}
