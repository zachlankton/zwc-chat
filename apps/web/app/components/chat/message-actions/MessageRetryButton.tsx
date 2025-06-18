import { RotateCcw, Sparkle, Sparkles } from "lucide-react";
import { AsyncModal } from "~/components/async-modals";
import { ModelSelectorModal } from "~/components/model-selector";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import type { ModelsResponse } from "~/lib/chat/types";

export function MessageRetryButton({
  messageIndex,
  messageModel,
  currentModel,
  onRetry,
  modelsData,
}: {
  messageIndex: number;
  messageModel: string;
  currentModel: string;
  onRetry: (messageIndex: number, opts?: { newModel?: string }) => void;
  modelsData?: ModelsResponse;
}) {
  const modelsAreSame = messageModel === currentModel;

  const openModelSelector = () => {
    if (!modelsData) return;

    AsyncModal(
      <ModelSelectorModal
        selectedModel={currentModel}
        onModelChange={(modelId) => {
          onRetry(messageIndex, { newModel: modelId });
        }}
        data={modelsData}
      />,
      {
        showCloseButton: false,
        extraClasses: "min-w-[80dvw] p-0",
      },
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 has-[>svg]:px-2 has-[>svg]:py-4 text-xs hover:bg-muted/50"
          >
            <RotateCcw className="h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => onRetry(messageIndex, { newModel: messageModel })}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry With {messageModel.split("/")[1] || messageModel}
          </DropdownMenuItem>
          {modelsAreSame ? null : (
            <DropdownMenuItem
              onClick={() => onRetry(messageIndex, { newModel: currentModel })}
              disabled={modelsAreSame}
            >
              <>
                <Sparkle className="h-4 w-4 mr-2" />
                Retry with {currentModel.split("/")[1] || currentModel}
              </>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openModelSelector}>
            <Sparkles className="h-4 w-4 mr-2" />
            Select new model to retry with...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
