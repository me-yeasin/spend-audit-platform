"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { RecurringGroup } from "../../lib/detect-recurring";
import {
  runAiAudit,
  type AiAudit,
  type AiAuditErrorCode,
  type AiAuditItem,
  type AiRecommendation,
} from "../../lib/ai-audit";
import { formatCost } from "../../lib/format";
import {
  AlertIcon,
  CheckIcon,
  ChevronIcon,
  CopyIcon,
  LockIcon,
  SparkIcon,
} from "./icons";
import { useAiProvider } from "./use-ai-provider";

type PanelState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; audit: AiAudit }
  | { kind: "error"; code: AiAuditErrorCode; message: string };

type ActionableItem = AiAuditItem & {
  recommendation: Extract<AiRecommendation, "cut" | "review">;
};

function isActionable(item: AiAuditItem): item is ActionableItem {
  return item.recommendation === "cut" || item.recommendation === "review";
}

const PRIMARY_BUTTON =
  "inline-flex h-9 items-center justify-center rounded-[9px] bg-ink px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#26261f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const SECONDARY_BUTTON =
  "inline-flex h-9 items-center justify-center rounded-[9px] border border-hairline bg-surface px-4 text-[12.5px] font-semibold text-ink-soft transition-colors hover:border-[#cfccc0] hover:bg-[#fafaf6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const CARD_SHADOW =
  "shadow-[0_1px_2px_rgba(18,18,15,0.04),0_18px_44px_-30px_rgba(18,18,15,0.28)]";

function charges(count: number): string {
  return count === 1 ? "charge" : "charges";
}

function slug(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function errorHint(code: AiAuditErrorCode): string {
  switch (code) {
    case "auth":
      return "Your provider rejected the key. Update it in settings and try again.";
    case "model":
      return "That model or endpoint was not found. Check the model ID and the base URL.";
    case "network":
      return "Some providers block browser requests. A local model or a CORS-friendly provider usually works.";
    case "timeout":
      return "The model took too long to answer. Try again, or use a smaller, faster model.";
    case "format":
      return "The reply could not be read. Try again, or use a model that follows JSON instructions well.";
    default:
      return "";
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // The fallback below covers older browsers and blocked permissions.
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-9999px";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

export default function AiCutList({ groups }: { groups: RecurringGroup[] }) {
  const { config } = useAiProvider();
  const provider = config ?? null;

  const [state, setState] = useState<PanelState>({ kind: "idle" });
  const [openMessage, setOpenMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const runId = useRef(0);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      runId.current += 1;
      abortRef.current?.abort();
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  if (groups.length === 0) return null;

  async function run() {
    if (!provider) return;

    const id = ++runId.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setOpenMessage(null);
    setCopied(null);
    setState({ kind: "running" });
    setAnnouncement(
      `Auditing ${groups.length} recurring ${charges(groups.length)}.`,
    );

    const outcome = await runAiAudit(provider, groups, {
      signal: controller.signal,
    });

    if (id !== runId.current) return;
    abortRef.current = null;

    if (outcome.ok) {
      setState({ kind: "done", audit: outcome.audit });
      setAnnouncement(
        `Audit ready. ${outcome.audit.counts.cut} to cut, ${outcome.audit.counts.review} to review, ${outcome.audit.counts.keep} kept.`,
      );
      return;
    }

    if (outcome.code === "aborted") {
      setState({ kind: "idle" });
      setAnnouncement("Audit stopped.");
      return;
    }

    setState({ kind: "error", code: outcome.code, message: outcome.message });
    setAnnouncement(`Audit failed. ${outcome.message}`);
  }

  function stop() {
    runId.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ kind: "idle" });
    setAnnouncement("Audit stopped.");
  }

  async function copy(item: AiAuditItem) {
    const ok = await copyText(item.cancellation);
    if (!ok) {
      setAnnouncement("Copy failed. Select the message and copy it yourself.");
      return;
    }

    setCopied(item.group.key);
    setAnnouncement("Cancellation message copied.");
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => {
      setCopied((current) => (current === item.group.key ? null : current));
    }, 2200);
  }

  return (
    <section
      className="mx-auto w-full max-w-[900px]"
      aria-labelledby="ai-cut-list-heading"
      data-ai-cut-list
      data-ai-state={state.kind}
    >
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="relative">
        <div
          className={`relative rounded-[20px] border border-hairline bg-surface ${CARD_SHADOW}`}
        >
          {state.kind === "idle" && (
            <IdleState
              groups={groups}
              provider={provider}
              onRun={run}
            />
          )}

          {state.kind === "running" && (
            <RunningState groups={groups} onStop={stop} />
          )}

          {state.kind === "error" && (
            <ErrorState
              code={state.code}
              message={state.message}
              onRetry={run}
            />
          )}

          {state.kind === "done" && (
            <ResultsState
              audit={state.audit}
              provider={provider}
              openMessage={openMessage}
              copied={copied}
              onToggle={(key) =>
                setOpenMessage((current) => (current === key ? null : key))
              }
              onCopy={(item) => copy(item)}
              onRun={run}
            />
          )}
        </div>

        {/* Animated snake-style border hugging the card */}
        <span
          aria-hidden="true"
          className="snake-border pointer-events-none absolute inset-0 rounded-[20px]"
        />
      </div>
    </section>
  );
}

function PanelHeading() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-accent-soft text-accent">
        <SparkIcon />
      </span>
      <h2
        id="ai-cut-list-heading"
        className="text-[15px] font-semibold tracking-[-0.01em] text-ink"
      >
        AI cut list
      </h2>
    </div>
  );
}

