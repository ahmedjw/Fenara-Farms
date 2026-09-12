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

  const adoption = await findForCustomer(number, email);

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
