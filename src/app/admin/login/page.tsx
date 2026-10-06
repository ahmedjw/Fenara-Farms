import { redirect } from "next/navigation";
import { adminConfigured, isAdmin } from "@/lib/admin-auth";
import { site } from "@/lib/site";
import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-[380px]">
        <p className="mono-label">{site.name}</p>
        <h1 className="display mt-2 text-[40px] text-olive">Admin</h1>
        {adminConfigured() ? (
          <SignInForm />
        ) : (
          <p className="mt-6 rounded-[2px] border-l-2 border-brick bg-paper-sunk p-4 text-[14px] leading-relaxed text-stone">
            Admin sign-in is switched off because no password is set. Add{" "}
            <code className="font-mono text-[13px] text-ink">ADMIN_PASSWORD</code>{" "}
            to the environment this site runs in, then restart it.
          </p>
        )}
      </div>
    </div>
  );
}
