import { Sparkles } from "lucide-react";
import type { HandleRetry, Message, ModelsResponse } from "~/lib/chat/types";
import type { ChatSettings } from "~/stores/chat-settings";
import { MessageDeleteButton } from "../message-actions/MessageDeleteButton";
import { cn } from "~/lib/utils";
import { MessageRetryButton } from "../message-actions/MessageRetryButton";
import { MessageBranchButton } from "../message-actions/MessageBranchButton";
import { MessageSpeakButton } from "../message-actions/MessageSpeakButton";
import { MessageCopyButton } from "../message-actions/MessageCopyButton";
import { MessageEditButton } from "../message-actions/MessageEditButton";
import { ToolResultMessage } from "./ToolMessage";
import { AssistantMessage, MessageAvatar, UserMessage } from "./MessageItem";

export function MessageContent({
  messages,
  chatSettings,
  handleBranch,
  handleDelete,
  handleRetry,
  handleEdit,
  isLoading,
  streamingMessageId,
  selectedModel,
  modelsData,
  speakingMessageId,
  toggleSpeakMessage,
}: {
  messages: Message[];
  chatSettings: ChatSettings;
  handleBranch: (messageId: string, messageIndex: number) => Promise<void>;
  handleDelete: (messageId: string, force?: boolean) => Promise<void>;
  handleRetry: HandleRetry;
  handleEdit: (
    messageId: string,
    newContent: string,
    regenerateNext: boolean,
  ) => Promise<void>;
  isLoading: boolean;
  streamingMessageId: string | null;
  selectedModel: string;
  modelsData?: ModelsResponse;
  speakingMessageId: string | null;
  toggleSpeakMessage: (messageId: string) => void;
}) {
  return messages.map((message, index) => {
    if (message.role === "system") return null;

    // Hide tool messages if setting is enabled
    if (message.role === "tool" && chatSettings.hideToolCallMessages) {
      return null;
    }

    // Handle tool messages
    if (message.role === "tool") {
      return (
        <ToolResultMessage message={message} handleDelete={handleDelete} />
      );
    }

    // Hide assistant messages with tool calls if setting is enabled
    if (
      message.role === "assistant" &&
      message.tool_calls &&
      message.tool_calls.length > 0 &&
      chatSettings.hideToolCallMessages
    ) {
      return null;
    }

    return (
      <div
        key={message.id}
        id={message.id}
        className={cn(
          "flex gap-3 py-6 border-border/50 last:border-0",
          message.role === "user" ? "flex-row-reverse" : "",
        )}
      >
        <MessageAvatar message={message} />
        <div
          className={cn(
            "flex-1 space-y-2 max-w-[88%] @max-[560px]:max-w-full",
            message.role === "user" ? "flex flex-col items-end" : "",
          )}
        >
          <div
            className={cn(
              "rounded-2xl px-5 py-3 max-w-full shadow-sm",
              message.role === "user"
                ? "bg-muted/100 text-foreground"
                : "bg-muted/50 border border-border/50",
            )}
          >
            {message.role === "user" ? (
              <UserMessage message={message} />
            ) : (
              <AssistantMessage
                message={message}
                isLoading={isLoading}
                streamingMessageId={streamingMessageId}
              />
            )}
          </div>
          <div className="flex @max-[560px]:px-10 max-w-4xl items-center justify-between text-xs text-muted-foreground">
            <div className="flex @max-[560px]:hidden items-center gap-2">
              {message.model && message.role === "assistant" && (
                <>
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {message.model.split("/")[1] || message.model}
                  </span>
                </>
              )}
              {message.totalTokens && (
                <>
                  <span>•</span>
                  <span>{message.totalTokens} tokens</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              {message.role === "assistant" && (
                <>
                  <MessageRetryButton
                    messageIndex={index}
                    messageModel={message.model ?? ""}
                    currentModel={selectedModel}
                    onRetry={handleRetry}
                    modelsData={modelsData}
                  />
                  <MessageBranchButton
                    messageId={message.id}
                    messageIndex={index}
                    onBranch={handleBranch}
                  />
                  <MessageSpeakButton
                    messageId={message.id}
                    isPlaying={speakingMessageId === message.id}
                    onToggleSpeak={toggleSpeakMessage}
                  />
                  <MessageCopyButton
                    content={message.content}
                    reasoning={message.reasoning}
                  />
                </>
              )}
              <MessageEditButton
                messageId={message.id}
                content={message.content}
                onEdit={handleEdit}
                isUserMessage={message.role === "user"}
                hasNextAssistantMessage={
                  message.role === "user" &&
                  messages.findIndex(
                    (m, i) =>
                      i > messages.indexOf(message) && m.role === "assistant",
                  ) !== -1
                }
              />
              <MessageDeleteButton
                messageId={message.id}
                onDelete={handleDelete}
              />
            </div>
          </div>
        </div>
      </div>
    );
  });
}
