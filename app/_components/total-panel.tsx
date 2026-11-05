"use client";

import { formatCost } from "../../lib/format";
import type { RecurringTotal } from "../../lib/total";

/**
 * Why there is nothing to total, when there is nothing.
 *
 * The two causes are different and the user needs to know which one they are
 * looking at: not enough months yet, or enough months and nothing repeats.
 */
export type TotalEmpty =
  | { kind: "history"; months: number; label: string }
  | { kind: "nothing" };

type TotalPanelProps = {
  total: RecurringTotal;
  empty?: TotalEmpty | null;
};

/**
 * The headline of the app.
 *
 * One number, in the largest type on the page: what the repeating charges
 * come to every month. It is the sum of the amounts shown in the recurring
 * charges list below it, so the two always agree.
 */
export default function TotalPanel({ total, empty }: TotalPanelProps) {
  const hasCharges = total.charges > 0;

  return (
    <section
      className="mx-auto w-full max-w-[900px]"
      aria-labelledby="total-heading"
      data-total-panel
    >
      {/* No live region here on purpose: the workspace announces the figure
          from a region that is on the page before the file is read. A live
          region mounted already filled in is never announced. */}

      <div className="rounded-[20px] border border-hairline bg-surface shadow-[0_1px_2px_rgba(18,18,15,0.04),0_18px_44px_-30px_rgba(18,18,15,0.28)]">
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <h2
            id="total-heading"
            className="text-[12px] font-medium text-muted"
          >
            Total monthly recurring cost
          </h2>

          {hasCharges ? (
            <>
              <p className="mt-1.5 flex items-baseline gap-2">
                <span
                  data-total-amount
                  className="text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] tabular-nums text-ink sm:text-[44px]"
                >
                  {formatCost(total.monthly)}
                </span>
                <span className="text-[12.5px] text-subtle sm:text-[13px]">per month</span>
              </p>

              {/* Two facts. On a narrow screen they sit on their own lines,
                  so the second one never breaks across a phrase. */}
              <p className="mt-2.5 flex flex-col text-[12px] text-subtle sm:flex-row">
                <span>
                  across {total.charges} recurring{" "}
                  {total.charges === 1 ? "charge" : "charges"}
                </span>
                {total.unownedCharges > 0 && total.unownedCharges < total.charges && (
                  <span className="text-flag">
                    <span className="hidden sm:inline"> · </span>
                    {formatCost(total.unownedMonthly)} per month has no owner
                  </span>
                )}
              </p>
            </>
          ) : (
            <>
              <p
                data-total-amount
                className="mt-1.5 text-[24px] font-semibold tracking-[-0.01em] text-ink-soft sm:text-[28px]"
              >
                {empty?.kind === "nothing"
                  ? "No recurring charges found"
                  : "No recurring charges yet"}
              </p>
              <p className="mt-2.5 text-[12px] text-subtle">
                {empty?.kind === "nothing"
                  ? "Nothing repeats in this history yet, so there is nothing to total."
                  : empty?.months === 1
                    ? `One month is not enough to tell a repeat from a one-off. ${empty.label} is saved — two more months and this becomes a number.`
                    : "Two months are on file. One more month of payments and we can name your recurring charges. Nothing here is wrong."}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
