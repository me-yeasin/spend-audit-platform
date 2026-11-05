"use client";

import { useCallback, useMemo } from "react";
import { LockIcon } from "./icons";
import { useStatementImport, type ImportedMonth } from "./use-statement-import";
import { useOwners } from "./use-owners";
import { useHistory } from "./use-history";
import { unownedGroups } from "@/lib/owners";
import { summariseRecurring } from "@/lib/total";
import { formatCost } from "@/lib/format";
import { detectRecurring, type RecurringGroup } from "@/lib/detect-recurring";
import {
  STRIP_MONTHS,
  allPayments,
  compareMonths,
  monthKeyOf,
  monthLabel,
  monthsOnFile,
  paymentsToTransactions,
  shortMonthLabel,
  totalForMonth,
} from "@/lib/history";
import UploadCard from "./upload-card";
import FileChip from "./file-chip";
import TotalPanel, { type TotalEmpty } from "./total-panel";
import ComparisonPanel from "./comparison-panel";
import FlaggedPanel from "./flagged-panel";
import RecurringPanel from "./recurring-panel";
import TransactionsPanel from "./transactions-panel";
import HowItWorks from "./how-it-works";
import ResultPreview from "./result-preview";

export default function HomeScreen() {
  const { history, saveMonth, forget } = useHistory();

  // A file that parsed is filed as a month. Everything below is then derived
  // from the months on file, so the detector runs over the whole history
  // rather than the file in hand — which is what makes a repeat visible
  // before the third upload (design/MONTHLY.md section 2).
  const handleImported = useCallback(
    (month: ImportedMonth) => {
      const key = monthKeyOf(month.payments);
      if (!key) return;
      saveMonth({
        month: key,
        label: monthLabel(key),
        source: month.source,
        importedAt: new Date().toISOString(),
        payments: month.payments,
      });
    },
    [saveMonth],
  );

  const imp = useStatementImport(handleImported);
  const { owners, roster, ownerOf, setOwner, clearOwner } = useOwners();
  const inWorkspace = imp.workspace;
  const showHero = !inWorkspace;

  const unionPayments = useMemo(() => allPayments(history), [history]);
  const months = useMemo(() => monthsOnFile(history), [history]);

  const allGroups = useMemo<RecurringGroup[]>(() => {
    if (!unionPayments.length) return [];
    return detectRecurring(paymentsToTransactions(unionPayments)).groups;
  }, [unionPayments]);

  const currentMonth = months.length ? months[months.length - 1] : null;
  const previousMonth = months.length > 1 ? months[months.length - 2] : null;

  // The list and the headline cover the charges still being paid: those with a
  // payment in the newest month. A charge that has stopped is reported by the
  // comparison instead, so the list always adds up to the total and the total
  // is what the user actually pays.
  const groups = useMemo(
    () =>
      currentMonth
        ? allGroups.filter((group) =>
            group.payments.some((payment) => payment.date.startsWith(currentMonth)),
          )
        : [],
    [allGroups, currentMonth],
  );

  const comparison = useMemo(
    () =>
      currentMonth && previousMonth
        ? compareMonths(allGroups, currentMonth, previousMonth)
        : null,
    [allGroups, currentMonth, previousMonth],
  );

  const strip = useMemo(
    () =>
      months.slice(-STRIP_MONTHS).map((month) => ({
        month,
        label: shortMonthLabel(month),
        total: totalForMonth(allGroups, month),
      })),
    [months, allGroups],
  );

  const total = summariseRecurring(groups, (key) => ownerOf(key) !== null);
  const unowned = unownedGroups(groups, owners);

  const emptyState: TotalEmpty | null =
    groups.length > 0 || imp.parseIssue || imp.transactions.length === 0
      ? null
      : months.length === 0
        ? null
        : months.length < 3
          ? { kind: "history", months: months.length, label: currentLabel(months) }
          : { kind: "nothing" };

  // What a screen reader is told, in two sentences: what was loaded, and
  // what still needs an owner. The comparison is part of the first sentence,
  // so the headline and the change since last month are never announced apart.
  const loadSummary = !imp.imported
    ? ""
    : imp.parseIssue
      ? "This statement could not be read."
      : imp.transactions.length === 0
        ? "No transactions found."
        : `${imp.transactions.length.toLocaleString()} transactions loaded, newest first. ${
            total.charges === 0
              ? months.length < 3
                ? "No recurring charges yet."
                : "No recurring charges found."
              : `${total.charges} recurring ${total.charges === 1 ? "charge" : "charges"} across ${months.length} saved ${months.length === 1 ? "month" : "months"}, ${formatCost(total.monthly)} per month.${
                  comparison
                    ? ` ${comparison.delta >= 0 ? "Up" : "Down"} ${formatCost(Math.abs(comparison.delta))} from ${comparison.previousLabel}.`
                    : ""
                }`
          }`;

  // Guarded on there being a file in hand: the saved history is read from this
  // browser, so on its own it would be a sentence the server could not have
  // rendered, and the page would hydrate mismatched.
  const ownerSummary =
    groups.length === 0 || !imp.imported
      ? ""
      : unowned.length === 0
        ? "Every recurring charge has an owner."
        : `${unowned.length} recurring ${unowned.length === 1 ? "charge needs" : "charges need"} an owner.`;

  return (
    <main className="flex flex-1 flex-col items-center px-5 pt-14 pb-16 sm:px-8 sm:pt-20 sm:pb-20 lg:pt-[88px]">
      {/* The hero heading is replaced by the panel heading once data loads,
          so the page keeps exactly one H1 at all times. */}
      {inWorkspace && (
        <h1 className="sr-only">Your statement transactions</h1>
      )}

      {/* ------------------------------------------------------------ hero */}
      {showHero && (
        <section className="w-full max-w-[820px] text-center">
          <p className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-muted sm:text-[11px] sm:tracking-[0.22em]">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Monthly spend audit
          </p>

          <h1 className="mt-5 text-balance text-[clamp(2.25rem,6.4vw+0.4rem,3.25rem)] font-semibold leading-[1.07] tracking-[-0.028em] text-ink sm:mt-6">
            See what you&rsquo;re quietly paying for every month.
          </h1>

          <p className="mx-auto mt-5 max-w-[32rem] text-pretty text-[15px] leading-[1.7] text-muted sm:mt-6 sm:text-base">
            Drop in your bank statement CSV. We surface every recurring charge,
            total it up, and flag the ones nobody owns.
          </p>
        </section>
      )}

      {/* These two regions are always on the page, empty until there is
          something to say. A live region that is mounted already filled in
          is not announced by a screen reader, so the announcement of the
          first upload has to live outside the workspace. */}
      <div role="status" aria-live="polite" className="sr-only">
        {loadSummary}
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {ownerSummary}
      </div>

      {/* ---------------------------------------------------- upload card */}
      {inWorkspace && imp.phase === "ready" && imp.imported ? (
        <>
          <div className="mt-0 w-full">
            <FileChip
              name={imp.imported.name}
              sizeLabel={imp.imported.sizeLabel}
              rows={imp.imported.rows}
              onReplace={imp.openPicker}
              onRemove={imp.remove}
            />
          </div>

          {imp.transactions.length > 0 && (
            <>
              <div className="mt-6 w-full sm:mt-8">
                <TotalPanel total={total} empty={emptyState} />
              </div>

              {comparison && groups.length > 0 && (
                <div className="mt-6 w-full sm:mt-8">
                  <ComparisonPanel
                    comparison={comparison}
                    strip={strip}
                    monthsOnFile={months.length}
                    onForget={forget}
                  />
                </div>
              )}

              <div className="mt-6 w-full sm:mt-8">
                <FlaggedPanel
                  groups={unowned}
                  roster={roster}
                  onAssign={setOwner}
                  onClear={clearOwner}
                />
              </div>

              <div className="mt-6 w-full sm:mt-8">
                <RecurringPanel
                  groups={groups}
                  totalTransactions={unionPayments.length}
                  monthsOnFile={months.length}
                  roster={roster}
                  ownerOf={ownerOf}
                  onAssign={setOwner}
                  onClear={clearOwner}
                />
              </div>
            </>
          )}

          <div className="mt-6 w-full sm:mt-8">
            <TransactionsPanel
              transactions={imp.transactions}
              parseIssue={imp.parseIssue}
              skippedRows={imp.skippedRows}
              onChooseFile={imp.openPicker}
            />
          </div>
        </>
      ) : (
        <>
          <div className={inWorkspace ? "mt-0 w-full" : "mt-10 w-full sm:mt-12"}>
            <UploadCard
              inputRef={imp.inputRef}
              state={imp.state}
              progress={imp.progress}
              fileName={imp.pendingName}
              problem={imp.problem}
              onInputChange={imp.onInputChange}
              onDragEnter={imp.onDragEnter}
              onDragLeave={imp.onDragLeave}
            />
          </div>

          {/* Keep the previous results visible while a replacement is read. */}
          {inWorkspace && imp.transactions.length > 0 && (
            <>
              <div className="mt-6 w-full sm:mt-8">
                <TotalPanel total={total} empty={emptyState} />
              </div>

              {comparison && groups.length > 0 && (
                <div className="mt-6 w-full sm:mt-8">
                  <ComparisonPanel
                    comparison={comparison}
                    strip={strip}
                    monthsOnFile={months.length}
                    onForget={forget}
                  />
                </div>
              )}

              <div className="mt-6 w-full sm:mt-8">
                <FlaggedPanel
                  groups={unowned}
                  roster={roster}
                  onAssign={setOwner}
                  onClear={clearOwner}
                />
              </div>

              <div className="mt-6 w-full sm:mt-8">
                <RecurringPanel
                  groups={groups}
                  totalTransactions={unionPayments.length}
                  monthsOnFile={months.length}
                  roster={roster}
                  ownerOf={ownerOf}
                  onAssign={setOwner}
                  onClear={clearOwner}
                />
              </div>

              <div className="mt-6 w-full sm:mt-8">
                <TransactionsPanel
                  transactions={imp.transactions}
                  parseIssue={imp.parseIssue}
                  skippedRows={imp.skippedRows}
                  onChooseFile={imp.openPicker}
                />
              </div>
            </>
          )}
        </>
      )}

      {/* --------------------------------------------------- how it works */}
      {showHero && (
        <div className="mt-16 w-full sm:mt-[72px]">
          <HowItWorks />
        </div>
      )}

      {/* ------------------------------------------------- result preview */}
      {showHero && (
        <div className="mt-16 w-full sm:mt-24">
          <ResultPreview />
        </div>
      )}

      <p className="mt-20 flex items-center justify-center gap-1.5 text-center text-[11px] text-subtle sm:mt-[88px] sm:gap-2 sm:text-[12px]">
        <LockIcon className="shrink-0" />
        <span>Stays on this device — nothing is uploaded</span>
      </p>
    </main>
  );
}

function currentLabel(months: string[]): string {
  const newest = months[months.length - 1];
  return newest ? monthLabel(newest) : "";
}
