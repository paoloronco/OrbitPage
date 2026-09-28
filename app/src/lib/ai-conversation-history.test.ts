import { describe, expect, it } from "vitest";
import { parseAiConversationHistory } from "./ai-conversation-history";

describe("AI conversation history", () => {
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
});
