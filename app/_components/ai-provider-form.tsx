"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertIcon, CheckIcon, ChevronIcon, LockIcon } from "./icons";
import { useAiProvider, type AiProviderSave } from "./use-ai-provider";
import {
  emptyAiProvider,
  normaliseBaseUrl,
  testAiProvider,
  validateAiProvider,
  type AiProviderConfig,
  type AiProviderErrors,
  type AiProviderField,
} from "../../lib/ai-provider";

type TestState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

const INPUT_BASE =
  "h-11 w-full rounded-[10px] border bg-surface px-3 text-[13.5px] text-ink transition-[border-color,box-shadow] placeholder:text-subtle/80 focus:outline-none focus:ring-2";

function inputClass(invalid: boolean): string {
  return [
    INPUT_BASE,
    invalid
      ? "border-flag/70 focus:border-flag focus:ring-flag/10"
      : "border-hairline focus:border-accent focus:ring-accent/15",
  ].join(" ");
}

function describedBy(id: string, hasError: boolean): string {
  return hasError ? `${id}-hint ${id}-error` : `${id}-hint`;
}

export default function AiProviderForm() {
  const { config, save, clear } = useAiProvider();

  return (
    <main className="flex flex-1 flex-col items-center px-5 pt-9 pb-16 sm:px-8 sm:pt-12 sm:pb-20">
      <div className="w-full max-w-[720px]">
        <Link
          href="/"
          className="-ml-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1.5 text-[12px] font-medium text-muted transition-colors hover:text-ink"
        >
          <ChevronIcon className="rotate-180" />
          Back to audit
        </Link>

        <p className="mt-5 flex w-fit items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-muted sm:text-[11px] sm:tracking-[0.22em]">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
          AI provider
        </p>

        <h1 className="mt-4 text-balance text-[clamp(1.85rem,4.2vw+1rem,2.35rem)] font-semibold leading-[1.12] tracking-[-0.025em] text-ink">
          Connect your own AI model.
        </h1>

        <p className="mt-3 max-w-[36rem] text-[14px] leading-[1.7] text-muted sm:text-[14.5px]">
          Spend Audit has no AI of its own. Point it at an OpenAI-compatible
          provider you trust — the audit agent will use it only when you ask.
          Your key stays in this browser and goes straight to that provider.
        </p>

        {config === undefined ? (
          <ProviderSkeleton />
        ) : (
          <ProviderEditor
            initial={config ?? emptyAiProvider()}
            saved={config !== null}
            onSave={save}
            onClear={clear}
          />
        )}

        <p className="mt-5 flex items-start gap-2 px-1 text-[11.5px] leading-[1.6] text-subtle">
          <LockIcon className="mt-[2px] shrink-0 text-accent" />
          <span>
            Your key is stored in this browser only. Requests go directly from
            this device to your provider — never through a Spend Audit server.
          </span>
        </p>
      </div>
    </main>
  );
}

