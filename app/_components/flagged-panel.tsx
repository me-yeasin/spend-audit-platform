"use client";

import type { RecurringGroup } from "@/lib/detect-recurring";
import { formatCost } from "@/lib/format";
import OwnerControl from "./owner-control";

type FlaggedPanelProps = {
  /** The recurring charges nobody owns. */
  groups: RecurringGroup[];
  /** Names already in use, offered as suggestions. */
  roster: string[];
  onAssign: (key: string, name: string) => void;
  onClear: (key: string) => void;
};

/**
 * The charges nobody has claimed.
 *
 * Kept at the top of the workspace because it is the one thing the user
 * actually has to act on: a recurring cost with no owner is money leaving the
 * household that nobody has agreed to.
 */
export default function FlaggedPanel({
  groups,
  roster,
  onAssign,
  onClear,
}: FlaggedPanelProps) {
  if (groups.length === 0) return null;

  return (
    <section
      className="mx-auto w-full max-w-[900px]"
      aria-labelledby="flagged-heading"
      data-flagged-panel
    >
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {groups.length} recurring {groups.length === 1 ? "charge needs" : "charges need"} an owner.
      </div>

      <div className="rounded-[20px] border border-hairline bg-surface shadow-[0_1px_2px_rgba(18,18,15,0.04),0_18px_44px_-30px_rgba(18,18,15,0.28)]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-baseline gap-2.5">
            <h2
              id="flagged-heading"
              className="text-[15px] font-semibold tracking-[-0.01em] text-ink"
            >
              Needs an owner
            </h2>
            <span className="rounded-full bg-flag-soft px-2 py-0.5 text-[11px] font-semibold tabular-nums text-flag">
              {groups.length}
            </span>
          </div>

          <p className="flex items-center gap-1.5 text-[11.5px] text-subtle">
            <span className="size-1.5 rounded-full bg-flag" aria-hidden="true" />
            Nobody has claimed these
          </p>
        </div>

        <ul>
          {groups.map((group) => (
            <li
              key={group.key}
              data-flagged-row
              className="border-b border-[#efeee7] last:border-0"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2.5 px-5 py-3.5 sm:flex sm:items-center sm:gap-4 sm:px-6">
                <span className="flex min-w-0 items-start gap-2.5">
                  <span
                    className="mt-[7px] size-1.5 shrink-0 rounded-full bg-flag"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span
                      data-flagged-name
                      className="block truncate text-[13.5px] font-semibold text-ink"
                    >
                      {group.name}
                    </span>
                    <span
                      data-flagged-evidence
                      className="mt-0.5 block truncate text-[11.5px] text-muted"
                    >
                      {group.occurrences} payments · {formatCost(group.total)} total
                    </span>
                  </span>
                </span>

                <span className="text-right sm:w-[6.5rem]">
                  <span
                    data-flagged-amount
                    className="block text-[13.5px] font-semibold tabular-nums text-ink"
                  >
                    {formatCost(group.monthlyAmount)}
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-subtle">per month</span>
                </span>

                <span className="col-span-2 sm:col-auto">
                  <OwnerControl
                    owner={null}
                    roster={roster}
                    merchant={group.name}
                    variant="flagged"
                    onSave={(name) => onAssign(group.key, name)}
                    onClear={() => onClear(group.key)}
                  />
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="border-t border-hairline px-5 py-4 sm:px-6">
          <p className="text-[11.5px] text-subtle">
            Name an owner to clear a charge. It leaves this list and appears in the
            recurring charges below with their name on it.
          </p>
        </div>
      </div>
    </section>
  );
}
