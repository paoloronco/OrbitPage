export type AiHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

const HISTORY_LIMIT = 100;
export const AI_HISTORY_STORAGE_KEY = "orbitpage:ai-conversation:v1";

export function parseAiConversationHistory(value: string | null): AiHistoryMessage[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is AiHistoryMessage => (
        item?.role === "user" || item?.role === "assistant"
      ) && typeof item.content === "string" && item.content.trim().length > 0)
      .map(({ role, content }) => ({ role, content: content.slice(0, 4_000) }))
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

export function writeAiConversationHistory(storageKey: string, messages: readonly AiHistoryMessage[]) {
  try {
    if (messages.length === 0) window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, JSON.stringify(messages.slice(-HISTORY_LIMIT)));
  } catch {
    // History is optional when browser storage is unavailable.
  }
}