function ProviderLink({ provider }: { provider: { modelId: string } | null }) {
  if (!provider) {
    return (
      <Link
        href="/settings"
        className="rounded text-[10.5px] text-subtle underline decoration-hairline underline-offset-2 transition-colors hover:text-ink-soft"
      >
        Connect a provider
      </Link>
    );
  }

  return (
    <span className="text-[10.5px] text-subtle">
      Using{" "}
      <span
        className="inline-block max-w-[10rem] truncate align-bottom font-medium text-muted"
        title={provider.modelId}
      >
        {provider.modelId}
      </span>{" "}
      ·{" "}
      <Link
        href="/settings"
        className="rounded underline decoration-hairline underline-offset-2 transition-colors hover:text-ink-soft"
      >
        Change
      </Link>
    </span>
  );
}

function WhatsSent() {
  return (
    <details className="group text-[10.5px] text-subtle">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded transition-colors hover:text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        What is sent
        <ChevronIcon className="transition-transform group-open:rotate-90" />
      </summary>
      <div className="mt-2 max-w-[34rem] rounded-[10px] border border-hairline bg-[#faf9f5] px-3.5 py-3">
        <ul className="space-y-1.5 leading-[1.55]">
          <li>Merchant name, exactly as it appears on your statement</li>
          <li>
            Monthly amount, number of payments, months seen, and whether the
            amount varies
          </li>
          <li>Nothing else — no transactions, dates, owners, or account numbers</li>
        </ul>
        <p className="mt-2.5 border-t border-hairline pt-2.5 text-[10px] leading-[1.5]">
          Requests go straight from this browser to your provider, never through
          a Spend Audit server.
        </p>
      </div>
    </details>
  );
}

function IdleState({
  groups,
  provider,
  onRun,
}: {
  groups: RecurringGroup[];
  provider: { modelId: string } | null;
  onRun: () => void;
}) {
  const count = groups.length;

  return (
    <div className="px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="min-w-0">
          <PanelHeading />
          <p className="mt-3 max-w-[38rem] text-[12.5px] leading-[1.65] text-muted">
            One agent, one job: review your {count} repeating{" "}
            {charges(count)}, rank what is worth a second look, and draft the
            cancellation message.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          {provider ? (
            <button type="button" onClick={onRun} className={PRIMARY_BUTTON}>
              Run AI audit
            </button>
          ) : (
            <Link href="/settings" className={PRIMARY_BUTTON}>
              Connect a provider
            </Link>
          )}
          <ProviderLink provider={provider} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-hairline pt-3.5">
        <p className="flex items-center gap-1.5 text-[10.5px] text-subtle">
          <LockIcon className="shrink-0 text-accent" />
          Sends {count} {charges(count)} — never your statement.
        </p>
        <WhatsSent />
      </div>
    </div>
  );
}

