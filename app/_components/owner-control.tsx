"use client";

import { useId, useRef, useState } from "react";

type OwnerControlProps = {
  /** The current owner, or null when nobody owns this charge. */
  owner: string | null;
  /** Names already in use, offered as suggestions. */
  roster: string[];
  /** The merchant this control belongs to, used for labels. */
  merchant: string;
  onSave: (name: string) => void;
  onClear: () => void;
  /** "flagged" reads as a warning, "neutral" as an open slot. */
  variant?: "neutral" | "flagged";
};

export default function OwnerControl({
  owner,
  roster,
  merchant,
  onSave,
  onClear,
  variant = "neutral",
}: OwnerControlProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const startEditing = () => {
    setDraft(owner ?? "");
    setEditing(true);
    // The input is not in the tree until the next render.
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const cancel = () => {
    setEditing(false);
    setDraft("");
  };

  const confirm = () => {
    const name = draft.trim();
    setEditing(false);
    setDraft("");
    if (name !== "") onSave(name);
  };

  if (editing) {
    return (
      <span className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          list={listId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              confirm();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          placeholder="Owner name"
          aria-label={`Owner for ${merchant}`}
          className="h-7 w-[9.5rem] rounded-[8px] border border-hairline bg-surface px-2 text-[12px] text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        <datalist id={listId}>
          {roster.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <button
          type="button"
          onClick={confirm}
          aria-label={`Save owner for ${merchant}`}
          className="grid size-7 place-items-center rounded-[8px] bg-accent-soft text-accent transition-colors hover:bg-[#dceee5]"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false">
            <path
              d="M2.5 6.2 4.8 8.5 9.5 3.8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={cancel}
          aria-label={`Cancel owner for ${merchant}`}
          className="grid size-7 place-items-center rounded-[8px] text-subtle transition-colors hover:bg-[#f2f1ec] hover:text-ink-soft"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false">
            <path
              d="M3.4 3.4 8.6 8.6M8.6 3.4 3.4 8.6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </span>
    );
  }

  if (owner) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f0e9] py-1 pl-2.5 pr-1 text-[11px] font-semibold text-ink-soft">
        <span className="max-w-[7rem] truncate" title={owner}>
          {owner}
        </span>
        <button
          type="button"
          onClick={onClear}
          aria-label={`Remove ${owner} as owner of ${merchant}`}
          className="grid size-4 place-items-center rounded-full text-subtle transition-colors hover:bg-[#dfddd3] hover:text-ink"
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true" focusable="false">
            <path
              d="M2.4 2.4 7.6 7.6M7.6 2.4 2.4 7.6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      aria-label={`Add an owner for ${merchant}`}
      className={
        variant === "flagged"
          ? "inline-flex items-center gap-1 rounded-full border border-dashed border-[#e0b6b0] px-2.5 py-1 text-[11px] font-semibold text-flag transition-colors hover:border-flag hover:bg-flag-soft"
          : "inline-flex items-center gap-1 rounded-full border border-dashed border-[#d8d5cb] px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-[#c3c0b4] hover:text-ink-soft"
      }
    >
      <span aria-hidden="true" className="text-[13px] leading-none">
        +
      </span>
      Add owner
    </button>
  );
}
