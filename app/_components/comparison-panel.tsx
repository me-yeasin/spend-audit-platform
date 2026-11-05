"use client";

import { formatCost, formatCostSpoken } from "@/lib/format";
import type { ChargeChange, MonthComparison } from "@/lib/history";

export type StripMonth = {
  month: string;
  label: string;
  total: number;
};

type ComparisonPanelProps = {
  comparison: MonthComparison;
  strip: StripMonth[];
  monthsOnFile: number;
  onForget: () => void;
};

function deltaOf(amount: number): string {
  return `${amount < 0 ? "-" : "+"}${formatCost(Math.abs(amount))}`;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

/**
 * One changed charge, spoken as a sentence.
 *
 * A bare "$123.40 to $126.10, +$2.70" reads as noise through a screen reader,
 * so the row carries its own plain sentence and the figures are hidden from it.
 */
function spokenRow(change: ChargeChange): string {
  const before = change.before === null ? null : formatCostSpoken(change.before);
  const after = change.after === null ? null : formatCostSpoken(change.after);

  if (change.before === null) {
    return `${change.name}, not charged in the earlier month, now ${after}, up ${after}.`;
  }
  if (change.after === null) {
    return `${change.name}, ${before}, no longer charged, down ${before}.`;
  }

  const moved = Math.round((change.after - change.before) * 100) / 100;
  const direction =
    moved > 0
      ? `up ${formatCostSpoken(moved)}`
      : moved < 0
        ? `down ${formatCostSpoken(-moved)}`
        : "unchanged";

  return `${change.name}, ${before}, now ${after}, ${direction}.`;
}

/**
 * What changed between the two newest months on file.
 *
 * One panel with two parts: the change list, then the history strip. It sits
 * directly under the headline because the two answer the same question at
 * different moments — what you pay, and what that did since last month.
 *
 * The promise it keeps: the change rows always add up to the difference between
 * the two months' totals (design/MONTHLY.md section 7).
 */
export default function ComparisonPanel({
  comparison,
  strip,
  monthsOnFile,
  onForget,
}: ComparisonPanelProps) {
  const { increased, decreased, added, stopped, unchanged, carried } = comparison;
  const moved = increased.length + decreased.length + added.length + stopped.length;
  const sameSet = added.length === 0 && stopped.length === 0;

  const deltaWords =
    comparison.delta > 0
      ? "more than"
      : comparison.delta < 0
        ? "less than"
        : "unchanged from";

  const deltaSpoken =
    comparison.delta === 0
      ? `no change from ${comparison.previousLabel}, which was ${formatCostSpoken(comparison.previousTotal)}`
      : `${comparison.delta > 0 ? "up" : "down"} ${formatCostSpoken(Math.abs(comparison.delta))} ${deltaWords} ${comparison.previousLabel}, which was ${formatCostSpoken(comparison.previousTotal)}`;

  const groups: { heading: string; rows: ChargeChange[] }[] = [
    { heading: "Increased", rows: increased },
    { heading: "Decreased", rows: decreased },
    { heading: "New", rows: added },
    { heading: "No longer charged", rows: stopped },
  ].filter((group) => group.rows.length > 0);

  const highest = Math.max(...strip.map((month) => month.total), 0);

  return (
    <section
      aria-labelledby="comparison-heading"
      data-comparison-panel
      className="mx-auto w-full max-w-[900px]"
    >
      <div className="rounded-[20px] border border-hairline bg-surface shadow-[0_1px_2px_rgba(18,18,15,0.04),0_18px_44px_-30px_rgba(18,18,15,0.28)]">
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          {/* The heading is the region's name, so it reads as one thing:
              what this panel is comparing against. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2
              id="comparison-heading"
              className="text-[13.5px] font-semibold tracking-[-0.01em] text-ink"
            >
              Compared with {comparison.previousLabel}
            </h2>
            {carried > 0 && (
              <p className="text-[10.5px] text-subtle">
                {sameSet ? "the same " : ""}
                {carried} {plural(carried, "charge")} in both months
              </p>
            )}
          </div>

          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            {comparison.currentLabel}
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span
              data-comparison-amount
              className="text-[20px] font-semibold leading-[1.1] tracking-[-0.02em] tabular-nums text-ink sm:text-[22px]"
            >
              {formatCost(comparison.currentTotal)}
            </span>
            <span className="text-[12px] text-subtle">per month</span>
          </p>

          {/* The amount is inside the sentence, not beside it: a bare "+$5.20"
              reads as a number with no meaning. */}
          <p data-comparison-delta className="mt-2 text-[12.5px] text-ink">
            <span aria-hidden="true" className="font-semibold tabular-nums">
              {comparison.delta === 0 ? "No change" : deltaOf(comparison.delta)}
            </span>{" "}
            <span aria-hidden="true">{deltaWords}</span>{" "}
            <span aria-hidden="true">{comparison.previousLabel}</span>
            <span aria-hidden="true" className="tabular-nums">
              {" "}
              ({formatCost(comparison.previousTotal)})
            </span>
            <span className="sr-only">{deltaSpoken}.</span>
          </p>

          {moved > 0 ? (
            <div className="mt-4">
              <ul className="flex flex-col gap-3">
                {groups.map((group) => (
                  <li key={group.heading}>
                    <h3 className="text-[9px] font-semibold uppercase tracking-[0.13em] text-muted">
                      {group.heading}
                    </h3>
                    <ul className="mt-1.5 flex flex-col">
                      {group.rows.map((change) => (
                        <li
                          key={change.key}
                          data-change-row={change.key}
                          className="flex items-baseline justify-between gap-3 border-b border-hairline/60 py-1.5 last:border-b-0"
                        >
                          <span className="sr-only">{spokenRow(change)}</span>
                          <span
                            aria-hidden="true"
                            data-change-name
                            className="min-w-0 truncate text-[12px] font-semibold text-ink"
                          >
                            {change.name}
                          </span>
                          <span
                            aria-hidden="true"
                            className="flex shrink-0 items-baseline gap-2.5 tabular-nums"
                          >
                            <span className="text-[11.5px] text-muted">
                              {change.before !== null && change.after !== null
                                ? `${formatCost(change.before)} → ${formatCost(change.after)}`
                                : formatCost(change.before ?? change.after ?? 0)}
                            </span>
                            <span
                              data-change-delta={change.difference}
                              className="text-[11.5px] font-semibold text-ink"
                            >
                              {deltaOf(change.difference)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>

              {unchanged > 0 && (
                <p className="mt-2.5 text-[10.5px] text-subtle">
                  {unchanged} {plural(unchanged, "charge")} unchanged.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-[10.5px] text-subtle">
              Nothing changed between these two months.
            </p>
          )}

          {strip.length > 0 && (
            <div
              data-comparison-strip
              className="mt-5 border-t border-hairline pt-4"
            >
              <h3 className="text-[9px] font-semibold uppercase tracking-[0.13em] text-muted">
                Months on file
              </h3>

              <div
                aria-hidden="true"
                className="mt-2.5 flex items-end gap-2 sm:gap-4"
              >
                {strip.map((month) => (
                  <div key={month.month} className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="h-7 flex items-end">
                      <span
                        className="w-full rounded-[2px] bg-ink/15"
                        style={{
                          height: `${Math.max(18, Math.round((month.total / (highest || 1)) * 100))}%`,
                        }}
                      />
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-1 flex gap-2 sm:gap-4">
                {strip.map((month) => (
                  <div
                    key={month.month}
                    data-comparison-month={month.month}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate text-[9.5px] font-semibold text-muted">
                      {month.label}
                    </p>
                    <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-ink">
                      {formatCost(month.total)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-hairline pt-3.5">
            <p className="text-[10px] text-subtle">
              {monthsOnFile} {plural(monthsOnFile, "month")} saved in this browser
            </p>
            <button
              type="button"
              onClick={onForget}
              data-forget-history
              className="text-[10.5px] text-muted underline decoration-hairline underline-offset-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Forget saved history
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
