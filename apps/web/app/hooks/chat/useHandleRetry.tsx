import { useCallback } from "react";
import { AsyncAlert } from "~/components/async-modals";
import type {
  ChatListResponse,
  Message,
  ModelsResponse,
} from "~/lib/chat/types";
import { post } from "~/lib/fetchWrapper";
import { formatToolsForAPI } from "~/lib/tool-executor";
import type { StreamResponse } from "~/lib/webSocketClient";
import { queryClient } from "~/providers/queryClient";
import type { ChatSettings } from "~/stores/chat-settings";

interface UseHandleRetryProps {
  messagesRef: React.RefObject<Message[]>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  selectedModel: string;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  assistantMessage: React.RefObject<Message | null>;
  updateStreamingMessageId: (id: string | null) => void;
  chatSettings: ChatSettings;
  chatId: string;
  handleDelete: (messageId: string, force?: boolean) => Promise<void>;
  modelsData?: ModelsResponse;
}

export function useHandleRetry({
  messagesRef,
  setMessages,
  selectedModel,
  isLoading,
  setIsLoading,
  assistantMessage,
  updateStreamingMessageId,
  chatSettings,
  chatId,
  handleDelete,
  modelsData,
}: UseHandleRetryProps) {
  return useCallback(
    async (
      messageIndex: number,
      opts?: {
        newModel?: string;
        newContentForPreviousMessage?: string;
        includeWebSearch?: boolean;
        overrideIsLoading?: boolean;
      },
    ) => {
      const overrideIsLoading = opts?.overrideIsLoading
        ? opts.overrideIsLoading
        : false;

      if (isLoading && overrideIsLoading === false) return;

      const includeWebSearch = opts?.includeWebSearch
        ? opts.includeWebSearch
        : false;

      // Get the message to retry and ensure it's an assistant message
      assistantMessage.current = messagesRef.current[messageIndex];

      if (assistantMessage.current.role !== "assistant") {
        console.error(
          "messageToRetry was not assistant",
          assistantMessage.current,
        );
        AsyncAlert({
          title: "Hmmmm...",
          message: `Normally the message we are going to retry is an assistant message, but we got role: ${assistantMessage.current.role}`,
        });
        return;
      }

      queryClient.setQueryData(["chats"], (oldData: ChatListResponse) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          chats: oldData.chats.map((c) =>
            c.id === chatId ? { ...c, generating: true } : { ...c },
          ),
        };
      });

      assistantMessage.current.tool_calls = undefined;
      assistantMessage.current.stoppedByUser = false;

      // Find all messages up to and including the user message before this assistant message
      const messagesUpToRetry = messagesRef.current.slice(0, messageIndex);
      const prevUserMsg = messagesUpToRetry.at(-1);
      let nextMsg = messagesRef.current[messageIndex + 1];

      // remove tools from the retry
      let lastToolIndex = messageIndex;
      if (nextMsg && nextMsg.role === "tool") {
        lastToolIndex++;
        handleDelete(assistantMessage.current.id, true);
        while (nextMsg.role === "tool") {
          handleDelete(nextMsg.id, true);
          lastToolIndex++;
          nextMsg = messagesRef.current[lastToolIndex];
        }
        assistantMessage.current = nextMsg;
      }

      const remainingMessages = messagesRef.current.slice(lastToolIndex);

      setMessages([...messagesUpToRetry, ...remainingMessages]);

      if (opts?.newContentForPreviousMessage && prevUserMsg)
        prevUserMsg.content = opts?.newContentForPreviousMessage;

      // Update the model if a new one was selected
      const _modelToUse =
        opts?.newModel || selectedModel || assistantMessage.current.model;

      const modelToUse = modelsData
        ? modelsData.all.find((m) => m.id === _modelToUse)
        : null;

      if (!modelToUse) {
        AsyncAlert({ title: "Error", message: "Could not find model" });
        return console.error({ _modelToUse, modelToUse, modelsData });
      }

      setIsLoading(true);

      // Mark this specific message as being regenerated
      updateStreamingMessageId(assistantMessage.current.id);
      assistantMessage.current.model = _modelToUse;

      // Clear the content of the message being retried
      setMessages((prev) =>
        prev.map((msg, idx) =>
          idx === messageIndex
            ? { ...msg, content: "", reasoning: undefined, model: _modelToUse }
            : msg,
        ),
      );

      const retryRequestBody: any = {
        messages: messagesUpToRetry,
        model: _modelToUse,
        messageIdToReplace: assistantMessage.current.id,
      };

      if (
        includeWebSearch === false &&
        modelToUse?.supported_parameters?.includes("tools") &&
        chatSettings.toolsEnabled &&
        chatSettings.tools.length > 0
      ) {
        retryRequestBody.tools = formatToolsForAPI(chatSettings.tools);
      }

      if (includeWebSearch) {
        retryRequestBody.websearch = true;
      }

      post<StreamResponse | Response>(`/chat/${chatId}`, retryRequestBody, {
        resolveImmediately: true,
      });
    },
    [
      chatId,
      setMessages,
      selectedModel,
      isLoading,
      setIsLoading,
      updateStreamingMessageId,
      chatSettings.toolsEnabled,
      chatSettings.tools,
      handleDelete,
      modelsData,
    ],
  );
}
