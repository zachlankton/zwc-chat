import { useCallback } from "react";
import { AsyncAlert, AsyncConfirm } from "~/components/async-modals";
import type { Message } from "~/lib/chat/types";
import { del } from "~/lib/fetchWrapper";
import { queryClient } from "~/providers/queryClient";

interface UseHandleDeleteProps {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  chatId: string;
}

export function useHandleDelete({ setMessages, chatId }: UseHandleDeleteProps) {
  return useCallback(
    async (messageId: string, force?: boolean) => {
      let ok;
      if (!force) {
        const { ok: _ok } = await AsyncConfirm({
          destructive: true,
          title: "Delete Message",
          message:
            "Are you sure you want to delete this message? This action cannot be undone.",
        });

        if (!_ok) return;
        ok = _ok;
      }

      try {
        // Call API to delete message
        await del(`/chat/${chatId}/message/${messageId}`);

        // Remove message from local state
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));

        // Invalidate chat list to update last message if needed
        queryClient.invalidateQueries({ queryKey: ["chats"] });
      } catch (error) {
        console.error("Failed to delete message:", error);
        AsyncAlert({
          title: "Error",
          message: "Failed to delete message. Please try again.",
        });
      }
    },
    [setMessages, chatId],
  );
}
