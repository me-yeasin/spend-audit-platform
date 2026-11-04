"use client";

import { LockIcon } from "./icons";
import { useStatementImport } from "./use-statement-import";
import { useOwners } from "./use-owners";
import { unownedGroups } from "@/lib/owners";
import { summariseRecurring } from "@/lib/total";
import UploadCard from "./upload-card";
import FileChip from "./file-chip";
import TotalPanel from "./total-panel";
import FlaggedPanel from "./flagged-panel";
import RecurringPanel from "./recurring-panel";
import TransactionsPanel from "./transactions-panel";
import HowItWorks from "./how-it-works";
import ResultPreview from "./result-preview";

export default function HomeScreen() {
  const imp = useStatementImport();
  const { owners, roster, ownerOf, setOwner, clearOwner } = useOwners();
  const inWorkspace = imp.workspace;
  const showHero = !inWorkspace;

  const unowned = unownedGroups(imp.recurring, owners);
  const total = summariseRecurring(imp.recurring, (key) => ownerOf(key) !== null);

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

      {/* Announces the owner status as it changes, including the moment
          every charge has been claimed and the section disappears. */}
      <div role="status" aria-live="polite" className="sr-only">
        {imp.recurring.length === 0
          ? ""
          : unowned.length === 0
            ? "Every recurring charge has an owner."
            : `${unowned.length} recurring ${unowned.length === 1 ? "charge needs" : "charges need"} an owner.`}
      </div>

      {/* ---------------------------------------------------- upload card */}
      {inWorkspace && imp.phase === "ready" && imp.imported ? (
        <>
          <section className="mt-0 w-full" aria-label="Imported statement">
            <FileChip
              name={imp.imported.name}
              sizeLabel={imp.imported.sizeLabel}
              rows={imp.imported.rows}
              onReplace={imp.openPicker}
              onRemove={imp.remove}
            />
          </section>

          {imp.transactions.length > 0 && (
            <>
              <section className="mt-6 w-full sm:mt-8" aria-label="Total monthly recurring cost">
                <TotalPanel total={total} />
              </section>

              <section className="mt-6 w-full sm:mt-8" aria-label="Charges needing an owner">
                <FlaggedPanel
                  groups={unowned}
                  roster={roster}
                  onAssign={setOwner}
                  onClear={clearOwner}
                />
              </section>

              <section className="mt-6 w-full sm:mt-8" aria-label="Recurring charges">
                <RecurringPanel
                  groups={imp.recurring}
                  totalTransactions={imp.transactions.length}
                  roster={roster}
                  ownerOf={ownerOf}
                  onAssign={setOwner}
                  onClear={clearOwner}
                />
              </section>
            </>
          )}

          <section className="mt-6 w-full sm:mt-8" aria-label="Transactions">
            <TransactionsPanel
              transactions={imp.transactions}
              parseIssue={imp.parseIssue}
              skippedRows={imp.skippedRows}
              onChooseFile={imp.openPicker}
            />
          </section>
        </>
      ) : (
        <>
          <section
            className={inWorkspace ? "mt-0 w-full" : "mt-10 w-full sm:mt-12"}
            aria-label="Import a statement"
          >
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
          </section>

          {/* Keep the previous results visible while a replacement is read. */}
          {inWorkspace && imp.transactions.length > 0 && (
            <>
              <section className="mt-6 w-full sm:mt-8" aria-label="Total monthly recurring cost">
                <TotalPanel total={total} />
              </section>

              <section className="mt-6 w-full sm:mt-8" aria-label="Charges needing an owner">
                <FlaggedPanel
                  groups={unowned}
                  roster={roster}
                  onAssign={setOwner}
                  onClear={clearOwner}
                />
              </section>

              <section className="mt-6 w-full sm:mt-8" aria-label="Recurring charges">
                <RecurringPanel
                  groups={imp.recurring}
                  totalTransactions={imp.transactions.length}
                  roster={roster}
                  ownerOf={ownerOf}
                  onAssign={setOwner}
                  onClear={clearOwner}
                />
              </section>

              <section className="mt-6 w-full sm:mt-8" aria-label="Transactions">
                <TransactionsPanel
                  transactions={imp.transactions}
                  parseIssue={imp.parseIssue}
                  skippedRows={imp.skippedRows}
                  onChooseFile={imp.openPicker}
                />
              </section>
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