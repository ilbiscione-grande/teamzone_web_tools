import Link from "next/link";
import { webtoolsApps, webtoolsPrinciples } from "@/config/webtools";

const statusClasses: Record<(typeof webtoolsApps)[number]["status"], string> = {
  live: "border-[#37b879]/30 bg-[#37b879]/12 text-[#8ae0b6]",
  building: "border-[#f9bf4a]/30 bg-[#f9bf4a]/12 text-[#ffd777]",
  planned: "border-[#f06d4f]/30 bg-[#f06d4f]/12 text-[#ff9f86]",
};

export default function Home() {
  return (
    <main className="max-h-screen overflow-y-auto">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 pb-10 pt-6 sm:px-8 lg:px-10">
        <div className="rounded-full border border-[var(--line)] bg-[var(--panel)]/75 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-[var(--ink-1)] backdrop-blur w-fit">
          Webtools
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.8fr)] lg:items-start">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-[var(--accent-2)]">
              Multi-app platform
            </p>
            <h1 className="display-font mt-4 max-w-4xl text-5xl leading-none text-[var(--ink-0)] sm:text-6xl lg:text-7xl">
              One account for several sports tools.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--ink-1)] sm:text-lg">
              Webtools is the shared front door for focused apps like
              Tacticsboard, IUP, and the next generation of smaller coaching
              tools. The account should be shared. Access should be consistent.
              Payment should stay app-specific.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/tacticsboard"
                className="rounded-full bg-[var(--accent-0)] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110"
              >
                Open Tacticsboard
              </Link>
              <a
                href="#platform-model"
                className="rounded-full border border-[var(--line)] bg-[var(--panel)]/70 px-5 py-3 text-sm text-[var(--ink-0)] transition hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
              >
                See platform model
              </a>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--panel)]/82 p-5 shadow-2xl shadow-black/30">
            <div className="absolute inset-x-6 top-0 h-24 rounded-b-full bg-[var(--accent-0)]/12 blur-3xl" />
            <div className="relative">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-1)]">
                Platform direction
              </p>
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/90 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--ink-1)]">
                    Shared identity
                  </p>
                  <p className="mt-2 text-sm text-[var(--ink-0)]">
                    Same login, same user profile, same team and club context
                    across all Webtools apps.
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/90 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--ink-1)]">
                    Shared tier language
                  </p>
                  <p className="mt-2 text-sm text-[var(--ink-0)]">
                    A consistent tier system across the platform, without
                    forcing every user to buy every app.
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/90 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--ink-1)]">
                    App-specific billing
                  </p>
                  <p className="mt-2 text-sm text-[var(--ink-0)]">
                    Subscribe to Tacticsboard only, IUP only, or combine several
                    products under one customer account.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-[var(--accent-1)]">
                Apps
              </p>
              <h2 className="display-font mt-3 text-3xl text-[var(--ink-0)] sm:text-4xl">
                Focused tools under one roof.
              </h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {webtoolsApps.map((app) => {
              const card = (
                <div
                  className="group relative h-full overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-[var(--panel)]/80 p-5 transition hover:-translate-y-1 hover:border-white/20"
                  style={{
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 60px color-mix(in srgb, ${app.accent} 14%, transparent)`,
                  }}
                >
                  <div
                    className="absolute right-[-28px] top-[-28px] h-28 w-28 rounded-full blur-2xl"
                    style={{ backgroundColor: `${app.accent}22` }}
                  />
                  <div className="relative flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="display-font text-2xl text-[var(--ink-0)]">
                          {app.name}
                        </p>
                        <p className="mt-1 text-sm text-[var(--ink-1)]">
                          {app.strapline}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${statusClasses[app.status]}`}
                      >
                        {app.availabilityLabel}
                      </span>
                    </div>
                    <p className="mt-6 flex-1 text-sm leading-6 text-[var(--ink-1)]">
                      {app.description}
                    </p>
                    <div className="mt-6">
                      {app.href ? (
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-0)] transition group-hover:text-[var(--accent-0)]">
                          Open app
                          <span aria-hidden>+</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-1)]">
                          Not live yet
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );

              return app.href ? (
                <Link key={app.slug} href={app.href} className="block">
                  {card}
                </Link>
              ) : (
                <div key={app.slug}>{card}</div>
              );
            })}
          </div>
        </section>

        <section
          id="platform-model"
          className="mt-12 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
        >
          <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--panel)]/80 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--accent-2)]">
              Billing model
            </p>
            <h2 className="display-font mt-3 text-3xl text-[var(--ink-0)]">
              Shared platform, separate subscriptions.
            </h2>
            <div className="mt-6 grid gap-3">
              {webtoolsPrinciples.map((principle) => (
                <div
                  key={principle}
                  className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/80 p-4 text-sm leading-6 text-[var(--ink-1)]"
                >
                  {principle}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--panel)]/80 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--accent-0)]">
              Today
            </p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--ink-1)]">
              <p>
                Tacticsboard is the active app in the platform today and keeps
                using the existing account and billing flow.
              </p>
              <p>
                This landing page establishes the structure for Webtools as the
                umbrella brand so more tools can be added without reworking the
                front door later.
              </p>
              <p>
                Next step for product logic is to evolve the current single-app
                paid plan into app-specific entitlements on top of the shared
                user account.
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
