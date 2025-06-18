import { Hammer } from "lucide-react";
import { CodeBlock } from "../code/CodeBlock";
import { MessageDeleteButton } from "../message-actions/MessageDeleteButton";
import type { Message } from "~/lib/chat/types";
import { tryParseJson } from "~/lib/utils";

export function ToolResultMessage({
  message,
  handleDelete,
}: {
  message: Message;
  handleDelete: (messageId: string, force?: boolean) => Promise<void>;
}) {
  return (
    <div
      key={message.id}
      className="flex prose gap-3 py-3 px-6 bg-muted/30 border-l-4 border-primary/50"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Hammer className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            Tool Result: {message.name}
          </span>
        </div>
        <pre>
          <CodeBlock>
            {typeof message.content === "string"
              ? JSON.stringify(tryParseJson(message.content), null, 2)
              : JSON.stringify(message.content, null, 2)}
          </CodeBlock>
        </pre>
      </div>
      <MessageDeleteButton messageId={message.id} onDelete={handleDelete} />
    </div>
  );
}

export function ToolMessage({ message }: { message: Message }) {
  return (
    message.tool_calls &&
    !message.tool_calls.some((t) => ["web_search"].includes(t.function.name)) &&
    !message.content &&
    message.tool_calls.length > 0 && (
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Hammer className="h-4 w-4" />
          <span>Using tools:</span>
        </div>
        {message.tool_calls.map((toolCall) => (
          <div key={toolCall.id} className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="font-medium mb-1">{toolCall.function.name}</div>
            <pre>
              <CodeBlock>
                {JSON.stringify(
                  tryParseJson(toolCall.function.arguments),
                  null,
                  2,
                )}
              </CodeBlock>
            </pre>
          </div>
        ))}
      </div>
    )
  );
}
