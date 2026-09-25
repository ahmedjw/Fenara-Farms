import { NextResponse } from "next/server";
import { findForCustomer } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Grove lookup.
 *
 * Adoption number plus the email it was bought with. Deliberately not a
 * password account: it is the lightest thing that works, and there is nothing
 * behind it worth stealing. If you later add logins, replace this route and
 * the form that calls it.
 */
export async function POST(request: Request) {
  let body: { number?: string; email?: string };
  try {
    body = (await request.json()) as { number?: string; email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const number = body.number?.trim();
  const email = body.email?.trim();

  if (!number || !email) {
    return NextResponse.json(
      { error: "Enter both your adoption number and your email." },
      { status: 400 },
    );
  }

  let adoption;
  try {
    adoption = await findForCustomer(number, email);
  } catch (e) {
    // A lookup that cannot reach the store is not the same as one that found
    // nothing, and telling someone their adoption does not exist would be a
    // small cruelty.
    console.error("Account lookup failed:", e);
    return NextResponse.json(
      {
        error:
          "We could not reach our records just now. Please try again in a minute, or write to us.",
      },
      { status: 503 },
    );
  }

  if (!adoption) {
    return NextResponse.json(
      {
        error:
          "No adoption matches that number and email. Check your confirmation email, or write to us and we will find it.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ adoption });
}
