import { Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";

export function MessageDeleteButton({
  messageId,
  onDelete,
}: {
  messageId: string;
  onDelete: (messageId: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onDelete(messageId)}
      className="h-6 has-[>svg]:px-2 has-[>svg]:py-4 text-xs hover:bg-destructive/20 hover:text-destructive"
      title="Delete message"
    >
      <Trash2 className="h-3" />
    </Button>
  );
}
