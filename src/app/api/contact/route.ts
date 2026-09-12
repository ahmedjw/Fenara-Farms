import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Contact form handler.
 *
 * Right now this validates the message and logs it server side. To actually
 * receive these, add an email provider below. With Resend that is roughly:
 *
 *   const resend = new Resend(process.env.RESEND_API_KEY);
 *   await resend.emails.send({
 *     from: "site@fenara.com",
 *     to: "hello@fenara.com",
 *     replyTo: email,
 *     subject: `[${subject}] ${name}`,
 *     text: message,
 *   });
 */
export async function POST(request: Request) {
  let body: Record<string, string>;
  try {
    body = (await request.json()) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const message = body.message?.trim();
  const subject = body.subject?.trim() || "General enquiry";

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "Name, email and a message are all required." },
      { status: 400 },
    );
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json(
      { error: "That email address does not look right." },
      { status: 400 },
    );
  }

  console.log("[contact]", { name, email, subject, message });

  return NextResponse.json({ ok: true });
}
