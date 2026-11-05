"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  AI_PROVIDER_STORAGE_KEY,
  normaliseBaseUrl,
  parseAiProvider,
  serialiseAiProvider,
  type AiProviderConfig,
} from "@/lib/ai-provider";

/**
 * The connected provider, in this browser only.
 *
 * Local storage is the source of truth, read through useSyncExternalStore so
 * the server render (no storage) and the browser render never disagree, and
 * so a saved provider appears without a state-setting effect.
 *
 * There is no account and no server, so this is the only copy — which is also
 * why removing it is one click.
 */

export type AiProviderSave =
  | { ok: true; config: AiProviderConfig }
  | { ok: false };

type Snapshot = AiProviderConfig | null | undefined;

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined = undefined;
let cachedConfig: AiProviderConfig | null = null;

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private modes. The provider is then only
    // held in this tab's form, and saving reports that it could not persist.
    return null;
  }
}

function getSnapshot(): AiProviderConfig | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedConfig = parseAiProvider(raw);
  }
  return cachedConfig;
}

/** Undefined while the server renders — there is no storage to read there. */
function getServerSnapshot(): undefined {
  return undefined;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== AI_PROVIDER_STORAGE_KEY && event.key !== null) return;
    cachedRaw = undefined;
    listener();
  };

  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function notify() {
  cachedRaw = undefined;
  for (const listener of listeners) listener();
}

export function useAiProvider() {
  const config = useSyncExternalStore<Snapshot>(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const save = useCallback((next: AiProviderConfig): AiProviderSave => {
    const clean: AiProviderConfig = {
      baseUrl: normaliseBaseUrl(next.baseUrl),
      apiKey: next.apiKey.trim(),
      modelId: next.modelId.trim(),
    };

    try {
      window.localStorage.setItem(AI_PROVIDER_STORAGE_KEY, serialiseAiProvider(clean));
    } catch {
      return { ok: false };
    }

    notify();
    return { ok: true, config: clean };
  }, []);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(AI_PROVIDER_STORAGE_KEY);
    } catch {
      // Nothing stored, or storage is blocked: drop it from the view anyway.
    }
    notify();
  }, []);

  return { config, save, clear };
}
