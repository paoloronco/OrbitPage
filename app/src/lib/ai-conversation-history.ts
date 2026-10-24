import { z } from "zod";

export type AiHistoryMessage = {
  role: "user" | "assistant";
  content: string;
  proposal?: z.infer<typeof proposalSchema> | null;
  suggestedPrompts?: string[];
};

const snapshot = z.object({
  profile: z.record(z.string(), z.unknown()), links: z.array(z.record(z.string(), z.unknown())).max(500), theme: z.record(z.string(), z.unknown()),
  shopCurrency: z.string().regex(/^[a-zA-Z]{3}$/).optional(),
  menu: z.record(z.string(), z.unknown()).optional(), shopProducts: z.array(z.record(z.string(), z.unknown())).max(24).optional(),
});
const proposalSchema = z.object({
  previewToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/), summary: z.string().max(1000),
  changes: z.array(z.string().max(500)).max(25), expectedRevision: z.number().int().nonnegative(),
  expiresAt: z.string().datetime(), preview: z.object({ before: snapshot, after: snapshot }),
});
const suggestionsSchema = z.array(z.string().trim().min(1).max(240)).max(3);

const HISTORY_LIMIT = 100;
export const AI_HISTORY_STORAGE_KEY = "orbitpage:ai-conversation:v1";

export function parseAiConversationHistory(value: string | null): AiHistoryMessage[] {
  if (!value || value.length > 2_000_000) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is AiHistoryMessage => (
        item?.role === "user" || item?.role === "assistant"
      ) && typeof item.content === "string" && item.content.trim().length > 0)
      .map(({ role, content, proposal, suggestedPrompts }) => {
        const pending = role === "assistant" ? proposalSchema.safeParse(proposal) : null;
        const suggestions = role === "assistant" ? suggestionsSchema.safeParse(suggestedPrompts) : null;
        return { role, content: content.slice(0, 4_000),
          ...(pending?.success ? { proposal: pending.data } : {}),
          ...(suggestions?.success ? { suggestedPrompts: suggestions.data } : {}),
        };
      })
      .slice(-HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function readAiConversationHistory(storageKey = AI_HISTORY_STORAGE_KEY) {
  try {
    return parseAiConversationHistory(window.localStorage.getItem(storageKey));
  } catch {
    return [];
  }
}

export function writeAiConversationHistory(storageKey: string, messages: readonly { role: "user" | "assistant"; content: string; proposal?: unknown; suggestedPrompts?: string[] }[]) {
  try {
    if (messages.length === 0) window.localStorage.removeItem(storageKey);
    else {
      const serialized = JSON.stringify(messages.slice(-HISTORY_LIMIT));
      if (serialized.length > 2_000_000) return;
      window.localStorage.setItem(storageKey, JSON.stringify(parseAiConversationHistory(serialized)));
    }
  } catch {
    // History is optional when browser storage is unavailable.
  }
}
