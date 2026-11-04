const steps = [
  {
    n: "1",
    title: "Import the CSV",
    body: "Drop the file straight from online banking.",
  },
  {
    n: "2",
    title: "See the total",
    body: "One number: monthly recurring cost.",
  },
  {
    n: "3",
    title: "Assign owners",
    body: "Flag and clear anything unowned.",
  },
];

export default function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works" className="w-full">
      <h2 id="how-it-works" className="sr-only">
        How it works
      </h2>

      <ol className="mx-auto grid w-full max-w-[760px] grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {steps.map((step) => (
          <li
            key={step.n}
            className="rounded-[14px] border border-hairline bg-surface px-5 py-4.5 sm:py-5"
          >
            <div className="flex items-baseline gap-2.5">
              <span
                className="text-[11px] font-semibold tabular-nums text-accent"
                aria-hidden="true"
              >
                {step.n}
              </span>
              <h3 className="text-[13.5px] font-semibold tracking-[-0.005em] text-ink">
                {step.title}
              </h3>
            </div>
            <p className="mt-1.5 text-[11.5px] leading-[1.5] text-muted">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
