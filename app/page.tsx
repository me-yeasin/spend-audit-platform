import Link from "next/link";
import HomeScreen from "./_components/home-screen";
import SiteFooter from "./_components/site-footer";

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
            <span className="hidden sm:inline">Runs locally · no account</span>
            <span className="sm:hidden">100% local</span>
          </p>
        </div>
      </header>

      <HomeScreen />

      <SiteFooter />
    </div>
  );
}