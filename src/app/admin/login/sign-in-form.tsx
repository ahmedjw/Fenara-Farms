"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { signIn, type SignInState } from "../actions";

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(
    signIn,
    {},
  );

  return (
    <form action={action} className="mt-6 flex flex-col gap-3">
      <label htmlFor="password" className="text-[14px] text-ink">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
        className="rounded-[2px] border border-line-strong bg-paper-raised px-4 py-3 text-[15px] text-ink focus:border-olive focus:outline-none"
      />
      {state.error && (
        <p role="alert" className="text-[13px] text-brick">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Checking…" : "Sign in"}
      </Button>
    </form>
  );
}
