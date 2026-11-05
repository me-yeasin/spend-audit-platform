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

export type AiProviderTest =
  | { ok: true; reply: string }
  | { ok: false; message: string };

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

function providerReply(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const first = choices[0];
  if (!first || typeof first !== "object") return null;

  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;

  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content.trim() : null;
}

/**
 * Prove the provider answers before anything is saved.
 *
 * The request is deliberately plain — model and one message, nothing else.
 * Reasoning models reject sampling settings and token caps that older models
 * accept, so leaving them out keeps every compatible provider working.
 */
export async function testAiProvider(config: AiProviderConfig): Promise<AiProviderTest> {
  const key = config.apiKey.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(chatCompletionsUrl(config.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key === "" ? {} : { Authorization: `Bearer ${key}` }),
      },
      body: JSON.stringify({
        model: config.modelId.trim(),
        messages: [{ role: "user", content: "Reply with the single word: connected" }],
        stream: false,
      }),
      signal: controller.signal,
    });

    const body = parseBody(await response.text());

    if (!response.ok) {
      return {
        ok: false,
        message:
          providerMessage(body) ??
          `The provider answered with HTTP ${response.status}.`,
      };
    }

    const reply = providerReply(body);
    if (reply === null) {
      return {
        ok: false,
        message:
          "The provider answered, but not with a chat completion. Check that the base URL ends in /v1 and that the model ID exists.",
      };
    }

    return { ok: true, reply };
  } catch {
    if (controller.signal.aborted) {
      return {
        ok: false,
        message: "The provider took longer than 20 seconds to answer.",
      };
    }
    return {
      ok: false,
      message:
        "Could not reach the provider. Check the base URL, and whether it allows requests from a browser (CORS).",
    };
  } finally {
    clearTimeout(timer);
  }
}
