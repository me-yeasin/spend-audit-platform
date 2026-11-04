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
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const listId = useId();

  const startEditing = () => {
    setDraft(owner ?? "");
    setEditing(true);
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
    // The input is replaced by the name pill. Put the caret on the pill so
    // the keyboard is not dropped on the floor.
    window.requestAnimationFrame(() => {
      wrapperRef.current?.querySelector<HTMLElement>("button")?.focus();
    });
  };

  const clear = () => {
    onClear();
    // The pill is replaced by an empty slot. Keep the caret on it.
    window.requestAnimationFrame(() => {
      wrapperRef.current?.querySelector<HTMLElement>("button")?.focus();
    });
  };

  if (editing) {
    return (
      <span
        ref={wrapperRef}
        className="flex items-center gap-1.5"
        onBlur={(event) => {
          // Tabbing inside the editor keeps it open; leaving it altogether
          // dismisses it. The buttons beside the input keep the focus on
          // the field, so their own click never eats this.
          const next = event.relatedTarget as Node | null;
          if (next && event.currentTarget.contains(next)) return;
          cancel();
        }}
      >
        <input
          type="text"
          autoFocus
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
          onMouseDown={(event) => event.preventDefault()}
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
          onMouseDown={(event) => event.preventDefault()}
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
      <span
        ref={wrapperRef}
        className="inline-flex items-center gap-1 rounded-full bg-[#f1f0e9] py-1 pl-1 pr-1 text-[11px] font-semibold text-ink-soft"
      >
        {/* The name is the control that opens the editor again, so it is
            also where the caret lands after a name is confirmed. Parking it
            on the clear button would undo the name on a second press. */}
        <button
          type="button"
          onClick={startEditing}
          aria-label={`${owner} owns ${merchant}. Change the owner.`}
          className="max-w-[7rem] truncate rounded-full px-1.5 py-0.5 text-left transition-colors hover:bg-[#e6e4da]"
        >
          {owner}
        </button>
        <button
          type="button"
          onClick={clear}
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
    <span ref={wrapperRef} className="inline-flex">
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
    </span>
  );
}
