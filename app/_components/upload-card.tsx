"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AlertIcon,
  CheckIcon,
  FileIcon,
  LockIcon,
  UploadIcon,
} from "./icons";

const MAX_BYTES = 10 * 1024 * 1024;
/** Keep the reading state on screen long enough to be perceptible. */
const MIN_READING_MS = 520;

type Phase = "idle" | "reading" | "ready" | "error";

type Problem = { title: string; detail: string };

type ImportedFile = {
  name: string;
  sizeLabel: string;
  rows: number;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : "";
}

function countRows(text: string) {
  const lines = text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return 0;

  const first = lines[0].toLowerCase();
  const looksLikeHeader =
    /date/.test(first) && /(amount|value|debit|credit)/.test(first);
  return looksLikeHeader ? lines.length - 1 : lines.length;
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

export default function UploadCard() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const readerRef = useRef<FileReader | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingName, setPendingName] = useState("");
  const [imported, setImported] = useState<ImportedFile | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);

  const clearInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  const reset = useCallback(() => {
    readerRef.current?.abort();
    readerRef.current = null;
    dragDepth.current = 0;
    setDragging(false);
    setProgress(0);
    setPendingName("");
    setImported(null);
    setProblem(null);
    setPhase("idle");
    clearInput();
  }, []);

  const readFile = useCallback((file: File) => {
    const bad = validateFile(file);
    setPendingName(file.name);

    if (bad) {
      setProblem(bad);
      setImported(null);
      setProgress(0);
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
      const rows = countRows(text);

      const finish = () => {
        setImported({ name: file.name, sizeLabel: formatBytes(file.size), rows });
        setProgress(100);
        setPhase("ready");
      };

      const remaining = MIN_READING_MS - (performance.now() - startedAt);
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

  // Accept a drop anywhere on the page — the card is the obvious target, but
  // people often miss it by a few pixels. Prevent the browser opening the file.
  useEffect(() => {
    const onDragOver = (event: DragEvent) => event.preventDefault();
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) readFile(file);
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [readFile]);

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
    if (file) readFile(file);
    clearInput();
  };

  const isDragging = dragging && phase !== "reading";
  const state = isDragging ? "dragging" : phase;

  const zoneClass = [
    "group relative flex min-h-[282px] flex-col items-center justify-center rounded-[18px] px-6 py-10 text-center transition-[background-color,border-color,box-shadow] duration-200 focus-within:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/30 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-page sm:min-h-[300px] sm:px-10 sm:py-12",
    isDragging &&
      "border-2 border-dashed border-accent/60 bg-[#f1f8f4] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
    phase === "idle" &&
      !isDragging &&
      "cursor-pointer border border-dashed border-[#d2d0c6] bg-[#fbfbf7] hover:border-[#b9b6ab] hover:bg-[#f8f8f3]",
    phase === "reading" && "border border-hairline bg-surface",
    phase === "error" &&
      !isDragging &&
      "cursor-pointer border border-dashed border-[#e6c2ba] bg-flag-soft/55 hover:border-[#d9a99f] hover:bg-flag-soft/80",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="w-full">
      <div
        data-upload-card
        data-state={state}
        onDragEnter={onDragEnter}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={onDragLeave}
        className={[
          "mx-auto w-full max-w-[720px] rounded-[24px] border bg-surface p-2.5 transition-[border-color,box-shadow] duration-300 sm:p-3.5",
          isDragging
            ? "border-accent/30 shadow-[0_1px_2px_rgba(14,124,90,0.10),0_26px_60px_-28px_rgba(14,124,90,0.55)]"
            : "border-hairline shadow-[0_1px_2px_rgba(18,18,15,0.04),0_18px_40px_-24px_rgba(18,18,15,0.32)]",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-describedby={`${inputId}-hint`}
          onChange={onInputChange}
        />

        {phase === "ready" && imported ? (
          /* ---------------------------------------------------- imported */
          <div className="rounded-[18px] bg-surface px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-[11px] bg-[#f3f2ec] text-muted">
                <FileIcon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-ink sm:text-sm">
                  {imported.name}
                </p>
                <p className="mt-1 text-[11.5px] text-muted sm:text-xs">
                  {imported.sizeLabel} · {imported.rows.toLocaleString()} rows
                </p>
              </div>
              <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-accent text-white">
                <CheckIcon />
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-4">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex h-9 items-center justify-center rounded-[9px] border border-hairline bg-surface px-3.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:border-[#d8d5cb] hover:bg-[#f7f7f3]"
              >
                Replace file
              </button>
              <button
                type="button"
                onClick={reset}
                className="text-[12.5px] font-medium text-subtle transition-colors hover:text-ink"
              >
                Remove
              </button>
              <p className="ml-auto hidden text-[11.5px] text-subtle sm:block">
                Read locally — nothing was uploaded
              </p>
            </div>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className={zoneClass}
            onClick={
              phase === "reading"
                ? (event) => event.preventDefault()
                : undefined
            }
          >
            {phase === "reading" ? (
              /* --------------------------------------------------- reading */
              <div className="w-full max-w-[420px]">
                <span className="mx-auto grid size-[46px] place-items-center rounded-[14px] bg-accent-soft text-accent">
                  <UploadIcon />
                </span>
                <p className="mt-4 text-[16px] font-semibold tracking-[-0.01em] text-ink sm:text-[17px]">
                  Reading your statement
                </p>
                <p className="mt-1 text-[12px] text-muted sm:text-[12.5px]">
                  <span className="block max-w-full truncate">{pendingName}</span>
                </p>

                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  aria-label="Reading file"
                  className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-[#ecebe3]"
                >
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-150 ease-out"
                    style={{ width: `${Math.max(progress, 6)}%` }}
                  />
                </div>

                <p className="mt-2.5 flex items-center justify-between text-[11px] text-subtle">
                  <span>Parsing on your device</span>
                  <span className="tabular-nums">{progress}%</span>
                </p>
              </div>
            ) : phase === "error" && problem ? (
              /* ----------------------------------------------------- error */
              <div className="w-full max-w-[420px]">
                <span className="mx-auto grid size-[46px] place-items-center rounded-[14px] bg-surface text-flag shadow-[0_1px_2px_rgba(180,57,43,0.12)]">
                  <AlertIcon />
                </span>
                <p className="mt-4 text-[16px] font-semibold tracking-[-0.01em] text-ink sm:text-[17px]">
                  {problem.title}
                </p>
                <p className="mt-1.5 text-[12px] text-muted sm:text-[12.5px]">
                  {problem.detail}
                </p>
                <p className="mx-auto mt-2 max-w-[280px] truncate text-[11px] text-subtle">
                  {pendingName}
                </p>
                <span className="mt-4 inline-flex h-9 items-center rounded-[9px] px-1 text-[12.5px] font-semibold text-flag underline-offset-4 hover:underline">
                  Choose another file
                </span>
              </div>
            ) : (
              /* ------------------------------------------------------ idle */
              <>
                <span
                  className={[
                    "grid size-[52px] place-items-center rounded-[15px] transition-[background-color,color,transform] duration-200",
                    isDragging
                      ? "bg-surface text-accent"
                      : "bg-accent-soft text-accent group-hover:scale-[1.03]",
                  ].join(" ")}
                >
                  <UploadIcon />
                </span>

                <span className="mt-4 block text-[17px] font-semibold tracking-[-0.01em] text-ink sm:mt-[18px] sm:text-[18.5px]">
                  {isDragging ? "Release to import" : "Drag & drop your bank statement"}
                </span>

                <span
                  id={`${inputId}-hint`}
                  className="mt-1.5 block text-[12px] text-muted sm:text-[12.5px]"
                >
                  {isDragging ? (
                    "It stays on your device"
                  ) : (
                    <>
                      <span className="sm:hidden">CSV export · up to 10 MB</span>
                      <span className="hidden sm:inline">
                        CSV export from any bank · up to 10 MB
                      </span>
                    </>
                  )}
                </span>

                <span
                  className={[
                    "mt-[22px] inline-flex h-[42px] items-center justify-center rounded-[10px] px-6 text-[13.5px] font-semibold text-white transition-[background-color,transform] duration-150",
                    isDragging ? "bg-accent" : "bg-ink hover:bg-[#26261f]",
                  ].join(" ")}
                >
                  {isDragging ? "Drop to import" : "Browse files"}
                </span>

                <span className="mt-3 block text-[11.5px] text-subtle">
                  {isDragging ? "or let go anywhere on this page" : "or click anywhere in this box"}
                </span>
              </>
            )}
          </label>
        )}
      </div>

      <p
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {phase === "ready" && imported
          ? `Imported ${imported.name}, ${imported.rows} rows.`
          : phase === "error" && problem
            ? `${problem.title}. ${problem.detail}`
            : phase === "reading"
              ? "Reading file"
              : ""}
      </p>

      <p className="mt-6 flex items-start justify-center gap-2 px-2 text-center text-[12px] text-muted sm:mt-7 sm:text-[12.5px]">
        <LockIcon className="mt-[3px] shrink-0 text-accent" />
        <span>
          <span className="sm:hidden">Stays on this device — never uploaded.</span>
          <span className="hidden sm:inline">
            Your file stays on this device — nothing is uploaded.
          </span>
        </span>
      </p>
    </div>
  );
}
