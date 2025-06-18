import { useCallback } from "react";
import type { NavigateFunction } from "react-router";
import { AsyncAlert } from "~/components/async-modals";
import type { Message } from "~/lib/chat/types";

interface UseHandleChatSubMessagesProps {
  messagesRef: React.RefObject<Message[]>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  selectedModel: string;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  assistantMessage: React.RefObject<Message | null>;
  updateStreamingMessageId: (id: string | null) => void;
  scrollNewMessage: () => void;
  navigate: NavigateFunction;
}

export function useHandleChatSubMessage({
  messagesRef,
  setMessages,
  selectedModel,
  setIsLoading,
  assistantMessage,
  updateStreamingMessageId,
  scrollNewMessage,
  navigate,
}: UseHandleChatSubMessagesProps) {
  return useCallback(
    (data: any) => {
      function msgUpdate(data: any = {}) {
        //find message
        const msg = messagesRef.current.find((m) => m.id === data.messageId);
        if (!msg) return;
        msg.content = data.content;
        setMessages((prev) => [...prev]);
      }

      function msgDelete(data: any = {}) {
        const msgIndex = messagesRef.current.findIndex(
          (m) => m.id === data.messageId,
        );

        if (msgIndex === -1) return;
        messagesRef.current.splice(msgIndex, 1);
        setMessages((prev) => [...prev]);
      }

      function msgPost(data: any = {}) {
        const lastMessageId = data.lastMessage.id;
        const userMsg = messagesRef.current.find((m) => m.id === lastMessageId);
        if (!userMsg) {
          const newUserMessage = {
            id: lastMessageId,
            content: data.lastMessage.content,
            role: data.lastMessage.role,
            timestamp: data.lastMessage.timestamp,
          };
          setMessages((prev) => [...prev, newUserMessage]);
          setTimeout(scrollNewMessage, 100);
        }

        if (assistantMessage.current === null) {
          const newMessageId = data.messageIdToReplace;
          const existingMessage = messagesRef.current.find(
            (m) => m.id === newMessageId,
          );
          if (existingMessage) {
            existingMessage.stoppedByUser = false;
            existingMessage.content = "";
            existingMessage.reasoning = undefined;
            existingMessage.tool_calls = undefined;
            assistantMessage.current = existingMessage;
            setMessages((prev) => [...prev]);
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
          setIsLoading(true);
          updateStreamingMessageId(assistantMessage.current.id);
        }
      }

      async function chatDelete() {
        await AsyncAlert({
          title: "Deleted",
          message: "This chat has been deleted",
        });
        const newChatId = crypto.randomUUID();
        navigate(`/chat/${newChatId}`, { replace: true });
      }

      const handlers = {
        "msg-update": msgUpdate,
        "msg-delete": msgDelete,
        "msg-post": msgPost,
        "chat-delete": chatDelete,
      };

      const msgData = data.data;
      if (!msgData) return;

      const subType: keyof typeof handlers | undefined = msgData.subType;
      if (!subType) return;
      if (!handlers[subType]) return;

      handlers[subType](msgData);
    },
    [
      selectedModel,
      navigate,
      updateStreamingMessageId,
      scrollNewMessage,
      setMessages,
      setIsLoading,
    ],
  );
}
