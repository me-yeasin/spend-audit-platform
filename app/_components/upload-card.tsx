"use client";

import type { ChangeEvent, DragEvent, RefObject } from "react";
import { useId } from "react";
import { AlertIcon, LockIcon, UploadIcon } from "./icons";
import type { Problem } from "./use-statement-import";

type UploadCardProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  state: "idle" | "dragging" | "reading" | "ready" | "error";
  progress: number;
  fileName: string;
  problem: Problem | null;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
};

export default function UploadCard({
  inputRef,
  state,
  progress,
  fileName,
  problem,
  onInputChange,
  onDragEnter,
  onDragLeave,
}: UploadCardProps) {
  const inputId = useId();
  const isDragging = state === "dragging";
  const isReading = state === "reading";
  const isError = state === "error" && problem;

  const zoneClass = [
    "group relative flex min-h-[282px] flex-col items-center justify-center rounded-[18px] px-6 py-10 text-center transition-[background-color,border-color,box-shadow] duration-200 focus-within:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-page sm:min-h-[300px] sm:px-10 sm:py-12",
    isDragging &&
      "border-2 border-dashed border-accent/60 bg-[#f1f8f4] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
    state === "idle" &&
      "cursor-pointer border border-dashed border-[#d2d0c6] bg-[#fbfbf7] hover:border-[#b9b6ab] hover:bg-[#f8f8f3]",
    isReading && "border border-hairline bg-surface",
    isError &&
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
        <label
          htmlFor={inputId}
          className={zoneClass}
          onClick={isReading ? (event) => event.preventDefault() : undefined}
        >
          {/* The input lives inside its label so keyboard focus lands on the
              drop zone and the focus ring is drawn around it. */}
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-describedby={`${inputId}-hint`}
            onChange={onInputChange}
          />

          {isReading ? (
            <div className="w-full max-w-[420px]">
              <span className="mx-auto grid size-[46px] place-items-center rounded-[14px] bg-accent-soft text-accent">
                <UploadIcon />
              </span>
              <p className="mt-4 text-[16px] font-semibold tracking-[-0.01em] text-ink sm:text-[17px]">
                Reading your statement
              </p>
              <p className="mt-1 text-[12px] text-muted sm:text-[12.5px]">
                <span className="block max-w-full truncate">{fileName}</span>
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
          ) : isError ? (
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
                {fileName}
              </p>
              <span className="mt-4 inline-flex h-9 items-center rounded-[9px] px-1 text-[12.5px] font-semibold text-flag underline-offset-4 hover:underline">
                Choose another file
              </span>
            </div>
          ) : (
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
      </div>

      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {isReading
          ? `Reading ${fileName}, ${progress} percent.`
          : isError
            ? `${problem?.title} ${problem?.detail}`
            : ""}
      </div>

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
