"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const checkSession = async () => {
      if (!supabase) {
        if (!cancelled) {
          setStatus("Supabase is not configured.");
          setReady(true);
        }
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        if (!data.session?.user) {
          setStatus(
            "No recovery session found. Open the reset link from your email again."
          );
        }
        setReady(true);
      }
    };
    void checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = useMemo(() => {
    return (
      !busy &&
      password.trim().length >= 8 &&
      confirmPassword.trim().length > 0 &&
      password === confirmPassword
    );
  }, [busy, confirmPassword, password]);

  const onUpdatePassword = async () => {
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }
    if (!canSubmit) {
      if (password.trim().length < 8) {
        setStatus("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setStatus("Passwords do not match.");
        return;
      }
      return;
    }
    setBusy(true);
    setStatus(null);
    const { error } = await supabase.auth.updateUser({
      password: password.trim(),
    });
    if (error) {
      setStatus(error.message);
      setBusy(false);
      return;
    }
    setStatus("Password updated. You can now continue in the app.");
    setBusy(false);
  };

  return (
    <main className="min-h-[100dvh] bg-[var(--bg)] px-4 py-8 text-[var(--ink-0)]">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-xl shadow-black/30">
        <h1 className="display-font text-2xl text-[var(--accent-0)]">
          Reset Password
        </h1>
        <p className="mt-2 text-xs text-[var(--ink-1)]">
          Choose a new password for your account.
        </p>

        <div className="mt-5 space-y-3">
          <div className="relative">
            <input
              className="h-10 w-full rounded-full border border-[var(--line)] bg-transparent px-3 pr-12 text-xs text-[var(--ink-0)]"
              placeholder="New password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={!ready || busy}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-[var(--line)] bg-[var(--panel)]/90 p-1.5 text-[var(--ink-1)] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              disabled={!ready || busy}
            >
              {showPassword ? (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a2 2 0 1 0 2.8 2.8" />
                  <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.6 0 9.6 4.7 10 5.2a.7.7 0 0 1 0 .9 17 17 0 0 1-4 3.7" />
                  <path d="M6.6 6.6A16.9 16.9 0 0 0 2 9.2a.7.7 0 0 0 0 .9C2.4 10.6 6.4 15.3 12 15.3c1.4 0 2.7-.3 3.9-.8" />
                </svg>
              ) : (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                  <circle cx="12" cy="12" r="2.5" />
                </svg>
              )}
            </button>
          </div>
          <input
            className="h-10 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
            placeholder="Confirm new password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={!ready || busy}
          />
          <button
            className="w-full rounded-full bg-[var(--accent-0)] px-4 py-2 text-xs font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onUpdatePassword}
            disabled={!ready || !canSubmit}
          >
            {busy ? "Updating..." : "Update password"}
          </button>
          {status ? (
            <p className="text-[11px] text-[var(--accent-1)]">{status}</p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

