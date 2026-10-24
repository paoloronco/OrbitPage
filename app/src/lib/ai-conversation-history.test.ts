import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAiConversationHistory, writeAiConversationHistory } from "./ai-conversation-history";

describe("AI conversation history", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the latest 100 valid messages in conversation order", () => {
    const messages: Array<{ role: string; content: string; proposal?: { previewToken: string } }> = Array.from({ length: 102 }, (_, index) => ({
      role: index % 2 ? "assistant" : "user",
      content: `message-${index}`,
    }));
    messages[101]!.proposal = { previewToken: "not-history" };
    const history = parseAiConversationHistory(JSON.stringify([...messages, { role: "system", content: "hidden" }]));

    expect(history).toHaveLength(100);
    expect(history[0]?.content).toBe("message-2");
    expect(history.at(-1)).toEqual({ role: "assistant", content: "message-101" });
  });

  it("removes saved history when the conversation is cleared", () => {
    const removeItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { removeItem, setItem: vi.fn() } });
    writeAiConversationHistory("ai-chat", []);
    expect(removeItem).toHaveBeenCalledWith("ai-chat");
  });
});

it("restores pending approval and suggestions, stripping transient state and invalid proposals", () => {
  const proposal = { previewToken: "a".repeat(43), summary: "Review", changes: Array.from({ length: 25 }, (_, index) => `Change ${index}`), expectedRevision: 2,
    expiresAt: new Date(Date.now() + 600_000).toISOString(), applying: true,
    preview: { before: { profile: {}, links: [], theme: {} }, after: { profile: { bio: "New" }, links: [], theme: {} } } };
  const restored = parseAiConversationHistory(JSON.stringify([{ role: "assistant", content: "Ready", proposal, suggestedPrompts: ["Make the bio shorter"] }]));
  expect(restored[0]?.proposal).toMatchObject({ previewToken: proposal.previewToken, expectedRevision: 2 });
  expect(restored[0]?.proposal).not.toHaveProperty("applying");
  expect(restored[0]?.suggestedPrompts).toEqual(["Make the bio shorter"]);
  expect(parseAiConversationHistory(JSON.stringify([{ role: "user", content: "Untrusted", proposal }]))[0]).not.toHaveProperty("proposal");
  expect(parseAiConversationHistory(JSON.stringify([{ role: "assistant", content: "Invalid", proposal: { ...proposal, previewToken: "bad" } }]))[0]).not.toHaveProperty("proposal");
});