function RunningState({
  groups,
  onStop,
}: {
  groups: RecurringGroup[];
  onStop: () => void;
}) {
  return (
    <div className="px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex items-start justify-between gap-3">
        <PanelHeading />
        <button
          type="button"
          onClick={onStop}
          className="rounded text-[11px] font-medium text-muted underline decoration-hairline underline-offset-2 transition-colors hover:text-ink"
        >
          Stop
        </button>
      </div>

      <p className="mt-3 text-[12.5px] leading-[1.6] text-muted">
        Reading {groups.length} {charges(groups.length)} and drafting the
        messages. This usually takes a few seconds.
      </p>

      <div aria-hidden="true" className="mt-5 space-y-3.5">
        {groups.slice(0, 5).map((g, i) => (
          <div
            key={g.key}
            className="flex items-start justify-between gap-4 rounded-[10px] border border-hairline bg-[#fafaf6] px-3.5 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <LoadingDot delay={i * 0.25} />
                <div className="h-2.5 w-28 max-w-[55%] rounded-full bg-[#e8e6df] relative overflow-hidden">
                  <div className="loading-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white to-transparent" />
                </div>
              </div>
              <div className="mt-2 h-2 w-4/5 rounded-full bg-[#f0efea] relative overflow-hidden">
                <div className="loading-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#e0ddd4] to-transparent" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="h-2.5 w-10 rounded-full bg-[#e8e6df] relative overflow-hidden">
                <span className="loading-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white to-transparent" style={{ animationDelay: "0.5s" }} />
              </span>
            </div>
          </div>
        ))}

        {groups.length > 5 && (
          <p className="text-center text-[12px] text-muted">
            +{groups.length - 5} more {groups.length - 5 === 1 ? "charge" : "charges"} being processed...
          </p>
        )}
      </div>

      <p className="mt-5 flex items-center gap-1.5 text-[10.5px] text-subtle">
        <LockIcon className="shrink-0 text-accent" />
        The request is in flight directly to your provider.
      </p>
    </div>
  );
}

