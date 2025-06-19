import type { ToolCall } from "~/types/tools";
import type { Message } from "./types";

export function handleChunk({
  value,
  setMessages,
  assistantMessage,
  onNewContent,
  onToolCalls,
}: {
  value: any;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  assistantMessage: Message;
  onNewContent?: (content: string) => void;
  onToolCalls?: (toolCalls: ToolCall[]) => void;
}) {
  const usage = value?.usage;

  if (usage) {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMessage.id
          ? {
              ...msg,
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
            }
          : msg,
      ),
    );
  }

  const choice = value?.choices?.[0];
  const delta = choice?.delta;

  if (!delta) {
    console.error("delta is not defined", value);
    return;
  }

  // Handle regular content
  if (delta.content || delta.reasoning) {
    const msgKey = delta.reasoning ? "reasoning" : "content";
    const newContent = delta[msgKey] || "";

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMessage.id
          ? {
              ...msg,
              tool_calls: undefined, //tool calls and content are mutually exclusive
              stoppedByUser: false, // cant be stopped if we a pushing newContent
              [msgKey]: (msg[msgKey] ?? "") + newContent,
            }
          : msg,
      ),
    );

    // Notify about new content for TTS
    if (newContent && onNewContent) {
      onNewContent(newContent);
    }
  }

  if (delta.annotations) {
    assistantMessage.annotations = delta.annotations;
  }

  // Handle tool calls streaming
  if (delta.tool_calls) {
    // Initialize tool_calls array if needed
    assistantMessage.tool_calls = assistantMessage.tool_calls ?? [];

    // Process each tool call delta
    for (const toolCallDelta of delta.tool_calls) {
      const index = toolCallDelta.index;

      // Initialize tool call if it's the first chunk for this index
      if (!assistantMessage.tool_calls[index]) {
        assistantMessage.tool_calls[index] = {
          id: toolCallDelta.id || "",
          type: toolCallDelta.type || "function",
          function: {
            name: toolCallDelta.function?.name || "",
            arguments: "",
          },
        };
      }

      // Update tool call data
      if (toolCallDelta.id) {
        assistantMessage.tool_calls[index].id = toolCallDelta.id;
      }
      if (toolCallDelta.function?.name) {
        assistantMessage.tool_calls[index].function.name =
          toolCallDelta.function.name;
      }
      if (toolCallDelta.function?.arguments) {
        assistantMessage.tool_calls[index].function.arguments +=
          toolCallDelta.function.arguments;
      }
    }

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== assistantMessage.id) return msg;

        // Update the assistantMessage reference with the tool calls
        return { ...msg, tool_calls: assistantMessage.tool_calls };
      }),
    );
  }

  // Check for finish reason
  if (choice?.finish_reason === "tool_calls") {
    // Tool calls are complete - notify the callback
    if (
      assistantMessage.tool_calls &&
      assistantMessage.tool_calls.length > 0 &&
      onToolCalls
    ) {
      onToolCalls(assistantMessage.tool_calls);
    }
  }

  setMessages((prev) =>
    prev.map((msg) =>
      msg.id === assistantMessage.id
        ? { ...msg, timeToFinish: Date.now() - msg.timestamp }
        : msg,
    ),
  );
}
