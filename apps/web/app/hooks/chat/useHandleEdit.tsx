import { useCallback } from "react";
import { AsyncAlert } from "~/components/async-modals";
import type { HandleRetry, Message } from "~/lib/chat/types";
import { put } from "~/lib/fetchWrapper";

interface UseHandleEditProps {
  chatId: string;
  messagesRef: React.RefObject<Message[]>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  handleDelete: (messageId: string, force?: boolean) => Promise<void>;
  handleSubmit: (
    input: string,
    attachments: File[],
    includeWebSearch?: boolean,
  ) => Promise<void>;
  handleRetry: HandleRetry;
}

export function useHandleEdit({
  chatId,
  messagesRef,
  setMessages,
  handleDelete,
  handleSubmit,
  handleRetry,
}: UseHandleEditProps) {
  return useCallback(
    async (messageId: string, newContent: string, regenerateNext: boolean) => {
      // Find the message to edit
      const messageIndex = messagesRef.current.findIndex(
        (msg) => msg.id === messageId,
      );
      if (messageIndex === -1) return;

      const originalMessage = messagesRef.current[messageIndex];
      const originalContent = originalMessage.content;
      const isSystem = originalMessage.role === "system";
      const isFirst = messagesRef.current.length === 1;

      try {
        // Optimistically update the message
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  content:
                    typeof msg.content === "string"
                      ? newContent
                      : [{ type: "text", text: newContent }],
                }
              : msg,
          ),
        );

        const isLastMessage = messageIndex === messagesRef.current.length - 1;
        const isUserMessage = originalMessage.role === "user";
        if (isLastMessage && isUserMessage) {
          await handleDelete(messageId, true);
          await handleSubmit(newContent, []);
          return;
        } else {
          // Call API to update message
          await put(`/chat/${chatId}/message/${messageId}`, {
            content: newContent,
          });
        }

        // If this was a user message and we should regenerate the next assistant message
        if (regenerateNext && originalMessage.role === "user") {
          const nextMessageIndex = messageIndex + 1;
          if (
            nextMessageIndex < messagesRef.current.length &&
            messagesRef.current[nextMessageIndex].role === "assistant"
          ) {
            // Use handleRetry to regenerate the assistant response
            setTimeout(() => {
              handleRetry(nextMessageIndex, {
                newContentForPreviousMessage: newContent,
              });
            }, 100);
          }
        }
      } catch (error) {
        // editing the system prompt in a new chat would cause this, and its ok because it will get saved with the first message
        if (isSystem && isFirst) return;
        console.error("Failed to edit message:", error);

        // Revert the optimistic update on error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  content: originalContent,
                }
              : msg,
          ),
        );

        AsyncAlert({
          title: "Error",
          message: "Failed to edit message. Please try again.",
        });
      }
    },
    [chatId, setMessages, handleDelete, handleSubmit, handleRetry],
  );
}