function ErrorState({
  code,
  message,
  onRetry,
}: {
  code: AiAuditErrorCode;
  message: string;
  onRetry: () => void;
}) {
  const hint = errorHint(code);

  return (
    <div className="px-5 py-5 sm:px-6 sm:py-6">
      <PanelHeading />

      <div className="mt-4 flex items-start gap-2.5 rounded-[12px] border border-flag/20 bg-flag-soft/45 px-3.5 py-3">
        <AlertIcon className="mt-[1px] size-4 shrink-0 text-flag" />
        <div className="min-w-0">
          <p className="text-[12px] leading-[1.55] text-flag">{message}</p>
          {hint && (
            <p className="mt-1 text-[10.5px] leading-[1.5] text-flag/80">
              {hint}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <button type="button" onClick={onRetry} className={PRIMARY_BUTTON}>
          Try again
        </button>
        <Link href="/settings" className={SECONDARY_BUTTON}>
          Check provider
        </Link>
      </div>

      <p className="mt-3 text-[10.5px] leading-[1.5] text-subtle">
        The failed request was not stored by Spend Audit. Your provider may have
        received it.
      </p>
    </div>
  );
}

function ResultsState({
  audit,
  provider,
  openMessage,
  copied,
  onToggle,
  onCopy,
  onRun,
}: {
  audit: AiAudit;
  provider: { modelId: string } | null;
  openMessage: string | null;
  copied: string | null;
  onToggle: (key: string) => void;
  onCopy: (item: AiAuditItem) => void;
  onRun: () => void;
}) {
  const actionable = audit.items.filter(isActionable);
  const kept = audit.items.filter(
    (item: AiAuditItem) => item.recommendation === "keep",
  );
  const unreviewed = audit.items.filter(
    (item: AiAuditItem) => item.recommendation === "unreviewed",
  );
  const actionableCount = audit.counts.cut + audit.counts.review;

  return (
    <div>
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <PanelHeading />
          <p className="text-[10.5px] text-subtle">
            {audit.sent < audit.total
              ? `${audit.sent} of ${audit.total} charges sent`
              : `${audit.total} ${charges(audit.total)} audited`}
          </p>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            Potential savings
          </p>

          {audit.potentialYearly > 0 ? (
            <>
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span
                  data-ai-savings
                  className="text-[30px] font-semibold leading-none tracking-[-0.025em] tabular-nums text-ink sm:text-[34px]"
                >
                  {formatCost(audit.potentialYearly)}
                </span>
                <span className="text-[12.5px] text-subtle">a year</span>
              </p>
              <p className="mt-2 text-[12px] leading-[1.6] text-muted">
                Up to, if you act on the {actionableCount}{" "}
                {charges(actionableCount)} below —{" "}
                {formatCost(audit.potentialMonthly)} a month.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-ink">
                No clear cuts this time.
              </p>
              <p className="mt-2 text-[12px] leading-[1.6] text-muted">
                The agent kept all {audit.counts.keep} {charges(audit.counts.keep)}.
                Check its reasons below; you can always run it again.
              </p>
            </>
          )}

          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-flag" aria-hidden="true" />
              {audit.counts.cut} to cut
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#b9b6ab]" aria-hidden="true" />
              {audit.counts.review} to review
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
              {audit.counts.keep} kept
            </span>
            {audit.counts.unreviewed > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[#d8d5cb]" aria-hidden="true" />
                {audit.counts.unreviewed} not reviewed
              </span>
            )}
          </p>
        </div>
      </div>

      {actionable.length > 0 ? (
        <ul className="border-t border-hairline">
          {actionable.map((item: ActionableItem, index: number) => (
            <ActionRow
              key={item.group.key}
              item={item}
              index={index}
              open={openMessage === item.group.key}
              copied={copied === item.group.key}
              onToggle={() => onToggle(item.group.key)}
              onCopy={() => onCopy(item)}
            />
          ))}
        </ul>
      ) : (
        <p className="border-t border-hairline px-5 py-4 text-[12px] text-muted sm:px-6">
          Nothing to act on in this list.
        </p>
      )}

      {kept.length > 0 && <KeptSection items={kept} />}
      {unreviewed.length > 0 && <UnreviewedSection items={unreviewed} />}

      <div className="flex flex-col gap-3 border-t border-hairline px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="max-w-[34rem] text-[10px] leading-[1.55] text-subtle">
          AI-generated from the charge list alone — it cannot see how much you
          use each service. Check before cancelling. Not financial advice.
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <ProviderLink provider={provider} />
          {provider && (
            <button
              type="button"
              onClick={onRun}
              className="inline-flex h-8 items-center justify-center rounded-[8px] border border-hairline bg-surface px-3 text-[11px] font-semibold text-ink-soft transition-colors hover:border-[#cfccc0] hover:bg-[#fafaf6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Run again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionRow({
  item,
  index,
  open,
  copied,
  onToggle,
  onCopy,
}: {
  item: ActionableItem;
  index: number;
  open: boolean;
  copied: boolean;
  onToggle: () => void;
  onCopy: (item: ActionableItem) => void;
}) {
  const messageId = `ai-cancellation-${index}-${slug(item.group.key) || "charge"}`;

  return (
    <li className="border-b border-[#efeee7] px-5 py-4 last:border-b-0 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <RecommendationChip value={item.recommendation} />
            <h3
              className="min-w-0 truncate text-[13.5px] font-semibold text-ink"
              title={item.group.name}
            >
              {item.group.name}
            </h3>
          </div>
          <p className="mt-1 text-[12px] leading-[1.6] text-muted">
            {item.reason}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[13px] font-semibold tabular-nums text-ink">
            {formatCost(item.group.monthlyAmount)}
            <span className="text-[10px] font-normal text-subtle"> / mo</span>
          </p>
          <p className="mt-0.5 text-[10.5px] tabular-nums text-subtle">
            {formatCost(item.group.monthlyAmount * 12)} / yr
          </p>
        </div>
      </div>

      {item.cancellation !== "" ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={messageId}
            className="inline-flex items-center gap-1 rounded text-[11px] font-semibold text-ink-soft transition-colors hover:text-ink"
          >
            {open ? "Hide cancellation message" : "View cancellation message"}
            <ChevronIcon direction={open ? "down" : "right"} />
          </button>

          {open && (
            <div
              id={messageId}
              className="mt-2 rounded-[12px] border border-hairline bg-[#faf9f5] px-3.5 py-3"
            >
              <p className="whitespace-pre-wrap text-[12px] leading-[1.7] text-ink-soft">
                {item.cancellation}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline pt-2.5">
                <button
                  type="button"
                  onClick={() => onCopy(item)}
                  aria-label={`Copy cancellation message for ${item.group.name}`}
                  className="inline-flex items-center gap-1.5 rounded text-[11px] font-semibold text-ink transition-colors hover:text-accent"
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? "Copied" : "Copy message"}
                </button>
                <span className="text-[10px] text-subtle">
                  Send it from your own email.
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-1.5 text-[10.5px] text-subtle">
          No cancellation message was drafted for this charge.
        </p>
      )}
    </li>
  );
}

function RecommendationChip({
  value,
}: {
  value: Extract<AiRecommendation, "cut" | "review">;
}) {
  const styles =
    value === "cut"
      ? "bg-flag-soft text-flag"
      : "bg-[#f1f0e9] text-muted";

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles}`}
    >
      {value === "cut" ? "Cut" : "Review"}
    </span>
  );
}

function KeptSection({ items }: { items: AiAuditItem[] }) {
  return (
    <details className="group border-t border-hairline">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-[11.5px] font-semibold text-muted transition-colors hover:text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-6 [&::-webkit-details-marker]:hidden">
        <span>Kept ({items.length})</span>
        <span className="flex items-center gap-1 text-[10.5px] font-normal text-subtle">
          The agent&rsquo;s reasons
          <ChevronIcon className="transition-transform group-open:rotate-90" />
        </span>
      </summary>
      <ul className="border-t border-[#efeee7]">
        {items.map((item) => (
          <li
            key={item.group.key}
            className="flex items-start justify-between gap-4 px-5 py-3 sm:px-6"
          >
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-semibold text-ink-soft">
                {item.group.name}
              </p>
              <p className="mt-0.5 text-[11px] leading-[1.5] text-subtle">
                {item.reason}
              </p>
            </div>
            <p className="shrink-0 text-[11.5px] tabular-nums text-muted">
              {formatCost(item.group.monthlyAmount)}/mo
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}

function LoadingDot({ delay }: { delay: number }) {
  return (
    <span
      className="relative flex size-2 shrink-0"
      style={{ animationDelay: `${delay}s` }}
    >
      <span className="absolute inset-0 rounded-full bg-accent opacity-70 animate-ping" style={{ animationDelay: `${delay}s` }} />
      <span className="relative size-2 rounded-full bg-accent" />
    </span>
  );
}

function UnreviewedSection({ items }: { items: AiAuditItem[] }) {
  return (
    <details className="group border-t border-hairline">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-[11.5px] font-semibold text-muted transition-colors hover:text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-6 [&::-webkit-details-marker]:hidden">
        <span>Not reviewed ({items.length})</span>
        <span className="flex items-center gap-1 text-[10.5px] font-normal text-subtle">
          What was left out
          <ChevronIcon className="transition-transform group-open:rotate-90" />
        </span>
      </summary>
      <ul className="border-t border-[#efeee7]">
        {items.map((item) => (
          <li
            key={item.group.key}
            className="flex items-start justify-between gap-4 px-5 py-3 sm:px-6"
          >
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-semibold text-ink-soft">
                {item.group.name}
              </p>
              <p className="mt-0.5 text-[11px] leading-[1.5] text-subtle">
                {item.reason}
              </p>
            </div>
            <p className="shrink-0 text-[11.5px] tabular-nums text-muted">
              {formatCost(item.group.monthlyAmount)}/mo
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}
