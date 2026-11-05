import Link from "next/link";
import BrandMark from "./brand-mark";
import { SettingsIcon } from "./icons";

type SiteHeaderProps = {
  /** Marks the settings control as the current page. */
  settingsActive?: boolean;
};

export default function SiteHeader({ settingsActive = false }: SiteHeaderProps) {
  return (
    <header className="border-b border-hairline bg-surface">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-5 sm:h-[72px] sm:px-8">
        <Link href="/" className="rounded-md" aria-label="Spend Audit — home">
          <span className="flex items-center gap-2.5 sm:gap-3">
            <BrandMark className="size-6 shrink-0 sm:size-[26px]" />
            <span className="text-[14px] font-semibold tracking-[-0.01em] text-ink sm:text-[15px]">
              Spend Audit
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <p className="flex items-center gap-1.5 text-[12px] text-muted sm:gap-2 sm:text-[12.5px]">
            <span className="hidden sm:inline">Runs locally · no account</span>
            <span className="sm:hidden">100% local</span>
          </p>

          <span aria-hidden="true" className="hidden h-4 w-px bg-hairline sm:block" />

          <Link
            href="/settings"
            aria-label="AI provider settings"
            aria-current={settingsActive ? "page" : undefined}
            className={[
              "grid size-9 place-items-center rounded-[9px] transition-colors",
              settingsActive
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-[#f2f1ec] hover:text-ink",
            ].join(" ")}
          >
            <SettingsIcon />
          </Link>
        </div>
      </div>
    </header>
  );
}
