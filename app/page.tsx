import Link from "next/link";

function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="2.1"
        y="5.1"
        width="7.8"
        height="6.2"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M4 5.1V3.9a2 2 0 1 1 4 0v1.2"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5 sm:gap-3">
      <span
        className="grid size-6 place-items-center rounded-[8px] bg-accent text-[13px] font-semibold leading-none text-white sm:size-[26px]"
        aria-hidden="true"
      >
        S
      </span>
      <span className="text-[14px] font-semibold tracking-[-0.01em] text-ink sm:text-[15px]">
        Spend Audit
      </span>
    </span>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* ---------------------------------------------------------- top bar */}
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-5 sm:h-[72px] sm:px-8">
          <Link href="/" className="rounded-md" aria-label="Spend Audit — home">
            <Wordmark />
          </Link>

          <p className="flex items-center gap-1.5 text-[12px] text-muted sm:gap-2 sm:text-[12.5px]">
            <LockIcon className="shrink-0" />
            <span className="hidden sm:inline">Runs locally · no account</span>
            <span className="sm:hidden">100% local</span>
          </p>
        </div>
      </header>

      {/* ------------------------------------------------------------- hero */}
      <main className="flex flex-1 flex-col items-center px-5 pt-14 pb-20 sm:px-8 sm:pt-20 sm:pb-24 lg:pt-[88px]">
        <section className="w-full max-w-[820px] text-center">
          <p className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-muted sm:text-[11px] sm:tracking-[0.22em]">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Monthly spend audit
          </p>

          <h1 className="mt-5 text-balance text-[clamp(2.25rem,6.4vw+0.4rem,3.25rem)] font-semibold leading-[1.07] tracking-[-0.028em] text-ink sm:mt-6">
            See what you&rsquo;re quietly paying for every month.
          </h1>

          <p className="mx-auto mt-5 max-w-[32rem] text-pretty text-[15px] leading-[1.7] text-muted sm:mt-6 sm:text-base">
            Drop in your bank statement CSV. We surface every recurring charge,
            total it up, and flag the ones nobody owns.
          </p>
        </section>
      </main>
    </div>
  );
}
