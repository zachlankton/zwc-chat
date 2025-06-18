import { useCallback } from "react";
import { AsyncModal } from "~/components/async-modals";
import { Button } from "~/components/ui/button";
import {
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import type { Message } from "~/lib/chat/types";
import type { ChatSettings } from "~/stores/chat-settings";

interface UseHandleSystemPromptEditProps {
  messagesRef: React.RefObject<Message[]>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  chatSettings: ChatSettings;
  handleEdit: (
    messageId: string,
    newContent: string,
    regenerateNext: boolean,
  ) => Promise<void>;
}

export function useHandleSystemPromptEdit({
  messagesRef,
  setMessages,
  chatSettings,
  handleEdit,
}: UseHandleSystemPromptEditProps) {
  return useCallback(async () => {
    const systemMessage = messagesRef.current.find((m) => m.role === "system");

    if (systemMessage) {
      // Create a temporary visible message for editing
      const result = await AsyncModal(
        <>
          <DialogTitle className="mb-4 text-xl font-bold">
            Edit System Prompt
          </DialogTitle>
          <DialogDescription className="mb-4">
            Customize the system prompt for this chat:
          </DialogDescription>
          <div className="mb-4">
            <Textarea
              name="content"
              defaultValue={systemMessage.content as string}
              className="min-h-[200px] w-full resize-y"
              placeholder="Enter system prompt..."
              autoFocus
            />
          </div>
          <div className="grid grid-flow-row-dense grid-cols-2 gap-3">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="default">
              Save
            </Button>
          </div>
        </>,
        {
          style: { maxWidth: "80vw" },
          initialData: {
            content: systemMessage.content as string,
          },
        },
      );

      if (result.ok && result.data.content?.trim()) {
        handleEdit(systemMessage.id, result.data.content.trim(), false);
      }
    } else {
      // Add new system message
      const result = await AsyncModal(
        <>
          <DialogTitle className="mb-4 text-xl font-bold">
            Add System Prompt
          </DialogTitle>
          <DialogDescription className="mb-4">
            Add a system prompt to guide the AI's behavior in this chat:
          </DialogDescription>
          <div className="mb-4">
            <Textarea
              name="content"
              defaultValue={chatSettings.systemPrompt}
              className="min-h-[200px] w-full resize-y"
              placeholder="Enter system prompt..."
              autoFocus
            />
          </div>
          <div className="grid grid-flow-row-dense grid-cols-2 gap-3">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="default">
              Save
            </Button>
          </div>
        </>,
        {
          style: { maxWidth: "80vw" },
          initialData: {
            content: chatSettings.systemPrompt,
          },
        },
      );

      if (result.ok && result.data.content?.trim()) {
        const newSystemMessage: Message = {
          id: crypto.randomUUID(),
          content: result.data.content.trim(),
          role: "system",
          timestamp: Date.now(),
        };
        setMessages((prev) => [newSystemMessage, ...prev]);
      }
    }
  }, [setMessages, chatSettings.systemPrompt, handleEdit]);
}
