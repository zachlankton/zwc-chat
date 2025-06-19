import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "~/lib/chat/markdown-components";
import type { Message } from "~/lib/chat/types";
import { ToolMessage } from "./ToolMessage";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";

export function MessageAvatar({ message }: { message: Message }) {
  return (
    <Avatar className="h-8 w-8 @max-[560px]:hidden">
      {message.role === "assistant" ? (
        <>
          <AvatarFallback>AI</AvatarFallback>
        </>
      ) : (
        <>
          <AvatarFallback>U</AvatarFallback>
        </>
      )}
    </Avatar>
  );
}

function Markdown({ children }: { children: string | null }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={markdownComponents}
    >
      {children}
    </ReactMarkdown>
  );
}

export function UserMessage({ message }: { message: Message }) {
  return (
    <div className="prose prose-sm text-sm user-message max-w-full max-h-[40vh] overflow-y-auto">
      {typeof message.content === "string" ? (
        <Markdown>{message.content}</Markdown>
      ) : (
        <div className="space-y-2">
          {message.content.map((item, index) => {
            if (item.type === "text") {
              return <Markdown key={index}>{item.text || ""}</Markdown>;
            } else if (item.type === "image_url") {
              return (
                <img
                  key={index}
                  src={item.image_url?.url}
                  alt="Uploaded image"
                  className="max-w-full rounded-lg"
                />
              );
            } else if (item.type === "file") {
              return (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-primary/10 rounded-lg p-2"
                >
                  <span className="text-sm">📎 {item.file?.filename}</span>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

export function AssistantMessage({
  message,
  isLoading,
  streamingMessageId,
}: {
  message: Message;
  isLoading: boolean;
  streamingMessageId: string | null;
}) {
  return (
    <div className="prose prose-sm">
      {message.reasoning ? (
        <>
          <h1>Reasoning</h1>
          <Markdown>{message.reasoning}</Markdown>
          <hr />
        </>
      ) : null}

      <Markdown>
        {typeof message.content === "string"
          ? message.content
          : "Assistant response"}
      </Markdown>

      {message.stoppedByUser ? (
        <div className="bg-primary rounded p-2">Stopped by user</div>
      ) : null}

      {/* Display tool calls if present */}
      <ToolMessage message={message} />

      {isLoading && streamingMessageId === message.id && !message.content && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" />
            <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse [animation-delay:0.2s]" />
            <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse [animation-delay:0.4s]" />
          </div>
          <span className="text-sm">Thinking...</span>
        </div>
      )}
    </div>
  );
}
