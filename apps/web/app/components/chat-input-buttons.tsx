import {
  CornerDownLeft,
  Volume2,
  VolumeX,
  Check,
  FileText,
  ArrowBigUp,
  AudioLines,
  Hammer,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type { ChatSettings } from "~/stores/chat-settings";

interface ChatInputButtonsProps {
  updateEnterToSend: (value: boolean) => void;
  chatSettings: ChatSettings;
  onTtsToggle: ((enabled: boolean) => void) | undefined;
  ttsEnabled: boolean;
  onVoiceChange: ((voice: string) => void) | undefined;
  selectedVoice: string | undefined;
  onSystemPromptEdit: (() => void) | undefined;
  onToolsClick: (() => void) | undefined;
}

export function ChatInputButtons({
  updateEnterToSend,
  chatSettings,
  onTtsToggle,
  ttsEnabled,
  onVoiceChange,
  selectedVoice,
  onSystemPromptEdit,
  onToolsClick,
}: ChatInputButtonsProps) {
  return (
    <div className="@max-[570px]:hidden">
      {/* Icon-only controls */}
      <div className="flex items-center gap-1">
        <TooltipProvider>
          {/* Enter key toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => updateEnterToSend(!chatSettings.enterToSend)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                {chatSettings.enterToSend ? (
                  <CornerDownLeft className="h-3.5 w-3.5" />
                ) : (
                  <ArrowBigUp className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {chatSettings.enterToSend
                ? "Enter sends message"
                : "Shift+Enter sends message"}
            </TooltipContent>
          </Tooltip>

          {/* TTS Toggle */}
          {onTtsToggle && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onTtsToggle(!ttsEnabled)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  {ttsEnabled ? (
                    <Volume2 className="h-3.5 w-3.5" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {ttsEnabled
                  ? "Disable text-to-speech"
                  : "Enable text-to-speech"}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Voice Selection */}
          {onVoiceChange && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      <AudioLines className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Select voice</TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                className="w-56 max-h-80 overflow-y-auto"
              >
                {chatSettings.availableVoices.length === 0 ? (
                  <DropdownMenuItem disabled>
                    No voices available
                  </DropdownMenuItem>
                ) : (
                  <>
                    {chatSettings.availableVoices.map((voice) => (
                      <DropdownMenuItem
                        key={voice.voiceURI}
                        onClick={() =>
                          onVoiceChange && onVoiceChange(voice.voiceURI)
                        }
                        className="gap-2"
                      >
                        <span className="flex-1">{voice.name}</span>
                        {selectedVoice === voice.voiceURI && (
                          <Check className="h-3 w-3" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* System Prompt Button */}
          {onSystemPromptEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onSystemPromptEdit}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit system prompt for this chat</TooltipContent>
            </Tooltip>
          )}

          {/* Tools Button */}
          {onToolsClick && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Manage tools"
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onToolsClick}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <Hammer className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Manage tools</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    </div>
  );
}
