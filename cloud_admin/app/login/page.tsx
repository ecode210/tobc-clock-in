import type { Metadata } from "next";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { login } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";

  return (
    <main
      className="flex min-h-dvh flex-col items-center bg-canvas px-5 md:justify-center"
      style={{
        paddingTop: "max(3.5rem, calc(env(safe-area-inset-top) + 2.5rem))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt="The Olivebrook Church"
          width={166}
          height={60}
          className="mx-auto h-[60px] w-auto"
        />
        <div className="mt-9 rounded-[2rem] bg-surface px-6 pb-7 pt-8 shadow-[0_8px_24px_rgb(30_20_48/0.05)]">
          <h1 className="text-center text-2xl font-bold leading-tight tracking-tight">
            Welcome to TOBC
            <br />
            Clock-In System!
          </h1>
          <p className="mt-2 text-center text-[15px] text-muted">Sign in to manage workers and attendance.</p>
          <ActionForm action={login} className="mt-7 space-y-5">
            <input type="hidden" name="next" value={next} />
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium">
                Username
              </label>
              <input
                id="username"
                name="username"
                className="input input-soft"
                placeholder="admin"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="input input-soft"
                placeholder="Your password"
                autoComplete="current-password"
                required
              />
            </div>
            <SubmitButton className="btn-lg mt-2 w-full" pendingText="Signing in…">
              Sign in
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
