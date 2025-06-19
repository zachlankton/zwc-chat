import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Message, ModelsResponse } from "~/lib/chat/types";
import { get, post } from "~/lib/fetchWrapper";
import { useApiKeyInfo } from "~/stores/session";
import type { ToolCall } from "~/types/tools";
import { useChatSettings } from "~/stores/chat-settings";
import { AsyncAlert } from "~/components/async-modals";

interface UseChatMessagesProps {
  initialMessages: Message[];
  chatId: string;
}

export function useChatMessages({
  initialMessages,
  chatId,
}: UseChatMessagesProps) {
  const apiKeyInfo = useApiKeyInfo();
  const navigate = useNavigate();

  // Update messages when initialMessages changes (e.g., when switching chats)
  useEffect(() => {
    assistantMessage.current = null;
    setMessages(initialMessages);
    setIsLoading(false);
    updateStreamingMessageId(null);

    // Also update the selected model based on the new chat's messages
    if (initialMessages.length > 0) {
      const lastAssistantMessage = [...initialMessages]
        .reverse()
        .find((msg) => msg.role === "assistant" && msg.model);
      if (lastAssistantMessage?.model) {
        setSelectedModel(lastAssistantMessage.model);
      }
    }
  }, [initialMessages]);

  const chatSettings = useChatSettings();

  // Initialize selectedModel based on context
  const getInitialModel = () => {
    // For existing chats, use the model from the last assistant message
    if (initialMessages.length > 0) {
      const lastAssistantMessage = [...initialMessages]
        .reverse()
        .find((msg) => msg.role === "assistant" && msg.model);
      if (lastAssistantMessage?.model) {
        return lastAssistantMessage.model;
      }
    }

    // For new chats, use localStorage
    const savedModel = localStorage.getItem("selectedModel");
    if (savedModel) {
      return savedModel;
    }

    // Default fallback
    return "openai/gpt-4o-mini";
  };

  const {
    data: modelsData,
    isLoading: modelsLoading,
    error: modelsError,
  } = useQuery<ModelsResponse>({
    queryKey: ["models"],
    queryFn: () => get("/api/models"),
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const [showToolManager, setShowToolManager] = useState(false);
  const pendingToolCallsRef = useRef<ToolCall[] | null>(null);

  const [selectedModel, setSelectedModel] = useState<string>(getInitialModel());

  const model = useMemo(() => {
    return modelsData
      ? modelsData.all.find((m) => m.id === selectedModel)
      : null;
  }, [selectedModel, modelsData]);

  const isNewChat = useRef<boolean>(false);
  const chatInputRef = useRef<{ focus: () => void } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  );
  const streamingMessageIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, _setMessages] = useState<Message[]>(initialMessages);
  const assistantMessage = useRef<null | Message>(null);
  const messagesRef = useRef<Message[]>(messages);

  const setMessages: React.Dispatch<React.SetStateAction<Message[]>> =
    useCallback((args) => {
      if (typeof args === "function") {
        // args is a function that takes the previous state and returns new state
        messagesRef.current = args(messagesRef.current);
      } else {
        // args is the new state value directly
        messagesRef.current = args;
      }
      _setMessages(messagesRef.current);
    }, []);

  // Helper to update both streamingMessageId state and ref
  const updateStreamingMessageId = useCallback((id: string | null) => {
    streamingMessageIdRef.current = id;
    setStreamingMessageId(id);
  }, []);

  const scrollNewMessage = useCallback(() => {
    // Get all elements with the class and take the last one
    const elements = document.querySelectorAll(".user-message");
    const lastElement = elements[elements.length - 1];
    if (!lastElement) return;
    lastElement.parentElement?.parentElement?.parentElement?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  // Save selected model to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("selectedModel", selectedModel);
  }, [selectedModel]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "auto",
      block: "end",
    });
  };

  const scrollActiveAssistantMessage = () => {
    // Get all elements with the class and take the last one
    if (assistantMessage.current === null) return;
    const element = document.getElementById(assistantMessage.current.id);
    if (!element) return;
    element.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  };

  useEffect(() => {
    setTimeout(() => {
      if (assistantMessage.current === null) {
        scrollToBottom();
      } else {
        scrollActiveAssistantMessage();
      }
    }, 100);
  }, [chatId]);

  const onStop = useCallback(async () => {
    try {
      const results = await post<{ ok: boolean }>(
        `/api/chat/${chatId}?abort`,
        {},
      );
      if (!results.ok) {
        AsyncAlert({
          title: "Unable to stop at this time",
          message: "Sorry, was not able to stop the stream",
        });
        return console.error(results);
      }
      setIsLoading(false);
      updateStreamingMessageId(null);
      assistantMessage.current = null;
    } catch (error) {
      console.error("Failed to abort generation:", error);
    }
  }, [setIsLoading, updateStreamingMessageId, chatId]);

  return {
    showToolManager,
    setShowToolManager,
    pendingToolCallsRef,
    apiKeyInfo,
    navigate,
    modelsData,
    modelsLoading,
    modelsError,
    model,
    isNewChat,
    isLoading,
    setIsLoading,
    messagesEndRef,
    assistantMessage,
    messages,
    messagesRef,
    setMessages,
    streamingMessageId,
    streamingMessageIdRef,
    updateStreamingMessageId,
    selectedModel,
    setSelectedModel,
    chatInputRef,
    chatSettings,
    scrollNewMessage,
    onStop,
  };
}
