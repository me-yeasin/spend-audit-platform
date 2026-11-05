"use client";

import { useMemo, useState } from "react";
import { formatAmount, formatDate, formatMonth, formatRange } from "../../lib/format";
import type { Transaction } from "../../lib/parse-statement";
import type { ParseIssue } from "./use-statement-import";

/** Typical statements show in full; unusually large ones page in. */
const PAGE_SIZE = 500;
const PAGE_STEP = 500;

type TransactionsPanelProps = {
  transactions: Transaction[];
  parseIssue: ParseIssue;
  skippedRows: number;
  onChooseFile: () => void;
};

type Group = { key: string; label: string; items: Transaction[] };

function groupByMonth(items: Transaction[]): Group[] {
  const groups: Group[] = [];

  for (const transaction of items) {
    const key = transaction.date.slice(0, 7);
    const current = groups[groups.length - 1];

    if (current && current.key === key) {
      current.items.push(transaction);
    } else {
      groups.push({ key, label: formatMonth(transaction.date), items: [transaction] });
    }
  }

  return groups;
}

function amountClass(amount: number) {
  return amount > 0
    ? "font-semibold tabular-nums text-accent"
    : "tabular-nums text-ink-soft";
}

export default function TransactionsPanel({
  transactions,
  parseIssue,
  skippedRows,
  onChooseFile,
}: TransactionsPanelProps) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  const visibleTransactions = useMemo(
    () => transactions.slice(0, visible),
    [transactions, visible],
  );

  const groups = useMemo(
    () => groupByMonth(visibleTransactions),
    [visibleTransactions],
  );

  const monthTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const transaction of transactions) {
      const key = transaction.date.slice(0, 7);
      totals.set(key, (totals.get(key) ?? 0) + 1);
    }
    return totals;
  }, [transactions]);

  const total = transactions.length;
  const hasMore = visible < total;
  const newest = transactions[0];
  const oldest = transactions[total - 1];

  return (
    <section
      className="mx-auto w-full max-w-[900px]"
      aria-labelledby="transactions-heading"
      data-transactions-panel
    >
      {/* No live region here on purpose: the workspace announces what was
          loaded, from a region that is on the page before the file is read. */}

      <div className="rounded-[20px] border border-hairline bg-surface shadow-[0_1px_2px_rgba(18,18,15,0.04),0_18px_44px_-30px_rgba(18,18,15,0.28)]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-baseline gap-2.5">
            <h2
              id="transactions-heading"
              className="text-[15px] font-semibold tracking-[-0.01em] text-ink"
            >
              Transactions
            </h2>
            <span className="rounded-full bg-[#f1f0e9] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted">
              {total.toLocaleString()}
            </span>
          </div>

          {!parseIssue && total > 0 && (
            <p className="flex items-center gap-1 text-[11.5px] text-subtle">
              Newest first
              <span aria-hidden="true">↓</span>
            </p>
          )}
        </div>

        {parseIssue ? (
          <div className="border-t border-hairline px-6 py-14 text-center">
            <span className="mx-auto grid size-[46px] place-items-center rounded-[14px] bg-flag-soft text-[15px] font-bold text-flag">
              !
            </span>
            <p className="mt-4 text-[15px] font-semibold text-ink">
              Couldn&rsquo;t read this statement
            </p>
            <p className="mx-auto mt-1.5 max-w-[380px] text-[12.5px] leading-[1.6] text-muted">
              {parseIssue.reason} It needs Date, Description and Amount columns.
            </p>
            <button
              type="button"
              onClick={onChooseFile}
              className="mt-5 inline-flex h-9 items-center rounded-[9px] border border-hairline px-3.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:border-[#d8d5cb] hover:bg-[#f7f7f3]"
            >
              Choose another file
            </button>
          </div>
        ) : total === 0 ? (
          <div className="border-t border-hairline px-6 py-14 text-center">
            <p className="text-[15px] font-semibold text-ink">
              No transactions found
            </p>
            <p className="mx-auto mt-1.5 max-w-[340px] text-[12.5px] leading-[1.6] text-muted">
              This file has no rows we can read. Check that it exports Date,
              Description and Amount columns.
            </p>
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-10 hidden grid-cols-[7.5rem_minmax(0,1fr)_7rem] border-y border-hairline bg-surface px-6 py-2.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-subtle sm:grid">
              <span>Date</span>
              <span>Description</span>
              <span className="text-right">Amount</span>
            </div>

            <ul>
              {groups.map((group) => (
                <li key={group.key} data-month-group>
                  <div className="flex items-baseline justify-between bg-[#f7f6f0] px-5 py-2 sm:px-6">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      {group.label}
                    </span>
                    <span className="text-[10.5px] text-muted">
                      {(monthTotals.get(group.key) ?? group.items.length).toLocaleString()}{" "}
                      transactions
                    </span>
                  </div>

                  <ul>
                    {group.items.map((transaction) => (
                      <li
                        key={transaction.id}
                        data-row
                        className="border-b border-[#efeee7] last:border-0"
                      >
                        {/* mobile: two lines */}
                        <div className="px-5 py-3.5 sm:hidden">
                          <p className="truncate text-[13.5px] font-medium text-ink">
                            {transaction.description}
                          </p>
                          <div className="mt-1 flex items-baseline justify-between gap-4">
                            <span className="text-[11px] text-subtle">
                              {formatDate(transaction.date)}
                            </span>
                            <span className={`text-[13px] ${amountClass(transaction.amount)}`}>
                              {formatAmount(transaction.amount)}
                            </span>
                          </div>
                        </div>

                        {/* desktop: single row */}
                        <div className="hidden h-11 grid-cols-[7.5rem_minmax(0,1fr)_7rem] items-center px-6 sm:grid">
                          <span className="text-[12px] tabular-nums text-muted">
                            {formatDate(transaction.date)}
                          </span>
                          <span className="truncate pr-4 text-[13px] text-ink">
                            {transaction.description}
                          </span>
                          <span className={`text-right text-[13px] ${amountClass(transaction.amount)}`}>
                            {formatAmount(transaction.amount)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>

            <div
              data-panel-footer
              className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-4 sm:px-6"
            >
              <p className="text-[11.5px] text-subtle">
                {hasMore
                  ? `Showing ${visible.toLocaleString()} of ${total.toLocaleString()} transactions`
                  : `${total.toLocaleString()} transactions`}
                {oldest && newest ? ` · ${formatRange(oldest.date, newest.date)}` : ""}
                {skippedRows > 0 ? ` · ${skippedRows} rows skipped` : ""}
              </p>

              {hasMore ? (
                <button
                  type="button"
                  onClick={() => setVisible((count) => count + PAGE_STEP)}
                  className="inline-flex h-8 items-center rounded-[8px] border border-hairline bg-surface px-3 text-[12px] font-semibold text-ink-soft transition-colors hover:border-[#d8d5cb] hover:bg-[#f7f7f3]"
                >
                  Show{" "}
                  {Math.min(PAGE_STEP, total - visible).toLocaleString()} more
                </button>
              ) : (
                <p className="text-[11.5px] text-subtle">Showing all</p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
