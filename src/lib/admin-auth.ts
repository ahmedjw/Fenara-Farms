/**
 * Who may see the admin dashboard.
 *
 * One shared password, `ADMIN_PASSWORD`, set in the environment the site runs
 * in. There are no admin accounts to manage and nothing to sign up for: the
 * estate has a handful of people who need this, and a password they share is
 * the right size of answer.
 *
 * Signing in sets a cookie holding an expiry and an HMAC of it, keyed on the
 * password. Nothing is stored server side, so it works across every instance,
 * and changing the password signs everyone out at once.
 *
 * With no password set, nobody gets in. A dashboard full of customers'
 * addresses that opens itself when a setting is missing is the failure to
 * avoid.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "fenara_admin";

/** How long a sign-in lasts. */
const SESSION_MS = 12 * 60 * 60 * 1000;

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

function secret(): string | null {
  return process.env.ADMIN_PASSWORD?.trim() || null;
}

function sign(expires: number, key: string): string {
  return createHmac("sha256", key).update(`admin:${expires}`).digest("hex");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Whether a typed password is the admin password. */
export function passwordMatches(attempt: string): boolean {
  const key = secret();
  if (!key) return false;
  // Compare digests so the comparison takes the same time whatever the length.
  const digest = (s: string) => createHmac("sha256", "compare").update(s).digest("hex");
  return same(digest(attempt), digest(key));
}

/** A fresh session token and when it runs out. */
export function newSession(): { token: string; expires: Date } | null {
  const key = secret();
  if (!key) return null;
  const expires = Date.now() + SESSION_MS;
  return { token: `${expires}.${sign(expires, key)}`, expires: new Date(expires) };
}

export function sessionValid(token: string | undefined): boolean {
  const key = secret();
  if (!key || !token) return false;
  const [expiresText, signature] = token.split(".");
  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires < Date.now() || !signature) return false;
  return same(signature, sign(expires, key));
}

/** Whether the person making this request is signed in as admin. */
export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return sessionValid(jar.get(ADMIN_COOKIE)?.value);
}
