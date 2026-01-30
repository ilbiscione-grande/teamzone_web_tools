"use client";

import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "@/state/useProjectStore";
import { can, getPlanLimits } from "@/utils/plan";
import { supabase } from "@/utils/supabaseClient";

type PlanModalProps = {
  open: boolean;
  onClose: () => void;
};

const formatLimit = (value: number) => (Number.isFinite(value) ? value : "inf");

const planDescriptions = {
  FREE: [
    "One project, two boards",
    "No saving or export",
    "Ads enabled",
  ],
  AUTH: [
    "One project, two boards",
    "Save & resume locally",
    "Ad-free",
  ],
  PAID: [
    "Unlimited projects & boards",
    "Export, import & video",
    "Custom formations + squads",
    "Board sharing + comments",
  ],
} as const;

export default function PlanModal({ open, onClose }: PlanModalProps) {
  const plan = useProjectStore((state) => state.plan);
  const authUser = useProjectStore((state) => state.authUser);
  const clearAuthUser = useProjectStore((state) => state.clearAuthUser);
  const setPlan = useProjectStore((state) => state.setPlan);
  const index = useProjectStore((state) => state.index);
  const project = useProjectStore((state) => state.project);
  const limits = useMemo(() => getPlanLimits(plan), [plan]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const canSignIn = email.trim().length > 0;
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState<null | "signin" | "signup" | "magic">(
    null
  );
  const [priceInfo, setPriceInfo] = useState<{
    unit_amount: number | null;
    currency: string;
    recurring: string | null;
  } | null>(null);
  const [priceLocale, setPriceLocale] = useState("sv-SE");
  const projectCount = new Set(
    [...index.map((item) => item.id), project?.id].filter(Boolean)
  ).size;
  const boardCount = project?.boards.length ?? 0;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setPriceLocale(window.navigator.language || "sv-SE");
  }, []);

  useEffect(() => {
    fetch("/api/stripe/price")
      .then((response) => response.json())
      .then((data) => {
        if (data?.currency) {
          setPriceInfo(data);
        }
      })
      .catch(() => {
        setPriceInfo(null);
      });
  }, []);

  const formattedPrice = useMemo(() => {
    if (!priceInfo || priceInfo.unit_amount === null) {
      return null;
    }
    try {
      return new Intl.NumberFormat(priceLocale, {
        style: "currency",
        currency: priceInfo.currency.toUpperCase(),
      }).format(priceInfo.unit_amount / 100);
    } catch {
      return `${priceInfo.unit_amount / 100} ${priceInfo.currency.toUpperCase()}`;
    }
  }, [priceInfo, priceLocale]);

  const intervalLabel =
    priceInfo?.recurring === "year"
      ? "year"
      : priceInfo?.recurring === "week"
      ? "week"
      : priceInfo?.recurring === "day"
      ? "day"
      : "month";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (checkout === "success") {
      setStatus("Payment successful. Your plan will update shortly.");
      params.delete("checkout");
      const nextUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", nextUrl);
    } else if (checkout === "cancel") {
      setStatus("Checkout canceled.");
      params.delete("checkout");
      const nextUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", nextUrl);
    }
  }, []);

  if (!open) {
    return null;
  }

  const onSignIn = () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!supabase || !trimmedEmail || !password.trim()) {
      return;
    }
    setStatus(null);
    setAuthBusy("signin");
    supabase.auth
      .signInWithPassword({ email: trimmedEmail, password: password.trim() })
      .then(({ error }) => {
        if (error) {
          setStatus(error.message);
          setAuthBusy(null);
          return;
        }
        setEmail("");
        setPassword("");
        setName("");
        setStatus("Signed in.");
        setAuthBusy(null);
        onClose();
      })
      .catch(() => {
        setStatus("Unable to sign in.");
        setAuthBusy(null);
      });
  };

  const onSignUp = () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!supabase || !trimmedEmail || !password.trim()) {
      return;
    }
    setStatus(null);
    setAuthBusy("signup");
    supabase.auth
      .signUp({
        email: trimmedEmail,
        password: password.trim(),
        options: {
          data: {
            full_name: name.trim() || trimmedEmail.split("@")[0],
          },
        },
      })
      .then(({ error }) => {
        if (error) {
          setStatus(error.message);
          setAuthBusy(null);
          return;
        }
        setStatus("Account created. Check your email to confirm.");
        setAuthBusy(null);
      })
      .catch(() => {
        setStatus("Unable to create account.");
        setAuthBusy(null);
      });
  };

  const onMagicLink = () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!supabase || !trimmedEmail) {
      return;
    }
    setStatus(null);
    setAuthBusy("magic");
    supabase.auth
      .signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: window.location.origin,
        },
      })
      .then(({ error }) => {
        if (error) {
          setStatus(error.message);
          setAuthBusy(null);
          return;
        }
        setStatus("Magic link sent. Check your email.");
        setAuthBusy(null);
      })
      .catch(() => {
        setStatus("Unable to send magic link.");
        setAuthBusy(null);
      });
  };

  const onGoogle = () => {
    if (!supabase) {
      return;
    }
    setStatus(null);
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const onSwitchFree = () => {
    clearAuthUser();
    onClose();
  };

  const onCheckout = async () => {
    if (!supabase) {
      return;
    }
    setUpgradeBusy(true);
    setStatus(null);
    const { data, error } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (error || !accessToken) {
      setStatus("Please sign in before upgrading.");
      setUpgradeBusy(false);
      return;
    }
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });
    const result = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !result.url) {
      setStatus(result.error ?? "Checkout failed.");
      setUpgradeBusy(false);
      return;
    }
    window.location.href = result.url;
  };

  const onPortal = async () => {
    if (!supabase) {
      return;
    }
    setUpgradeBusy(true);
    setStatus(null);
    const { data, error } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (error || !accessToken) {
      setStatus("Please sign in before managing billing.");
      setUpgradeBusy(false);
      return;
    }
    const response = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });
    const result = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !result.url) {
      setStatus(result.error ?? "Unable to open billing portal.");
      setUpgradeBusy(false);
      return;
    }
    window.location.href = result.url;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <div
        className="w-full max-w-5xl max-h-[85vh] overflow-y-auto rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink-0)] shadow-2xl shadow-black/40"
        data-scrollable
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="display-font text-2xl text-[var(--accent-0)]">
              Account & Plans
            </h2>
            <p className="text-xs text-[var(--ink-1)]">
              Manage your plan and billing. Sign in to save and sync across
              devices.
            </p>
            <p className="mt-2 text-[11px] text-[var(--ink-1)]">
              Beta notice: this app is still in active development and may
              contain bugs or missing features.
            </p>
          </div>
          <button
            className="rounded-full border border-[var(--line)] px-3 py-1 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-4 text-xs text-[var(--ink-1)]">
              <p className="mb-2 text-[11px] uppercase">Plan</p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] uppercase tracking-widest">
                  {plan}
                </div>
                {authUser && (
                  <div className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--accent-2)]">
                    {authUser.name}
                  </div>
                )}
                {!can(plan, "project.save") && (
                  <div className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--accent-1)]">
                    Free mode - no save
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-4">
              <p className="mb-3 text-[11px] uppercase">Account</p>
              {authUser ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-[var(--ink-0)]">{authUser.name}</p>
                    <p className="text-xs text-[var(--ink-1)]">
                      {authUser.email}
                    </p>
                  </div>
                  <button
                    className="rounded-full border border-[var(--line)] px-4 py-2 text-xs hover:border-[var(--accent-1)] hover:text-[var(--accent-1)]"
                    onClick={() => {
                      if (supabase) {
                        supabase.auth.signOut();
                      }
                      onSwitchFree();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    className="h-10 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                    placeholder="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <input
                    className="h-10 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <input
                    className="h-10 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink-0)]"
                    placeholder="Name (optional)"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <div className="grid gap-2">
                    <button
                      className="w-full rounded-full bg-[var(--accent-0)] px-4 py-2 text-xs font-semibold text-black transition hover:brightness-110"
                      onClick={onSignIn}
                      disabled={
                        !canSignIn || !password.trim() || !supabase || !!authBusy
                      }
                    >
                      {authBusy === "signin" ? "Signing in..." : "Sign in"}
                    </button>
                    <button
                      className="w-full rounded-full border border-[var(--line)] px-4 py-2 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                      onClick={onMagicLink}
                      disabled={!canSignIn || !supabase || !!authBusy}
                    >
                      {authBusy === "magic" ? "Sending..." : "Send magic link"}
                    </button>
                  </div>
                  {status ? (
                    <p className="text-[11px] text-[var(--accent-1)]">
                      {status}
                    </p>
                  ) : null}
                  {!supabase ? (
                    <p className="text-[11px] text-[var(--accent-1)]">
                      Supabase env vars missing. Add `NEXT_PUBLIC_SUPABASE_URL`
                      and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/70 p-4 text-xs text-[var(--ink-1)]">
              <p className="mb-2 text-[11px] uppercase">Current usage</p>
              <div className="flex items-center justify-between">
                <span>Projects used</span>
                <span>{projectCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Boards used</span>
                <span>{boardCount}</span>
              </div>
              <div className="my-2 h-px bg-[var(--line)]" />
              <div className="flex items-center justify-between">
                <span>Projects allowed</span>
                <span>{formatLimit(limits.maxProjects)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Boards allowed</span>
                <span>{formatLimit(limits.maxBoards)}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,1.15fr)]">
            {(["FREE", "AUTH", "PAID"] as const).map((tier) => {
              const isCurrent = plan === tier;
              return (
                <div
                  key={tier}
                  className={`relative flex h-full flex-col rounded-2xl border p-4 text-xs ${
                    isCurrent
                      ? "border-[var(--accent-0)] bg-[var(--panel-2)]"
                      : "border-[var(--line)] bg-[var(--panel)]/70"
                  } ${tier === "PAID" ? "overflow-hidden" : ""}`}
                >
                  {tier === "PAID" && (
                    <div className="absolute right-[-48px] top-[10px] z-10 w-48 rotate-45 bg-[var(--accent-0)] py-1 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-black shadow-lg shadow-black/30">
                      <span className="inline-block translate-x-1">
                        50% Off
                      </span>
                    </div>
                  )}
                  <p className="display-font text-lg text-[var(--ink-0)]">
                    {tier}
                  </p>
                  {tier === "PAID" && (
                    <div className="mt-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/70 px-3 py-2 text-[11px]">
                      <p className="text-[11px] uppercase text-[var(--ink-1)]">
                        Price
                      </p>
                      <p className="mt-1 text-[var(--ink-0)]">
                        {formattedPrice
                          ? `${formattedPrice}/${intervalLabel}`
                          : "Loading price..."}
                      </p>
                      {priceInfo && (
                        <p className="mt-1 text-[10px] text-[var(--ink-1)]">
                          Charged in {priceInfo.currency.toUpperCase()}.
                        </p>
                      )}
                      <p className="mt-2 text-[10px] text-[var(--ink-1)]">
                        Early-bird beta price. Doubles once beta ends.
                      </p>
                    </div>
                  )}
                  <ul className="mt-2 flex-1 space-y-2 text-[var(--ink-1)]">
                    {planDescriptions[tier].map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                  {tier === "FREE" && (
                    <button
                      className="mt-3 rounded-full border border-[var(--line)] px-3 py-2 text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                      onClick={onSwitchFree}
                      disabled={isCurrent}
                    >
                      {isCurrent ? "Current plan" : "Switch to Free"}
                    </button>
                  )}
                  {tier === "AUTH" && (
                    <div className="mt-3 rounded-full border border-[var(--line)] px-3 py-2 text-center text-[11px]">
                      {authUser ? "Signed in" : "Sign in to enable"}
                    </div>
                  )}
                  {tier === "PAID" && (
                    <div className="mt-3 grid gap-2">
                      <button
                        className="rounded-full border border-[var(--line)] px-3 py-2 text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                        onClick={authUser ? onCheckout : undefined}
                        disabled={isCurrent || upgradeBusy || !authUser}
                        title={
                          authUser
                            ? "Upgrade with Stripe."
                            : "Sign in to upgrade."
                        }
                      >
                        {isCurrent
                          ? "Current plan"
                          : authUser
                          ? upgradeBusy
                            ? "Opening Stripe..."
                            : "Upgrade"
                          : "Sign in to upgrade"}
                      </button>
                      <button
                        className="rounded-full border border-[var(--line)] px-3 py-2 text-[11px] hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                        onClick={authUser ? onPortal : undefined}
                        disabled={!authUser || upgradeBusy}
                        title={
                          authUser
                            ? "Manage billing in Stripe."
                            : "Sign in to manage billing."
                        }
                      >
                        Manage billing
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
