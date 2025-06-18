import { useCallback, useEffect, useRef } from "react";
import { AsyncAlert } from "~/components/async-modals";
import { DialogTitle } from "~/components/ui/dialog";
import { handleChunk } from "~/lib/chat/stream-processor";
import type { Message } from "~/lib/chat/types";
import { get, post, wsClient } from "~/lib/fetchWrapper";
import { parseSSEEvents } from "~/lib/llm-tools";
import { getHeaderAndText } from "~/lib/webSocketClient";
import { queryClient } from "~/providers/queryClient";
import type { ChatSettings } from "~/stores/chat-settings";
import type { ToolCall } from "~/types/tools";

interface UseWebSocketStreamProps {
  chatId: string;
  assistantMessage: React.RefObject<Message | null>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  updateStreamingMessageId: (id: string | null) => void;
  messagesRef: React.RefObject<Message[]>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  selectedModel: string;
  pendingToolCallsRef: React.RefObject<ToolCall[] | null>;
  streamingMessageIdRef: React.RefObject<string | null>;
  chatSettings: ChatSettings;
  flushTtsBuffer: () => void;
  executeToolsAndContinue: (toolCalls: ToolCall[]) => Promise<void>;
  isNewChat: React.RefObject<boolean>;
  chatInputRef: React.RefObject<{
    focus: () => void;
  } | null>;
  handleChatSubMessage: (data: any) => void;
  onNewContent: ((content: string) => void) | undefined;
}

export function useWebSocketStream({
  chatId,
  assistantMessage,
  setIsLoading,
  updateStreamingMessageId,
  messagesRef,
  setMessages,
  selectedModel,
  pendingToolCallsRef,
  chatSettings,
  flushTtsBuffer,
  executeToolsAndContinue,
  isNewChat,
  chatInputRef,
  handleChatSubMessage,
  onNewContent,
}: UseWebSocketStreamProps) {
  const buffer = useRef("");
  const resettingOffset = useRef<boolean>(false);

  const wsStream = useCallback(
    (data: any) => {
      const messageHasThisChatId =
        data.type &&
        data.headers &&
        data.headers["x-zwc-chat-id"] &&
        data.headers["x-zwc-chat-id"] === chatId;

      if (data instanceof ArrayBuffer) {
        const { header, text } = getHeaderAndText(data);
        if (!header.chatId) return;
        if (header.chatId !== chatId) return;
        const messageId = header.newMessageId;
        const thisMessageIsFromTheOriginSocket =
          header.thisMessageIsFromTheOriginSocket;

        if (assistantMessage.current === null) {
          if (header.offset > 0) {
            if (resettingOffset.current) return;
            resettingOffset.current = true;
            get(`/api/chat/${chatId}`);
            return;
          }

          resettingOffset.current = false;
          setIsLoading(true);
          updateStreamingMessageId(header.newMessageId);
          const newMessageId = header.newMessageId;
          const existingMessage = messagesRef.current.find(
            (m) => m.id === newMessageId,
          );
          if (existingMessage) {
            existingMessage.stoppedByUser = false;
            existingMessage.content = "";
            existingMessage.reasoning = undefined;
            existingMessage.tool_calls = undefined;
            assistantMessage.current = existingMessage;
          } else {
            assistantMessage.current = {
              id: newMessageId,
              content: "",
              role: "assistant",
              model: selectedModel,
              timestamp: Date.now(),
              timeToFinish: 0,
            };
            setMessages((prev) => [
              ...prev,
              assistantMessage.current as Message,
            ]);
          }
        }

        assistantMessage.current.id = messageId;
        assistantMessage.current.timestamp = header.newMessageTimestamp;

        for (const chunk of parseSSEEvents(text, buffer)) {
          if (chunk.type === "data" && assistantMessage.current) {
            if (
              chunk.parsed.error &&
              chunk.parsed.error.metadata &&
              chunk.parsed.error.metadata.raw
            ) {
              const err = JSON.parse(chunk.parsed.error.metadata.raw);
              AsyncAlert({ title: "Error", message: err.error.message });
              setIsLoading(false);
              updateStreamingMessageId(null);
              return;
            }

            handleChunk({
              value: chunk.parsed,
              setMessages,
              assistantMessage: assistantMessage.current,
              onToolCalls: (toolCalls) => {
                // Store tool calls to execute after streaming completes
                pendingToolCallsRef.current = toolCalls;
              },
              onNewContent,
            });
          } else if (chunk.type === "done") {
            setIsLoading(false);
            updateStreamingMessageId(null);

            // Check if we have pending tool calls to execute
            if (pendingToolCallsRef.current && assistantMessage.current) {
              const toolCalls = pendingToolCallsRef.current;
              pendingToolCallsRef.current = null;

              // Execute tools and continue conversation
              if (thisMessageIsFromTheOriginSocket) {
                executeToolsAndContinue(toolCalls);
              }

              return; // Don't do the normal completion stuff
            }

            assistantMessage.current = null;

            // Flush any remaining TTS buffer
            if (chatSettings.ttsEnabled) {
              flushTtsBuffer();
            }

            // Refocus the textarea after streaming completes
            setTimeout(() => {
              chatInputRef.current?.focus();
            }, 100);

            // Generate title for new chats after first response
            if (isNewChat.current) {
              // Fire and forget - don't wait for title generation
              post(`/chat/${chatId}/generate-title`, {})
                .then(() => {
                  // Invalidate chats query to refresh the title
                  setTimeout(() => {
                    queryClient.invalidateQueries({ queryKey: ["chats"] });
                    queryClient.invalidateQueries({ queryKey: ["APIKEYINFO"] });
                  }, 1000);
                })
                .catch((err) =>
                  console.error("Failed to generate title:", err),
                );
            } else {
              setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ["APIKEYINFO"] });
                queryClient.invalidateQueries({ queryKey: ["chats"] });
              }, 1000);
            }
          } else {
            console.log({ text, chunk });
          }
        }
      } else {
        if (!messageHasThisChatId) return;

        if (data.type === "chat-sub-message") {
          return handleChatSubMessage(data);
        }

        if (
          data.status === 403 &&
          data.body &&
          data.body.error &&
          data.body.error.message.toLowerCase().includes("key limit exceeded")
        ) {
          AsyncAlert({
            title: "Error",
            message: "You have reached your limit",
          });
        } else {
          console.error(data);
          const message =
            data?.body?.error?.message ?? "An unknown error occurred";
          AsyncAlert({
            message: (
              <>
                <DialogTitle className="mb-4 text-xl font-bold">
                  Error
                </DialogTitle>
                <p className="mb-2">{message}</p>
              </>
            ),
          });
        }

        // Restore the original message
        if (assistantMessage.current !== null) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.current?.id
                ? (assistantMessage.current as Message)
                : msg,
            ),
          );
        } else {
          setMessages((prev) => [...prev.slice(0, -1)]);
        }

        setIsLoading(false);
        updateStreamingMessageId(null);
        isNewChat.current = false;
      }
    },
    [
      chatId,
      setIsLoading,
      updateStreamingMessageId,
      setMessages,
      selectedModel,
      chatSettings.ttsEnabled,
      flushTtsBuffer,
      executeToolsAndContinue,
      handleChatSubMessage,
    ],
  );

  useEffect(() => {
    wsClient.on("message", wsStream);
    return () => {
      wsClient.off("message", wsStream);
    };
  }, [wsStream]);
}
