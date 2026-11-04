/**
 * Owner assignment for recurring charges.
 *
 * An owner is the person a recurring charge belongs to. A charge nobody owns
 * is flagged: the app cannot chase a cost it cannot put a name to.
 *
 * Pure and dependency-free — the browser storage lives in the client hook, so
 * these rules can be tested without a browser.
 */

import type { RecurringGroup } from "./detect-recurring";

/** Merchant key to owner name. */
export type OwnerMap = Record<string, string>;

/** Where the map is kept in the browser. */
export const OWNERS_STORAGE_KEY = "spend-audit.owners.v1";

/** Read a stored map, ignoring anything malformed. */
export function parseOwners(raw: string | null): OwnerMap {
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  const owners: OwnerMap = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    const name = value.trim();
    if (name === "") continue;
    owners[key] = name;
  }

  return owners;
}

/** Write a map back, in a stable order so the stored value stays tidy. */
export function serialiseOwners(owners: OwnerMap): string {
  const entries = Object.entries(owners)
    .filter(([, name]) => name.trim() !== "")
    .sort(([a], [b]) => a.localeCompare(b));

  return JSON.stringify(Object.fromEntries(entries));
}

/** The owner of a charge, or null when nobody owns it. */
export function ownerFor(owners: OwnerMap, key: string): string | null {
  const name = owners[key];
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  return trimmed === "" ? null : trimmed;
}

/** Every owner name already in use, alphabetically, for suggestions. */
export function knownOwners(owners: OwnerMap): string[] {
  const names = new Set<string>();

  for (const name of Object.values(owners)) {
    if (typeof name !== "string") continue;
    const trimmed = name.trim();
    if (trimmed !== "") names.add(trimmed);
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}

/** The recurring charges that nobody owns yet. */
export function unownedGroups(groups: RecurringGroup[], owners: OwnerMap): RecurringGroup[] {
  return groups.filter((group) => ownerFor(owners, group.key) === null);
}

/** How many of the given charges nobody owns. */
export function countUnowned(groups: RecurringGroup[], owners: OwnerMap): number {
  return unownedGroups(groups, owners).length;
}
