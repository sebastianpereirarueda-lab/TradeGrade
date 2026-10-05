import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { resetPassword, sendMagicLink, signInWithGoogle, signInWithPassword, signUp, useAuth } from "../lib/auth";
import { authConfigured } from "../lib/supabase";
import { Card } from "../components/ui";

type Mode = "signin" | "signup";

export function SignInPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  useEffect(() => {
    if (user) nav("/", { replace: true });
  }, [user, nav]);

  if (!authConfigured) {
    return (
      <Card title="Sign in">
        <p className="text-sm text-ink-2">
          This deployment has no account service configured, so TradeGrade runs local-only: your data stays in this
          browser. The README explains how to connect a Supabase project to enable sign-in and sync.
        </p>
      </Card>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: "err" });
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    run(async () => {
      if (!email.trim() || !password) throw new Error("Email and password are required.");
      if (mode === "signin") {
        await signInWithPassword(email.trim(), password);
      } else {
        if (password.length < 8) throw new Error("Use at least 8 characters for the password.");
        const r = await signUp(email.trim(), password);
        if (r === "confirm-email") setMsg({ text: "Check your inbox and click the confirmation link, then sign in.", tone: "ok" });
      }
    });

  return (
    <div className="mx-auto max-w-md space-y-4 py-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{mode === "signin" ? "Sign in" : "Create your account"}</h2>
        <p className="mt-1 text-sm text-ink-2">
          Your trades, journal and attachments sync to your account and follow you to any device.
        </p>
      </div>

      <Card>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="block text-sm">
            <span className="text-ink-2">Email</span>
            <input
              type="email"
              autoComplete="email"
              className="input mt-1 w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-2">Password</span>
            <input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="input mt-1 w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "signup" ? 8 : undefined}
            />
          </label>
          <button type="submit" className="btn btn-accent w-full" disabled={busy}>
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-ink-3">
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>

        <div className="space-y-2">
          <button className="btn w-full" disabled={busy} onClick={() => void run(signInWithGoogle)}>
            Continue with Google
          </button>
          <button
            className="btn w-full"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (!email.trim()) throw new Error("Enter your email first.");
                await sendMagicLink(email.trim());
                setMsg({ text: "Magic link sent. Open it on this device to sign in.", tone: "ok" });
              })
            }
          >
            Email me a sign-in link
          </button>
        </div>

        {msg && <div className={`mt-3 text-sm ${msg.tone === "ok" ? "text-profit" : "text-loss"}`}>{msg.text}</div>}

        <div className="mt-4 flex items-center justify-between text-xs text-ink-3">
          <button className="underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
          {mode === "signin" && (
            <button
              className="underline"
              onClick={() =>
                void run(async () => {
                  if (!email.trim()) throw new Error("Enter your email first.");
                  await resetPassword(email.trim());
                  setMsg({ text: "Password reset email sent.", tone: "ok" });
                })
              }
            >
              Forgot password?
            </button>
          )}
        </div>
      </Card>

      <p className="text-center text-xs text-ink-3">
        Prefer not to sign in? Everything still works locally in this browser; use the Import page's backup for safety.
      </p>
    </div>
  );
}
