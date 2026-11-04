export default function SiteFooter() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto w-full max-w-[900px] px-5 py-8 text-center sm:px-8">
        <p className="text-[11.5px] leading-relaxed text-subtle">
          <span className="block sm:inline">Spend Audit</span>
          <span aria-hidden="true" className="hidden px-1.5 text-subtle/50 sm:inline">
            ·
          </span>
          <span className="block sm:inline">runs entirely in your browser</span>
          <span aria-hidden="true" className="hidden px-1.5 text-subtle/50 sm:inline">
            ·
          </span>
          <span className="block sm:inline">
            no account, no cloud, no tracking
          </span>
        </p>
      </div>
    </footer>
  );
}
