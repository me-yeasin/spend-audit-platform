"use client";

import { CheckIcon, FileIcon } from "./icons";

type FileChipProps = {
  name: string;
  sizeLabel: string;
  rows: number;
  onReplace: () => void;
  onRemove: () => void;
};

export default function FileChip({
  name,
  sizeLabel,
  rows,
  onReplace,
  onRemove,
}: FileChipProps) {
  return (
    <div
        data-file-chip
        className="mx-auto w-full max-w-[900px] rounded-[18px] border border-hairline bg-surface p-3 shadow-[0_1px_2px_rgba(18,18,15,0.04),0_12px_30px_-24px_rgba(18,18,15,0.25)] sm:p-3.5"
      >
      <div className="flex items-center gap-3 px-1.5 py-1 sm:gap-4 sm:px-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[#f3f2ec] text-muted">
          <FileIcon />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold tracking-[-0.005em] text-ink sm:text-[13.5px]">
            {name}
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted sm:text-xs">
            {sizeLabel} · {rows.toLocaleString()} rows
          </p>
        </div>

        <span
          className="grid size-[22px] shrink-0 place-items-center rounded-full bg-accent text-white"
          aria-hidden="true"
        >
          <CheckIcon />
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-hairline px-1.5 pt-3 sm:px-2">
        <p className="text-[11px] text-subtle">
          Read locally — nothing was uploaded
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReplace}
            className="inline-flex h-8 items-center rounded-[8px] border border-hairline bg-surface px-3 text-[12px] font-semibold text-ink-soft transition-colors hover:border-[#d8d5cb] hover:bg-[#f7f7f3]"
          >
            Replace file
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-[12px] font-medium text-subtle transition-colors hover:text-ink"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
