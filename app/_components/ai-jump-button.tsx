"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SparkIcon } from "./icons";

/**
 * A floating shortcut to the AI cut list.
 *
 * The panel sits below lists that grow with the data, so on a long statement
 * it is off-screen. This button appears whenever the panel exists but is not
 * in view, and scrolls it into view on click. While the panel is visible the
 * button hides itself — it is a way to find the feature, not a second copy of
 * its controls.
 */
export default function AiJumpButton() {
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const mutationRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const handleIntersection = ([entry]: IntersectionObserverEntry[]) => {
      setVisible(!entry.isIntersecting);
    };

    const attachObserver = () => {
      const target = document.querySelector("[data-ai-cut-list]");
      observerRef.current?.disconnect();

      if (!target) {
        setVisible(false);
        return;
      }

      observerRef.current = new IntersectionObserver(handleIntersection, {
        threshold: 0.08,
      });
      observerRef.current.observe(target);
    };

    // Initial attach
    attachObserver();

    // Watch for the panel being added or removed
    mutationRef.current = new MutationObserver(() => {
      // Defer the re-attach to avoid setState during render
      queueMicrotask(attachObserver);
    });
    mutationRef.current.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutationRef.current?.disconnect();
      observerRef.current?.disconnect();
    };
  }, []);

  function jump() {
    const target = document.querySelector<HTMLElement>("[data-ai-cut-list]");
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      className={[
        "fixed bottom-5 right-5 z-40 sm:bottom-7 sm:right-7",
        "transition-all duration-200",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={jump}
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
        data-ai-jump
        data-animated-border
        className={[
          "relative flex items-center gap-2 rounded-full border border-hairline bg-surface py-2.5 pl-3 pr-4 text-[12.5px] font-semibold text-ink shadow-[0_2px_6px_rgba(18,18,15,0.08),0_18px_44px_-24px_rgba(18,18,15,0.45)] transition-all duration-200",
          "hover:border-[#cfccc0] hover:bg-[#fafaf6]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none",
        ].join(" ")}
      >
        {/* Animated snake border using gradient */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            padding: "2px",
            background: `linear-gradient(var(--color-surface), var(--color-surface)) padding-box,
                         conic-gradient(from var(--border-angle, 0deg), transparent 0%, #0E7C5A 10%, transparent 20%) border-box`,
            border: "2px solid transparent",
            WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            animation: visible ? "rotate-border 3s linear infinite" : "none",
          }}
        />
        <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-accent">
          <SparkIcon className="size-[13px]" />
        </span>
        AI cut list
      </button>

      <style jsx>{`
        @property --border-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }

        @keyframes rotate-border {
          0% {
            --border-angle: 0deg;
          }
          100% {
            --border-angle: 360deg;
          }
        }
      `}</style>
    </div>
  );
}
