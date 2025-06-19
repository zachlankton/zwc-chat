import { GitBranchPlus } from "lucide-react";
import { Button } from "~/components/ui/button";

export function MessageBranchButton({
  messageId,
  messageIndex,
  onBranch,
}: {
  messageId: string;
  messageIndex: number;
  onBranch: (messageId: string, messageIndex: number) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onBranch(messageId, messageIndex)}
      className="h-6 has-[>svg]:px-2 has-[>svg]:py-4 text-xs hover:bg-muted/50"
      title="Branch conversation from here"
    >
      <GitBranchPlus className="h-3" />
    </Button>
  );
}
