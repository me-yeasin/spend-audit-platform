"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/format";
import { parseStatement, type Transaction } from "@/lib/parse-statement";

export type ImportPhase = "idle" | "reading" | "ready" | "error";

export type Problem = { title: string; detail: string };

export type ImportedFile = {
  name: string;
  sizeLabel: string;
  rows: number;
};

export type ParseIssue = { reason: string } | null;

const MAX_BYTES = 10 * 1024 * 1024;
/** Persist the reading state long enough to be perceived as progress. */
const MIN_READING_MS = 520;

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : "";
}

function validateFile(file: File): Problem | null {
  const ext = extensionOf(file.name);

  if (ext !== "csv") {
    return {
      title: ext ? `That file is a ${ext.toUpperCase()}` : "That file isn't a CSV",
      detail: "Upload the CSV export from your bank.",
    };
  }
  if (file.size === 0) {
    return {
      title: "That file is empty",
      detail: "Export the statement again and retry.",
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      title: `That file is ${formatBytes(file.size)}`,
      detail: "The limit is 10 MB.",
    };
  }
  return null;
}

export function useStatementImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<FileReader | null>(null);
  const dragDepth = useRef(0);

  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingName, setPendingName] = useState("");
  const [imported, setImported] = useState<ImportedFile | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [skippedRows, setSkippedRows] = useState(0);
  const [parseIssue, setParseIssue] = useState<ParseIssue>(null);
  const [workspace, setWorkspace] = useState(false);

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  const acceptFile = useCallback((file: File) => {
    readerRef.current?.abort();
    readerRef.current = null;
    setPendingName(file.name);

    const invalid = validateFile(file);
    if (invalid) {
      // Keep whatever was already imported: a bad drop should never destroy
      // results the user is still looking at.
      setProblem(invalid);
      setPhase("error");
      return;
    }

    setProblem(null);
    setProgress(0);
    setPhase("reading");

    const startedAt = performance.now();
    const reader = new FileReader();
    readerRef.current = reader;

    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        setProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };

    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const result = parseStatement(text);
      const finishedAt = performance.now();

      const finish = () => {
        if (result.status === "ok" || result.status === "empty") {
          setTransactions(result.transactions);
          setSkippedRows(result.skippedRows);
          setParseIssue(null);
          setImported({
            name: file.name,
            sizeLabel: formatBytes(file.size),
            rows: result.transactions.length,
          });
        } else {
          setTransactions([]);
          setSkippedRows(0);
          setParseIssue({ reason: result.reason });
          setImported({ name: file.name, sizeLabel: formatBytes(file.size), rows: 0 });
        }

        setProgress(100);
        setWorkspace(true);
        setPhase("ready");
      };

      const remaining = MIN_READING_MS - (finishedAt - startedAt);
      if (remaining > 0) window.setTimeout(finish, remaining);
      else finish();
    };

    reader.onerror = () => {
      setProblem({
        title: "We couldn't read that file",
        detail: "Try exporting the CSV again from your bank.",
      });
      setPhase("error");
    };

    reader.readAsText(file);
  }, []);

  // Dropping a file anywhere on the page should import it, and must never let
  // the browser navigate away to the file.
  useEffect(() => {
    const onDragOver = (event: DragEvent) => event.preventDefault();
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) acceptFile(file);
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [acceptFile]);

  const onDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current += 1;
    if (phase !== "reading") setDragging(true);
  };

  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) acceptFile(file);
    resetInput();
  };

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const remove = useCallback(() => {
    readerRef.current?.abort();
    readerRef.current = null;
    dragDepth.current = 0;
    setDragging(false);
    setPhase("idle");
    setProgress(0);
    setPendingName("");
    setImported(null);
    setProblem(null);
    setTransactions([]);
    setSkippedRows(0);
    setParseIssue(null);
    setWorkspace(false);
    resetInput();
  }, []);

  const state: "idle" | "dragging" | "reading" | "ready" | "error" =
    dragging && phase !== "reading" ? "dragging" : phase;

  return {
    state,
    phase,
    progress,
    pendingName,
    imported,
    problem,
    transactions,
    skippedRows,
    parseIssue,
    workspace,
    inputRef,
    acceptFile,
    onInputChange,
    onDragEnter,
    onDragLeave,
    openPicker,
    remove,
  };
}
