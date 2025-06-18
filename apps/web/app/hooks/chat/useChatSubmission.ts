import { useCallback } from "react";
import type { ChatListResponse, Message, Model } from "~/lib/chat/types";
import { post } from "~/lib/fetchWrapper";
import { formatToolsForAPI } from "~/lib/tool-executor";
import type { StreamResponse } from "~/lib/webSocketClient";
import { queryClient } from "~/providers/queryClient";
import type { ChatSettings } from "~/stores/chat-settings";

interface UseChatSubmissionProps {
  chatId: string;
  assistantMessage: React.RefObject<Message | null>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  updateStreamingMessageId: (id: string | null) => void;
  messagesRef: React.RefObject<Message[]>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  selectedModel: string;
  chatSettings: ChatSettings;
  isNewChat: React.RefObject<boolean>;
  scrollNewMessage: () => void;
  initialMessages: Message[];
  model?: Model | null;
}

export function useChatSubmission({
  chatId,
  assistantMessage,
  isLoading,
  setIsLoading,
  updateStreamingMessageId,
  messagesRef,
  setMessages,
  selectedModel,
  chatSettings,
  isNewChat,
  scrollNewMessage,
  initialMessages,
  model,
}: UseChatSubmissionProps) {
  return useCallback(
    async (
      input: string,
      attachments: File[],
      includeWebSearch: boolean = false,
    ) => {
      if (isLoading) return;
      if (!input.trim() || isLoading) return;
      const stashMessageLength = messagesRef.current.length;
      isNewChat.current =
        initialMessages.length === 0 && stashMessageLength === 0;

      // Convert files to base64
      const fileToBase64 = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
        });
      };

      // Create content array if we have attachments
      let content: string | any[] = input;
      if (attachments.length > 0) {
        content = [{ type: "text", text: input }];

        // Add attachments to content array
        for (const file of attachments) {
          const base64Data = await fileToBase64(file);

          if (file.type.startsWith("image/")) {
            content.push({
              type: "image_url",
              image_url: { url: base64Data },
            });
          } else if (file.type === "application/pdf") {
            content.push({
              type: "file",
              file: {
                filename: file.name,
                file_data: base64Data,
              },
            });
          }
        }
      }

      // If this is a new chat, immediately add a placeholder to the chat list
      if (isNewChat.current) {
        queryClient.setQueryData(["chats"], (oldData: any) => {
          if (!oldData) return oldData;

          const placeholderChat = {
            id: chatId,
            title: "Generating...",
            generating: true,
            lastMessage:
              typeof content === "string"
                ? content.slice(0, 50)
                : "New conversation",
            updatedAt: new Date().toISOString(),
            messageCount: 1,
          };

          return {
            ...oldData,
            chats: [placeholderChat, ...oldData.chats],
            total: oldData.total + 1,
          };
        });
      } else {
        queryClient.setQueryData(["chats"], (oldData: ChatListResponse) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            chats: oldData.chats.map((c) =>
              c.id === chatId ? { ...c, generating: true } : { ...c },
            ),
          };
        });
      }

      const userMessage: Message = {
        id: crypto.randomUUID(),
        content: content,
        role: "user",
        timestamp: Date.now(),
      };

      // For new chats, add system prompt as the first message if it exists
      if (isNewChat.current && chatSettings.systemPrompt) {
        const systemMessage: Message = {
          id: crypto.randomUUID(),
          content: chatSettings.systemPrompt,
          role: "system",
          timestamp: Date.now(),
        };
        setMessages([systemMessage, userMessage]);
      } else {
        setMessages((prev) => [...prev, userMessage]);
      }
      setIsLoading(true);

      // Include tools if enabled
      const requestBody: any = {
        messages: [...messagesRef.current],
        model: selectedModel,
      };

      if (
        includeWebSearch === false &&
        model?.supported_parameters?.includes("tools") &&
        chatSettings.toolsEnabled &&
        chatSettings.tools.length > 0
      ) {
        requestBody.tools = formatToolsForAPI(chatSettings.tools);
      }

      if (includeWebSearch) {
        requestBody.websearch = true;
      }

      // Create empty assistant message to start streaming
      assistantMessage.current = {
        id: (Date.now() + 1).toString(),
        content: "",
        role: "assistant",
        model: selectedModel, // Include the model being used
        timestamp: Date.now(),
        timeToFinish: 0,
      };

      setMessages((prev) => [...prev, assistantMessage.current as Message]);
      updateStreamingMessageId(assistantMessage.current.id);
      setTimeout(scrollNewMessage, 100);

      post<StreamResponse | Response>(`/chat/${chatId}`, requestBody, {
        resolveImmediately: true,
      });
    },
    [
      chatId,
      isLoading,
      setIsLoading,
      updateStreamingMessageId,
      setMessages,
      selectedModel,
      chatSettings.toolsEnabled,
      chatSettings.tools,
      chatSettings.systemPrompt,
      isNewChat,
      scrollNewMessage,
      initialMessages,
      model,
    ],
  );
}
