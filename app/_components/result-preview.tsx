const unowned = [
  { name: "Adobe Creative Cloud", meta: "Monthly · Software", amount: "$59.99" },
  { name: "Notion Plus", meta: "Monthly · Software", amount: "$19.00" },
  { name: "Figma Professional", meta: "Monthly · Software", amount: "$15.00" },
];

export default function ResultPreview() {
  return (
    <section aria-labelledby="preview-heading" className="w-full">
      <div className="mx-auto w-full max-w-[900px]">
        <div className="mb-3 flex items-end justify-between gap-4 px-1">
          <h2
            id="preview-heading"
            className="text-[13px] font-semibold tracking-[-0.005em] text-ink-soft"
          >
            What you&rsquo;ll see after import
          </h2>
          <p className="text-[11px] text-subtle">Example data</p>
        </div>

        <figure
          className="overflow-hidden rounded-[20px] border border-hairline bg-surface shadow-[0_1px_2px_rgba(18,18,15,0.04),0_18px_44px_-30px_rgba(18,18,15,0.28)]"
        >
          <div className="flex flex-col lg:flex-row">
            {/* ------------------------------------------------ total */}
            <div className="flex-1 px-6 py-7 sm:px-8 sm:py-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                Total monthly recurring
              </p>

              <p className="mt-2.5 text-[clamp(2.25rem,7vw,2.75rem)] font-semibold leading-none tracking-[-0.025em] tabular-nums text-ink">
                $248.60
              </p>

              <p className="mt-3 text-[12.5px] text-muted">
                across 9 recurring charges
              </p>

              <dl className="mt-7 border-t border-hairline pt-4 text-[11.5px]">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-subtle">Top group</dt>
                  <dd className="font-medium text-ink-soft">Subscriptions</dd>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <dt className="text-subtle">Its monthly subtotal</dt>
                  <dd className="font-medium tabular-nums text-ink-soft">
                    $118.97
                  </dd>
                </div>
              </dl>
            </div>

            {/* ---------------------------------------------- unowned */}
            <div className="border-t border-hairline px-6 py-7 sm:px-8 sm:py-8 lg:w-[392px] lg:shrink-0 lg:border-t-0 lg:border-l">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-flag">
                  Needs an owner
                </h3>
                <span className="rounded-full bg-flag-soft px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-flag">
                  {unowned.length}
                </span>
              </div>

              <ul className="mt-4 divide-y divide-hairline">
                {unowned.map((charge) => (
                  <li
                    key={charge.name}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-flag"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {charge.name}
                        </p>
                        <p className="mt-0.5 truncate text-[10.5px] text-subtle">
                          {charge.meta}
                        </p>
                      </div>
                    </div>
                    <p className="shrink-0 text-[13px] tabular-nums text-ink-soft">
                      {charge.amount}
                    </p>
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-[11px] leading-[1.5] text-subtle">
                Unowned charges stay here until someone is assigned.
              </p>
            </div>
          </div>

          <figcaption className="sr-only">
            Example data: total monthly recurring cost of $248.60 across nine
            charges, with three charges that still need an owner.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
