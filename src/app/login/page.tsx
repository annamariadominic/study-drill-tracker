import { Field } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { PendingSubmit } from "@/components/ui/pending-submit";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-xs">
        <h1 className="font-serif text-2xl tracking-[-0.01em] text-text">Study Drill Tracker</h1>
        <p className="mt-1 text-sm text-muted">Enter your password to continue.</p>

        <form method="post" action="/api/login" className="mt-8 flex flex-col gap-4">
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              aria-invalid={error ? true : undefined}
            />
          </Field>
          {error ? <InlineAlert>Incorrect password. Try again.</InlineAlert> : null}
          <PendingSubmit pendingLabel="Signing in…" className="w-full">
            Sign in
          </PendingSubmit>
        </form>
      </div>
    </main>
  );
}
