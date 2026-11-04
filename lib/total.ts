/**
 * The headline number: what the user quietly pays every month.
 *
 * The total is the sum of the monthly amount of every recurring charge —
 * exactly the amounts already shown in the recurring charges list, so the
 * number can always be checked against the list below it.
 *
 * Pure and dependency-free, so it can be tested without a browser.
 */

import type { RecurringGroup } from "./detect-recurring";

export type RecurringTotal = {
  /** Sum of the monthly amount of every recurring charge. */
  monthly: number;
  /** How many charges the total covers. */
  charges: number;
  /** How many payments those charges are made of. */
  payments: number;
  /** The monthly amount of the charges nobody owns. */
  unownedMonthly: number;
  /** How many charges nobody owns. */
  unownedCharges: number;
};

/** Money is added up in cents, so the sum never ends in a stray decimal. */
function toCents(amount: number) {
  return Math.round(amount * 100) / 100;
}

/**
 * The sum of the monthly amount of every recurring charge.
 *
 * The headline number and the foot of the list are both built from this, so
 * they cannot disagree.
 */
export function sumMonthly(groups: RecurringGroup[]): number {
  let sum = 0;
  for (const group of groups) sum += group.monthlyAmount;
  return toCents(sum);
}

/**
 * The headline total.
 *
 * `isOwned` decides whether a charge has an owner; the caller knows that,
 * this module only knows about money.
 */
export function summariseRecurring(
  groups: RecurringGroup[],
  isOwned: (key: string) => boolean,
): RecurringTotal {
  let monthly = 0;
  let payments = 0;
  let unownedMonthly = 0;
  let unownedCharges = 0;

  for (const group of groups) {
    monthly += group.monthlyAmount;
    payments += group.occurrences;

    if (!isOwned(group.key)) {
      unownedMonthly += group.monthlyAmount;
      unownedCharges += 1;
    }
  }

  return {
    monthly: toCents(monthly),
    charges: groups.length,
    payments,
    unownedMonthly: toCents(unownedMonthly),
    unownedCharges,
  };
}
