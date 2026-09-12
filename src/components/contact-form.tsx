"use client";

import { useState } from "react";
import { CheckCircle, Warning } from "@phosphor-icons/react";
import { Button } from "./ui";

const subjects = [
  "About adopting a tree",
  "About an existing adoption",
  "Visiting the estate",
  "Wholesale or corporate gifting",
  "Something else",
];

/**
 * Contact form.
 *
 * Posts to /api/contact, which currently logs the message server side. Wire
 * that route to your inbox provider (Resend, Postmark, SendGrid) to start
 * receiving these for real.
 */
export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    setError("");

    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send your message.");
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="flex gap-4 border border-line-strong bg-paper-raised p-7">
        <CheckCircle
          size={26}
          weight="light"
          className="mt-0.5 shrink-0 text-olive-mid"
        />
        <div>
          <h2 className="display text-[24px] leading-tight text-ink">
            Message sent.
          </h2>
          <p className="mt-2 max-w-[42ch] text-[15px] leading-relaxed text-stone">
            We read everything and usually reply within two working days. In
            harvest season it can take a little longer, because we are outside.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-[560px] space-y-6">
      <div>
        <label htmlFor="name" className="block text-[13px] font-medium text-ink">
          Your name
        </label>
        <input
          id="name"
          name="name"
          required
          autoComplete="name"
          className="mt-2 w-full rounded-[2px] border border-line-strong bg-paper-raised px-4 py-3 text-[15px] text-ink placeholder:text-stone-light focus:border-olive focus:outline-none"
          placeholder="Marisol Aguirre"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-[13px] font-medium text-ink">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-2 w-full rounded-[2px] border border-line-strong bg-paper-raised px-4 py-3 text-[15px] text-ink placeholder:text-stone-light focus:border-olive focus:outline-none"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="subject"
          className="block text-[13px] font-medium text-ink"
        >
          What is this about
        </label>
        <select
          id="subject"
          name="subject"
          className="mt-2 w-full rounded-[2px] border border-line-strong bg-paper-raised px-4 py-3 text-[15px] text-ink focus:border-olive focus:outline-none"
        >
          {subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-[13px] font-medium text-ink"
        >
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          className="mt-2 w-full rounded-[2px] border border-line-strong bg-paper-raised px-4 py-3 text-[15px] text-ink placeholder:text-stone-light focus:border-olive focus:outline-none"
          placeholder="Tell us what you need."
        />
      </div>

      {state === "error" && (
        <div className="flex gap-3 border border-brick bg-paper-raised p-4">
          <Warning
            size={18}
            weight="light"
            className="mt-0.5 shrink-0 text-brick"
          />
          <p className="text-[14px] leading-relaxed text-ink">{error}</p>
        </div>
      )}

      <Button type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Sending" : "Send message"}
      </Button>
    </form>
  );
}
