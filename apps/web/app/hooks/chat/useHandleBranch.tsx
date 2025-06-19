import { useCallback } from "react";
import { AsyncAlert } from "~/components/async-modals";
import { post } from "~/lib/fetchWrapper";

interface UseHandleBranchProps {
  chatId: string;
}

export function useHandleBranch({ chatId }: UseHandleBranchProps) {
  return useCallback(
    async (messageId: string, messageIndex: number) => {
      try {
        const response = await post<{
          success: boolean;
          newChatId: string;
          branchedFrom: {
            chatId: string;
            messageId: string;
          };
        }>(`/chat/${chatId}/branch`, {
          messageId,
          messageIndex,
        });

        if (response.success && response.newChatId) {
          // Navigate to the new branched chat
          window.location.href = `/chat/${response.newChatId}`;
        }
      } catch (error) {
        console.error("Failed to branch chat:", error);
        AsyncAlert({
          title: "Error",
          message: "Failed to branch conversation. Please try again.",
        });
      }
    },
    [chatId],
  );
}
