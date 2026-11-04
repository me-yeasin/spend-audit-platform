"use client";

import { formatCost } from "@/lib/format";
import type { RecurringTotal } from "@/lib/total";

type TotalPanelProps = {
  total: RecurringTotal;
};

/**
 * The headline of the app.
 *
 * One number, in the largest type on the page: what the repeating charges
 * come to every month. It is the sum of the amounts shown in the recurring
 * charges list below it, so the two always agree.
 */
export default function TotalPanel({ total }: TotalPanelProps) {
  const hasCharges = total.charges > 0;

  return (
    <section
      className="mx-auto w-full max-w-[900px]"
      aria-labelledby="total-heading"
      data-total-panel
    >
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {hasCharges
          ? `Total monthly recurring cost: ${formatCost(total.monthly)} per month, across ${total.charges} recurring ${total.charges === 1 ? "charge" : "charges"}.`
          : "No recurring charges found."}
      </div>

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
                  className="text-[32px] font-semibold tracking-[-0.02em] tabular-nums text-ink sm:text-[44px] sm:leading-[1.1]"
                >
                  {formatCost(total.monthly)}
                </span>
                <span className="text-[12.5px] text-subtle sm:text-[13px]">per month</span>
              </p>

              <p className="mt-2.5 text-[12px] text-subtle">
                across {total.charges} recurring {total.charges === 1 ? "charge" : "charges"}
                {total.unownedCharges > 0 && (
                  <>
                    {" · "}
                    <span className="text-flag">
                      {formatCost(total.unownedMonthly)} per month has no owner
                    </span>
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <p
                data-total-amount
                className="mt-1.5 text-[24px] font-semibold tracking-[-0.01em] text-ink-soft sm:text-[28px]"
              >
                No recurring charges found
              </p>
              <p className="mt-2.5 text-[12px] text-subtle">
                Nothing repeats in this statement yet, so there is nothing to total.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
