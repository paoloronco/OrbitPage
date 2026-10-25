export type AiAssistantMobileView = "chat" | "tools";

export function AiAssistantMobileTabs({ value, onChange, toolsLabel }: {
  value: AiAssistantMobileView;
  onChange: (value: AiAssistantMobileView) => void;
  toolsLabel: string;
}) {
  return <div className="ai-assistant-mobile-tabs" role="group" aria-label="AI Assistant">
    <button type="button" aria-pressed={value === "chat"} onClick={() => onChange("chat")}>Chat</button>
    <button type="button" aria-pressed={value === "tools"} onClick={() => onChange("tools")}>{toolsLabel}</button>
  </div>;
}
