"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  OWNERS_STORAGE_KEY,
  knownOwners,
  ownerFor,
  parseOwners,
  serialiseOwners,
  type OwnerMap,
} from "@/lib/owners";

/**
 * Owners live in this browser only.
 *
 * There is no account and no server, so the map is kept in local storage,
 * keyed by merchant — which means it survives between months on the same
 * device, and never leaves it.
 */

function readStoredOwners(): OwnerMap {
  if (typeof window === "undefined") return {};
  try {
    return parseOwners(window.localStorage.getItem(OWNERS_STORAGE_KEY));
  } catch {
    // Storage can be unavailable in private modes. The app still works, it
    // just forgets the owners when the tab closes.
    return {};
  }
}

function writeStoredOwners(owners: OwnerMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OWNERS_STORAGE_KEY, serialiseOwners(owners));
  } catch {
    // Nothing to do: the owners stay in memory for this session.
  }
}

export function useOwners() {
  const [owners, setOwners] = useState<OwnerMap>(readStoredOwners);

  useEffect(() => {
    writeStoredOwners(owners);
  }, [owners]);

  const setOwner = useCallback((key: string, name: string) => {
    const trimmed = name.trim();

    setOwners((current) => {
      if (trimmed === "") {
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key];
        return next;
      }
      if (current[key] === trimmed) return current;
      return { ...current, [key]: trimmed };
    });
  }, []);

  const clearOwner = useCallback((key: string) => {
    setOwner(key, "");
  }, [setOwner]);

  const roster = useMemo(() => knownOwners(owners), [owners]);
  const ownerOf = useCallback((key: string) => ownerFor(owners, key), [owners]);

  return { owners, setOwner, clearOwner, roster, ownerOf };
}