function ProviderEditor({
  initial,
  saved,
  onSave,
  onClear,
}: {
  initial: AiProviderConfig;
  saved: boolean;
  onSave: (config: AiProviderConfig) => AiProviderSave;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<AiProviderConfig>(initial);
  const [errors, setErrors] = useState<AiProviderErrors>({});
  const [test, setTest] = useState<TestState>({ kind: "idle" });
  const [notice, setNotice] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState(false);

  const baseUrlRef = useRef<HTMLInputElement>(null);
  const modelIdRef = useRef<HTMLInputElement>(null);
  const baseUrlId = useId();
  const apiKeyId = useId();
  const modelIdId = useId();

  const dirty =
    normaliseBaseUrl(draft.baseUrl) !== initial.baseUrl ||
    draft.apiKey.trim() !== initial.apiKey ||
    draft.modelId.trim() !== initial.modelId;

  function update(field: AiProviderField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setTest({ kind: "idle" });
    setNotice(null);
  }

  function reject(nextErrors: AiProviderErrors) {
    setErrors(nextErrors);
    setTest({ kind: "idle" });
    setNotice(null);
    if (nextErrors.baseUrl) baseUrlRef.current?.focus();
    else if (nextErrors.modelId) modelIdRef.current?.focus();
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateAiProvider(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      reject(nextErrors);
      return;
    }

    const result = onSave(draft);
    setTest({ kind: "idle" });

    if (!result.ok) {
      setNotice(
        "This browser is blocking local storage, so the provider could not be saved. Allow site data and try again.",
      );
      return;
    }

    setDraft(result.config);
    setNotice("Saved in this browser. Your provider is ready.");
  }

  async function handleTest() {
    const nextErrors = validateAiProvider(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      reject(nextErrors);
      return;
    }

    setNotice(null);
    setTest({ kind: "testing" });
    const result = await testAiProvider(draft);
    setTest(result.ok ? { kind: "ok" } : { kind: "error", message: result.message });
  }

  function handleRemove() {
    onClear();
    setDraft(emptyAiProvider());
    setErrors({});
    setTest({ kind: "idle" });
    setNotice("Provider removed from this browser.");
  }

  return (
    <form
      noValidate
      onSubmit={handleSave}
      data-ai-provider-form
      className="mt-7 rounded-[20px] border border-hairline bg-surface shadow-[0_1px_2px_rgba(18,18,15,0.04),0_18px_44px_-30px_rgba(18,18,15,0.28)]"
    >
      <div className="px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
            Provider details
          </h2>
          <ProviderChip saved={saved} dirty={dirty} />
        </div>

        <p className="mt-1.5 text-[11.5px] leading-[1.55] text-subtle">
          Any OpenAI-compatible endpoint works: OpenAI, OpenRouter, Gemini, or a
          model running on this machine.
        </p>

        <div className="mt-6 flex flex-col gap-5">
          <Field
            id={baseUrlId}
            label="Base URL"
            hint="The API root, usually ending in /v1 — for example https://openrouter.ai/api/v1 or http://localhost:11434/v1."
            error={errors.baseUrl}
          >
            <input
              ref={baseUrlRef}
              id={baseUrlId}
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="https://openrouter.ai/api/v1"
              value={draft.baseUrl}
              onChange={(event) => update("baseUrl", event.target.value)}
              aria-invalid={errors.baseUrl ? true : undefined}
              aria-describedby={describedBy(baseUrlId, Boolean(errors.baseUrl))}
              className={inputClass(Boolean(errors.baseUrl))}
            />
          </Field>

          <Field
            id={apiKeyId}
            label="API key"
            hint="Kept in this browser only. Leave blank for a local model."
          >
            <div className="relative">
              <input
                id={apiKeyId}
                type={revealKey ? "text" : "password"}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="sk-…"
                value={draft.apiKey}
                onChange={(event) => update("apiKey", event.target.value)}
                aria-describedby={describedBy(apiKeyId, false)}
                className={`${inputClass(false)} pr-16`}
              />
              <button
                type="button"
                onClick={() => setRevealKey((current) => !current)}
                aria-pressed={revealKey}
                className="absolute inset-y-0 right-0 px-3 text-[11px] font-semibold text-muted transition-colors hover:text-ink"
              >
                {revealKey ? "Hide" : "Show"}
              </button>
            </div>
          </Field>

          <Field
            id={modelIdId}
            label="Model ID"
            hint="Exactly as the provider names it — for example openai/gpt-4o-mini or llama3.2."
            error={errors.modelId}
          >
            <input
              ref={modelIdRef}
              id={modelIdId}
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="openai/gpt-4o-mini"
              value={draft.modelId}
              onChange={(event) => update("modelId", event.target.value)}
              aria-invalid={errors.modelId ? true : undefined}
              aria-describedby={describedBy(modelIdId, Boolean(errors.modelId))}
              className={inputClass(Boolean(errors.modelId))}
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-hairline pt-5">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-[10px] bg-ink px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#26261f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Save provider
          </button>

          <button
            type="button"
            onClick={handleTest}
            disabled={test.kind === "testing"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-hairline bg-surface px-5 text-[13px] font-semibold text-ink-soft transition-colors hover:border-[#cfccc0] hover:bg-[#fafaf6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {test.kind === "testing" && (
              <span
                aria-hidden="true"
                className="size-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent motion-reduce:animate-none"
              />
            )}
            {test.kind === "testing" ? "Testing…" : "Test connection"}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="status"
            aria-live="polite"
            className="min-h-[18px] text-[11.5px] leading-[1.55]"
          >
            {test.kind === "testing" && (
              <span className="text-muted">Testing the connection…</span>
            )}
            {test.kind === "ok" && (
              <span className="inline-flex items-center gap-1.5 font-medium text-accent">
                <CheckIcon />
                Connected — the provider answered.
              </span>
            )}
            {test.kind === "error" && (
              <span className="flex items-start gap-1.5 text-flag">
                <AlertIcon className="mt-[1px] size-3.5 shrink-0" />
                <span>{test.message}</span>
              </span>
            )}
            {test.kind === "idle" && notice && (
              <span className="text-muted">{notice}</span>
            )}
          </div>

          {saved && (
            <button
              type="button"
              onClick={handleRemove}
              className="self-start rounded text-[11px] text-muted underline decoration-hairline underline-offset-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:self-auto"
            >
              Remove saved provider
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function ProviderChip({ saved, dirty }: { saved: boolean; dirty: boolean }) {
  if (!saved) {
    return (
      <span className="rounded-full bg-[#f1f0e9] px-2.5 py-1 text-[10px] font-semibold text-muted">
        Not set up
      </span>
    );
  }

  if (dirty) {
    return (
      <span className="rounded-full bg-[#f1f0e9] px-2.5 py-1 text-[10px] font-semibold text-muted">
        Unsaved changes
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-semibold text-accent">
      <CheckIcon />
      Saved on this device
    </span>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted"
      >
        {label}
      </label>
      <div className="mt-2">{children}</div>
      <p id={`${id}-hint`} className="mt-1.5 text-[11px] leading-[1.5] text-subtle">
        {hint}
      </p>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[11px] font-medium text-flag">
          {error}
        </p>
      )}
    </div>
  );
}

function ProviderSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="mt-7 rounded-[20px] border border-hairline bg-surface px-5 py-5 sm:px-7 sm:py-6"
    >
      <div className="h-3.5 w-32 rounded-full bg-[#f1f0e9]" />
      <div className="mt-2 h-2.5 w-72 max-w-full rounded-full bg-[#f7f7f2]" />
      <div className="mt-6 flex flex-col gap-5">
        {[0, 1, 2].map((row) => (
          <div key={row}>
            <div className="h-2.5 w-20 rounded-full bg-[#f1f0e9]" />
            <div className="mt-2.5 h-11 w-full rounded-[10px] border border-hairline bg-[#fbfbf7]" />
          </div>
        ))}
      </div>
    </div>
  );
}
