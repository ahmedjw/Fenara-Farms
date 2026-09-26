/**
 * Outgoing email.
 *
 * One provider, reached over its HTTP API rather than through an SDK, so
 * nothing new has to be installed and swapping provider means changing the
 * one `send` below.
 *
 * With no RESEND_API_KEY set the message is written to the log instead of
 * sent, and the caller is told it did not go. That keeps local work and a
 * half-configured deployment honest: nothing pretends an email was sent.
 */

import { formatDate, formatPrice, getTier, site, tierTotal } from "./site";
import { describePlot } from "./plots";
import {
  claimConfirmationEmail,
  releaseConfirmationEmail,
  type Adoption,
} from "./store";

type Message = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

function from(): string {
  // Resend refuses anything but a verified domain, so this must be set to an
  // address on one you own before it will deliver.
  return process.env.EMAIL_FROM?.trim() || `Fenara Farms <onboarding@resend.dev>`;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

async function send(message: Message): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.warn(
      `[email] RESEND_API_KEY is not set, so this was not sent:\n` +
        `        to: ${message.to}\n        subject: ${message.subject}`,
    );
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from(),
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error(`[email] ${res.status} from Resend:`, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] could not be sent:", e);
    return false;
  }
}

/** The delivery address as it would be written on a label. */
function addressLines(adoption: Adoption): string[] {
  const d = adoption.delivery;
  if (!d) return [];
  return [d.name, d.line1, d.line2, [d.postalCode, d.city].filter(Boolean).join(" "), d.region, d.country]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));
}

/**
 * The one email a customer must get: proof they bought something, and the
 * number they need to look it up again.
 */
export async function sendAdoptionConfirmation(adoption: Adoption): Promise<boolean> {
  const tier = getTier(adoption.tierId);
  const trees = adoption.trees
    .map((id) => {
      const named = adoption.names[id];
      const label = describePlot(id).label;
      return named && named !== id ? `  ${label}, named ${named}` : `  ${label}`;
    })
    .join("\n");

  const address = addressLines(adoption);
  const lines = [
    `${adoption.customerName.split(" ")[0] || "Hello"},`,
    ``,
    `Your ${adoption.trees.length === 1 ? "tree is" : "trees are"} yours. Thank you.`,
    ``,
    `Adoption number: ${adoption.number}`,
    tier ? `Tier: ${tier.name}, ${tier.englishName.toLowerCase()}` : ``,
    ``,
    adoption.trees.length === 1 ? `Your tree:` : `Your trees:`,
    trees,
    ``,
    tier
      ? `Charged today: ${formatPrice(tierTotal(tier))} (${formatPrice(tier.price)} adoption, ${formatPrice(tier.shipping)} shipping).`
      : ``,
    adoption.renewsAt
      ? `This renews on ${formatDate(adoption.renewsAt)}, and you can switch that off any time by writing to us.`
      : `This renews once a year, and you can switch that off any time by writing to us.`,
    ``,
    address.length
      ? [`We will ship to:`, ...address.map((l) => `  ${l}`), adoption.delivery?.phone ? `  ${adoption.delivery.phone}` : ``]
          .filter(Boolean)
          .join("\n")
      : `We do not have a delivery address for you yet. Please reply to this email with one.`,
    ``,
    `The grove is harvested in late October and the first bottles leave here in early November. We will write before then.`,
    ``,
    `You can see your ${adoption.trees.length === 1 ? "tree" : "trees"} any time at ${site.url}/account, with this adoption number and this email address.`,
    ``,
    `From our grove to your table,`,
    site.name,
    site.estate,
  ];

  return send({
    to: adoption.email,
    replyTo: site.email,
    subject: `Your olive ${adoption.trees.length === 1 ? "tree" : "trees"} at Fenara Farms, ${adoption.number}`,
    text: lines.filter((l) => l !== undefined).join("\n").replace(/\n{3,}/g, "\n\n"),
  });
}

/**
 * Sends the confirmation, once, however many times this is called.
 *
 * The claim is taken in the database before the email goes, so the success
 * page racing the webhook cannot send a second one. A failed send hands the
 * claim back rather than leaving someone with no proof of purchase and no way
 * to get one.
 */
export async function confirmAdoptionOnce(adoption: Adoption): Promise<void> {
  if (!(await claimConfirmationEmail(adoption.number))) return;
  if (!(await sendAdoptionConfirmation(adoption))) {
    await releaseConfirmationEmail(adoption.number);
  }
}
