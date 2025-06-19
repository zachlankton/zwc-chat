import { useCallback } from "react";
import { AsyncAlert } from "~/components/async-modals";
import type { HandleRetry, Message } from "~/lib/chat/types";
import { post } from "~/lib/fetchWrapper";
import { executeToolCalls, formatToolsForAPI } from "~/lib/tool-executor";
import type { StreamResponse } from "~/lib/webSocketClient";
import type { ChatSettings } from "~/stores/chat-settings";
import type { ToolCall } from "~/types/tools";

interface UseToolExecutionProps {
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  chatSettings: ChatSettings;
  assistantMessage: React.RefObject<Message | null>;
  messagesRef: React.RefObject<Message[]>;
  handleRetry: HandleRetry;
  selectedModel: string;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  updateStreamingMessageId: (id: string | null) => void;
  chatId: string;
  pendingToolCallsRef: React.RefObject<ToolCall[] | null>;
  streamingMessageIdRef: React.RefObject<string | null>;
}

export function useToolExecution({
  setIsLoading,
  chatSettings,
  assistantMessage,
  messagesRef,
  handleRetry,
  selectedModel,
  setMessages,
  updateStreamingMessageId,
  chatId,
  pendingToolCallsRef,
  streamingMessageIdRef,
}: UseToolExecutionProps) {
  // Handle tool execution
  return useCallback(
    async (toolCalls: ToolCall[]) => {
      if (!chatSettings.toolsEnabled || !toolCalls || toolCalls.length === 0) {
        return;
      }

      setIsLoading(true);

      try {
        const hasWebSearch = toolCalls.some(
          (t) => t.function.name === "web_search",
        );

        if (hasWebSearch) {
          if (assistantMessage.current === null) {
            AsyncAlert({
              title: "Error",
              message:
                "There was an issue trying to perform a web search tool call: assistantMessage is null",
            });
            return;
          }

          const messageIndex = messagesRef.current.findIndex(
            (msg) => msg.id === assistantMessage?.current?.id,
          );

          if (messageIndex === -1) {
            console.error({
              hasWebSearch,
              toolCalls,
              messagesRef,
            });
            AsyncAlert({
              title: "Error",
              message:
                "There was an issue trying to perform a web search tool call: Could not find message index",
            });
            return;
          }

          return handleRetry(messageIndex, {
            newModel: assistantMessage.current.model,
            includeWebSearch: true,
            overrideIsLoading: true,
          });
        }
        // Execute tools
        const toolResults = await executeToolCalls(
          toolCalls,
          chatSettings.tools,
        );

        // Create tool result messages
        const toolMessages: Message[] = toolResults.map((result) => ({
          id: crypto.randomUUID(),
          role: "tool",
          tool_call_id: result.tool_call_id,
          name: result.name,
          content: result.content,
          timestamp: Date.now(),
        }));

        const currentMsgIdx = messagesRef.current.findIndex(
          (x) => x.id === assistantMessage?.current?.id,
        );

        const messagesUpToRetry = messagesRef.current.slice(
          0,
          currentMsgIdx + 1,
        );
        const msgTime = assistantMessage?.current?.timestamp ?? Date.now();

        toolMessages.forEach((t) => (t.timestamp = msgTime + 10));

        const remainingMessages = messagesRef.current.slice(currentMsgIdx + 1);

        if (assistantMessage.current?.tool_calls?.length === 0) {
          assistantMessage.current.tool_calls = undefined;
        }

        // Send a new request with the tool results
        const requestBody: any = {
          messages: [...messagesUpToRetry, ...toolMessages],
          model: selectedModel,
          overrideAssistantTimestamp: msgTime + 20,
        };

        if (chatSettings.toolsEnabled && chatSettings.tools.length > 0) {
          requestBody.tools = formatToolsForAPI(chatSettings.tools);
        }

        // Create a new assistant message for the final response
        assistantMessage.current = {
          id: crypto.randomUUID(),
          content: "",
          role: "assistant",
          model: selectedModel,
          timestamp: msgTime + 20,
          timeToFinish: 0,
        };

        setMessages([
          ...messagesUpToRetry,
          ...toolMessages,
          assistantMessage.current,
          ...remainingMessages,
        ]);

        updateStreamingMessageId(assistantMessage.current.id);

        post<StreamResponse | Response>(`/chat/${chatId}`, requestBody, {
          resolveImmediately: true,
        });
      } catch (error) {
        console.error("Error executing tools:", error);

        // Show error to user
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unknown error occurred while executing tools";
        AsyncAlert({
          title: "Tool Execution Error",
          message: errorMessage,
        });

        // Reset assistant message state and pending tool calls
        assistantMessage.current = null;
        updateStreamingMessageId(null);
        pendingToolCallsRef.current = null;
      } finally {
        // Always reset loading state, but only if no streaming is happening
        if (!streamingMessageIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [
      chatId,
      selectedModel,
      chatSettings.toolsEnabled,
      chatSettings.tools,
      setIsLoading,
      handleRetry,
    ],
  );
}
