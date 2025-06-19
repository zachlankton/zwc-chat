import { Checkbox } from "@radix-ui/react-checkbox";
import { DialogClose } from "@radix-ui/react-dialog";
import { Label } from "@radix-ui/react-label";
import { Pencil } from "lucide-react";
import { AsyncModal } from "~/components/async-modals";
import { Button } from "~/components/ui/button";
import { DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";

export function MessageEditButton({
  messageId,
  content,
  onEdit,
  isUserMessage,
  hasNextAssistantMessage,
}: {
  messageId: string;
  content: string | any[];
  onEdit: (
    messageId: string,
    newContent: string,
    regenerateNext: boolean,
  ) => void;
  isUserMessage: boolean;
  hasNextAssistantMessage: boolean;
}) {
  const handleEdit = async () => {
    // Extract text content from message
    let textContent = "";
    if (typeof content === "string") {
      textContent = content;
    } else if (Array.isArray(content)) {
      // Extract text from content array
      const textPart = content.find((item: any) => item.type === "text") as any;
      textContent = textPart?.text || "";
    }

    const result = await AsyncModal(
      <>
        <DialogTitle className="mb-4 text-xl font-bold">
          Edit Message
        </DialogTitle>
        <DialogDescription className="mb-4">
          Edit the message content below:
        </DialogDescription>
        <div className="mb-4">
          <Textarea
            name="content"
            defaultValue={textContent}
            className="min-h-[50vh] w-full resize-y"
            placeholder="Enter your message..."
            autoFocus
          />
        </div>
        {isUserMessage && hasNextAssistantMessage && (
          <div className="mb-6 flex items-center space-x-2">
            <Checkbox id="regenerate" name="regenerate" defaultChecked={true} />
            <Label
              htmlFor="regenerate"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Regenerate assistant response after editing
            </Label>
          </div>
        )}
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
          content: textContent,
          regenerate: true,
        },
      },
    );

    if (result.ok && result.data.content?.trim()) {
      const regenerateNext =
        isUserMessage && hasNextAssistantMessage && result.data.regenerate;
      onEdit(messageId, result.data.content.trim(), regenerateNext);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleEdit}
      className="h-6 has-[>svg]:px-2 has-[>svg]:py-4 text-xs hover:bg-muted/50"
      title="Edit message"
    >
      <Pencil className="h-3" />
    </Button>
  );
}
