"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  newSession,
  passwordMatches,
} from "@/lib/admin-auth";

export type SignInState = { error?: string };

export async function signIn(
  _previous: SignInState,
  form: FormData,
): Promise<SignInState> {
  const password = String(form.get("password") ?? "");
  // A wrong guess costs a moment, so trying passwords by the thousand does not pay.
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (!passwordMatches(password)) {
    return { error: "That is not the admin password." };
  }
  const session = newSession();
  if (!session) return { error: "Admin sign-in is not set up on this server." };

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    expires: session.expires,
  });
  redirect("/admin");
}

export async function signOut() {
  const jar = await cookies();
  jar.delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin/login");
}
