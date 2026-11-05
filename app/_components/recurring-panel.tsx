"use client";

import { useState } from "react";
import { formatAmount, formatCost, formatDate } from "../../lib/format";
import type { RecurringGroup } from "../../lib/detect-recurring";
import { sumMonthly } from "../../lib/total";
import { ChevronIcon } from "./icons";
import OwnerControl from "./owner-control";

type RecurringPanelProps = {
  groups: RecurringGroup[];
  /** Every payment on file across the saved months, for the footer line. */
  totalTransactions: number;
  /** How many calendar months are on file, for the footer line. */
  monthsOnFile: number;
  /** Names already in use, offered as suggestions. */
  roster: string[];
  /** The owner of a charge, or null when nobody owns it. */
  ownerOf: (key: string) => string | null;
  onAssign: (key: string, name: string) => void;
  onClear: (key: string) => void;
};

/** Ids must not contain whitespace. */
function slug(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default function RecurringPanel({
  groups,
  totalTransactions,
  monthsOnFile,
  roster,
  ownerOf,
  onAssign,
  onClear,
}: RecurringPanelProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const monthlyTotal = sumMonthly(groups);

  const toggle = (key: string) => {
    setOpenKey((current) => (current === key ? null : key));
  };

  return (
    <section
      className="mx-auto w-full max-w-[900px]"
      aria-labelledby="recurring-heading"
      data-recurring-panel
    >
      {/* No live region here on purpose: the headline total already
          announces how many charges there are, and a second announcement
          saying the same thing is noise for a screen reader. */}

      <div className="rounded-[20px] border border-hairline bg-surface shadow-[0_1px_2px_rgba(18,18,15,0.04),0_18px_44px_-30px_rgba(18,18,15,0.28)]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-baseline gap-2.5">
            <h2
              id="recurring-heading"
              tabIndex={-1}
              className="text-[15px] font-semibold tracking-[-0.01em] text-ink"
            >
              Recurring charges
            </h2>
            <span className="rounded-full bg-[#f1f0e9] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted">
              {groups.length}
            </span>
          </div>

          {groups.length > 0 && (
            <p className="flex items-center gap-1 text-[11.5px] text-subtle">
              Largest first
            </p>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="border-t border-hairline px-6 py-12 text-center">
            <p className="text-[15px] font-semibold text-ink">
              No recurring charges found
            </p>
            <p className="mx-auto mt-1.5 max-w-[380px] text-[12.5px] leading-[1.6] text-muted">
              A charge needs at least three payments a month with a steady amount
              before it counts as recurring.
            </p>
          </div>
        ) : (
          <>
            <ul>
              {groups.map((group) => {
                const open = openKey === group.key;
                const paymentsId = `recurring-payments-${slug(group.key)}`;

                return (
                  <li
                    key={group.key}
                    data-recurring-group
                    className="border-b border-[#efeee7] last:border-0"
                  >
                    <div className="flex flex-col gap-3 px-5 py-3.5 sm:h-16 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-0">
                      <button
                        type="button"
                        onClick={() => toggle(group.key)}
                        aria-expanded={open}
                        aria-controls={paymentsId}
                        className="flex w-full min-w-0 flex-1 items-start gap-3 text-left transition-colors hover:bg-[#faf9f4] sm:h-full sm:items-center sm:gap-4"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-ink">
                            {group.name}
                          </span>
                          <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                            {group.occurrences} payments · {formatCost(group.total)} total
                            {group.varies ? " · varies" : ""}
                          </span>
                        </span>

                        <span className="hidden shrink-0 items-center gap-2 sm:flex">
                          <span className="rounded-full bg-[#f1f0e9] px-2 py-1 text-[10px] font-semibold text-muted">
                            Monthly
                          </span>
                          {group.varies && (
                            <span className="text-[10.5px] text-subtle">amount varies</span>
                          )}
                        </span>

                        <span className="shrink-0 text-right">
                          <span className="block text-[13.5px] font-semibold tabular-nums text-ink">
                            {formatCost(group.monthlyAmount)}
                          </span>
                          <span className="mt-0.5 block text-[10.5px] text-subtle">
                            per month
                          </span>
                        </span>

                        <ChevronIcon
                          direction={open ? "down" : "right"}
                          className="mt-1 shrink-0 text-subtle sm:mt-0"
                        />
                      </button>

                      {/* The owner control sits beside the disclosure button,
                          never inside it: a control inside a button would be
                          unreachable by keyboard. */}
                      <span className="shrink-0 sm:pl-1">
                        <OwnerControl
                          owner={ownerOf(group.key)}
                          roster={roster}
                          merchant={group.name}
                          onSave={(name) => onAssign(group.key, name)}
                          onClear={() => onClear(group.key)}
                        />
                      </span>
                    </div>

                    {open && (
                      <div
                        id={paymentsId}
                        className="border-t border-[#efeee7] bg-[#faf9f5] px-5 py-3 sm:px-6"
                      >
                        <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle">
                          Payments
                        </p>
                        <ul className="mt-2 space-y-1">
                          {group.payments.map((payment) => (
                            <li
                              key={payment.id}
                              className="flex items-baseline justify-between gap-4"
                            >
                              <span className="text-[11.5px] tabular-nums text-muted">
                                {formatDate(payment.date)}
                              </span>
                              <span className="text-[11.5px] tabular-nums text-ink-soft">
                                {formatAmount(payment.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div
              data-panel-footer
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-hairline px-5 py-4 sm:px-6"
            >
              <p className="text-[11.5px] text-subtle">
                {groups.length} recurring {groups.length === 1 ? "charge" : "charges"} grouped
                from {totalTransactions.toLocaleString()} transactions across {monthsOnFile}{" "}
                saved {monthsOnFile === 1 ? "month" : "months"}
              </p>
              {groups.length > 0 && (
                <p className="text-[11.5px] text-ink-soft">
                  <span className="font-semibold tabular-nums">
                    {formatCost(monthlyTotal)}
                  </span>{" "}
                  per month in total
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
