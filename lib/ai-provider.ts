/**
 * The AI provider the user connects.
 *
 * Spend Audit ships without an AI service of its own: the user names an
 * OpenAI-compatible endpoint and every request goes from this browser straight
 * to that endpoint with their key. Nothing is routed through a Spend Audit
 * server, and the key is never stored anywhere but this browser.
 *
 * Pure parsing, normalising and the connection test live here so the rules can
 * be exercised without a browser; the storage hook is client-side.
 */

export type AiProviderConfig = {
  /** API root, e.g. "https://openrouter.ai/api/v1". */
  baseUrl: string;
  /** Bearer key. Empty is valid for local models. */
  apiKey: string;
  /** Exactly as the provider names it. */
  modelId: string;
};

export const AI_PROVIDER_STORAGE_KEY = "spend-audit.ai-provider.v1";

export function emptyAiProvider(): AiProviderConfig {
  return { baseUrl: "", apiKey: "", modelId: "" };
}

/** Trim and drop trailing slashes, so "/v1/" and "/v1" are one address. */
export function normaliseBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

/** Read a stored provider, ignoring anything malformed. */
export function parseAiProvider(raw: string | null): AiProviderConfig | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const record = parsed as Record<string, unknown>;
  const baseUrl = typeof record.baseUrl === "string" ? normaliseBaseUrl(record.baseUrl) : "";
  const apiKey = typeof record.apiKey === "string" ? record.apiKey.trim() : "";
  const modelId = typeof record.modelId === "string" ? record.modelId.trim() : "";

  if (baseUrl === "" || modelId === "") return null;
  return { baseUrl, apiKey, modelId };
}

export function serialiseAiProvider(config: AiProviderConfig): string {
  return JSON.stringify({
    baseUrl: normaliseBaseUrl(config.baseUrl),
    apiKey: config.apiKey.trim(),
    modelId: config.modelId.trim(),
  });
}

export type AiProviderField = "baseUrl" | "apiKey" | "modelId";
export type AiProviderErrors = Partial<Record<AiProviderField, string>>;

/** Field errors, empty when the provider is ready to save. */
export function validateAiProvider(config: AiProviderConfig): AiProviderErrors {
  const errors: AiProviderErrors = {};
  const baseUrl = normaliseBaseUrl(config.baseUrl);

  if (baseUrl === "") {
    errors.baseUrl = "Add the provider's API base URL.";
  } else {
    try {
      const url = new URL(baseUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        errors.baseUrl = "Use an http:// or https:// address.";
      }
    } catch {
      errors.baseUrl = "That does not look like a valid URL.";
    }
  }

  if (config.modelId.trim() === "") {
    errors.modelId = "Add the model ID your provider expects.";
  }

  return errors;
}

/** The chat-completions endpoint for a base URL, without doubling the path. */
export function chatCompletionsUrl(baseUrl: string): string {
  const base = normaliseBaseUrl(baseUrl);
  return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
}

// --------------------------------------------------------------- transport

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatErrorCode =
  | "auth"
  | "http"
  | "model"
  | "network"
  | "timeout"
  | "format"
  | "aborted";

export type ChatOutcome =
  | { ok: true; content: string }
  | { ok: false; code: ChatErrorCode; message: string };

export type ChatRequestOptions = {
  /** How long the provider may take before the request is abandoned. */
  timeoutMs?: number;
  /** Caller-side cancellation, e.g. the user pressing Stop. */
  signal?: AbortSignal;
};

function parseBody(raw: string): unknown {
  if (raw.trim() === "") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function providerMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const error = (data as { error?: unknown }).error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim() !== "") return message.trim();
  }

  const message = (data as { message?: unknown }).message;
  if (typeof message === "string" && message.trim() !== "") return message.trim();

  return null;
}

/** Read a chat reply, tolerating the part-array form some providers use. */
function replyFrom(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const first = choices[0];
  if (!first || typeof first !== "object") return null;

  const message = (first as { message?: unknown }).message;
  if (message && typeof message === "object") {
    const content = (message as { content?: unknown }).content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      const parts = content
        .filter(
          (part): part is { text: string } =>
            Boolean(part) && typeof part === "object" && typeof (part as { text?: unknown }).text === "string",
        )
        .map((part) => part.text);
      if (parts.length > 0) return parts.join("\n");
    }
  }

  // Older completion-style providers put the text at choices[].text.
  const text = (first as { text?: unknown }).text;
  return typeof text === "string" ? text : null;
}

function errorForStatus(status: number): ChatErrorCode {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "model";
  return "http";
}

/**
 * One chat-completions request to the user's provider.
 *
 * The body is deliberately plain — model and messages, nothing else. Reasoning
 * models reject sampling settings and token caps that older models accept, so
 * leaving them out keeps every compatible provider working.
 */
export async function requestChatCompletion(
  config: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatRequestOptions = {},
): Promise<ChatOutcome> {
  const baseUrl = normaliseBaseUrl(config.baseUrl);
  const model = config.modelId.trim();
  if (baseUrl === "" || model === "") {
    return { ok: false, code: "http", message: "The provider is not configured." };
  }
  if (options.signal?.aborted) {
    return { ok: false, code: "aborted", message: "The request was stopped." };
  }

  const key = config.apiKey.trim();
  const timeoutMs = options.timeoutMs ?? 30_000;
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const stop = () => controller.abort();
  options.signal?.addEventListener("abort", stop, { once: true });

  try {
    const response = await fetch(chatCompletionsUrl(baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key === "" ? {} : { Authorization: `Bearer ${key}` }),
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });

    const data = parseBody(await response.text());

    if (!response.ok) {
      return {
        ok: false,
        code: errorForStatus(response.status),
        message:
          providerMessage(data) ??
          `The provider answered with HTTP ${response.status}.`,
      };
    }

    const content = replyFrom(data);
    if (content === null) {
      return {
        ok: false,
        code: "format",
        message:
          "The provider answered, but not with a chat completion. Check that the base URL ends in /v1 and that the model ID exists.",
      };
    }

    return { ok: true, content };
  } catch {
    if (options.signal?.aborted) {
      return { ok: false, code: "aborted", message: "The request was stopped." };
    }
    if (timedOut) {
      return {
        ok: false,
        code: "timeout",
        message: `The provider took longer than ${Math.round(timeoutMs / 1000)} seconds to answer.`,
      };
    }
    return {
      ok: false,
      code: "network",
      message:
        "Could not reach the provider. Check the base URL, and whether it allows requests from a browser (CORS).",
    };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", stop);
  }
}

export type AiProviderTest =
  | { ok: true; reply: string }
  | { ok: false; message: string };

/** Prove the provider answers before the audit asks it for anything real. */
export async function testAiProvider(config: AiProviderConfig): Promise<AiProviderTest> {
  const outcome = await requestChatCompletion(
    config,
    [{ role: "user", content: "Reply with the single word: connected" }],
    { timeoutMs: 20_000 },
  );

  if (!outcome.ok) return { ok: false, message: outcome.message };
  return { ok: true, reply: outcome.content.trim() };
}
