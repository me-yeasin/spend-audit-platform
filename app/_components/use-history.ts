"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HISTORY_STORAGE_KEY,
  addMonth,
  emptyHistory,
  parseHistory,
  serialiseHistory,
  type MonthHistory,
  type MonthRecord,
} from "@/lib/history";

/**
 * The saved months, in this browser only.
 *
 * There is no account and no server, so the rows are kept in local storage —
 * the same place the owners live, and for the same reason. They never leave
 * the device, and "Forget saved history" deletes them (see lib/history.ts and
 * design/MONTHLY.md section 3).
 */

function readStoredHistory(): MonthHistory {
  if (typeof window === "undefined") return emptyHistory();
  try {
    return parseHistory(window.localStorage.getItem(HISTORY_STORAGE_KEY));
  } catch {
    // Storage can be unavailable in private modes. The app still works, it
    // just starts from no history for this session.
    return emptyHistory();
  }
}

function writeStoredHistory(history: MonthHistory) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, serialiseHistory(history));
  } catch {
    // A full store must not break the app. The history stays in memory.
  }
}

export function useHistory() {
  const [history, setHistory] = useState<MonthHistory>(readStoredHistory);

  useEffect(() => {
    // An empty history is never written, so "Forget saved history" leaves no
    // empty record behind — the key is simply gone.
    if (!history.months.length) return;
    writeStoredHistory(history);
  }, [history]);

  /**
   * File a month. The update is functional on purpose: two files dropped in
   * quick succession must not lose the first one to a stale snapshot.
   */
  const saveMonth = useCallback((record: MonthRecord) => {
    setHistory((current) => addMonth(current, record));
  }, []);

  const forget = useCallback(() => {
    setHistory(emptyHistory());
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // Nothing to do: an empty history is already in memory.
    }
  }, []);

  return { history, saveMonth, forget };
}
