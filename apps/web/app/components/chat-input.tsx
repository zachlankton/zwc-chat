import * as React from "react";
import {
  Send,
  Paperclip,
  Mic,
  X,
  AlertCircle,
  CheckCircle,
  XCircle,
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
import { cn } from "~/lib/utils";
import { useRef, useState, useEffect } from "react";
import { useSidebar } from "./ui/sidebar";
import { ModelSelector } from "./model-selector";
import type { ModelsResponse } from "./chat-interface";
import { useChatSettings } from "~/stores/chat-settings";

interface ApiKeyInfo {
  label: string;
  limit: number;
  usage: number;
  is_provisioning_key: boolean;
  limit_remaining: number;
  is_free_tier: boolean;
  rate_limit: {
    requests: number;
    interval: string;
  };
}

interface ChatInputProps {
  onSubmit: (message: string, attachments: File[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  modelsData?: ModelsResponse;
  modelsLoading: any;
  modelsError: any;
  apiKeyInfo?: ApiKeyInfo | null;
  ttsEnabled?: boolean;
  onTtsToggle?: (enabled: boolean) => void;
  selectedVoice?: string;
  onVoiceChange?: (voice: string) => void;
  onSystemPromptEdit?: () => void;
  onToolsClick?: () => void;
}

export const ChatInput = React.forwardRef<
  { focus: () => void },
  ChatInputProps
>(function ChatInput(
  {
    onSubmit,
    isLoading = false,
    placeholder = "Message AI assistant...",
    selectedModel,
    onModelChange,
    modelsData,
    modelsLoading,
    modelsError,
    apiKeyInfo,
    ttsEnabled = false,
    onTtsToggle,
    selectedVoice,
    onVoiceChange,
    onSystemPromptEdit,
    onToolsClick,
  }: ChatInputProps,
  ref,
) {
  const [isFocused, setIsFocused] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [showVoiceHint, setShowVoiceHint] = useState(false);
  const { settings, updateEnterToSend } = useChatSettings();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaScrollHeightRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const voiceHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sidebar = useSidebar();
  const sidebarCollapsed = sidebar.state === "collapsed";
  const isMobile = sidebar.isMobile;

  // Expose focus method through ref
  React.useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    },
  }));

  // Calculate usage percentage and determine status
  const getUsageStatus = () => {
    if (!apiKeyInfo || apiKeyInfo.limit === 0) return null;

    const usagePercentage = (apiKeyInfo.usage / apiKeyInfo.limit) * 100;
    const remainingPercentage = Math.max(0, 100 - usagePercentage);

    let status: "good" | "warning" | "critical" = "good";
    if (usagePercentage >= 90) {
      status = "critical";
    } else if (usagePercentage >= 80) {
      status = "warning";
    }

    return {
      percentage: remainingPercentage,
      status,
      remaining: apiKeyInfo.limit_remaining,
      limit: apiKeyInfo.limit,
      usage: apiKeyInfo.usage,
    };
  };

  const usageStatus = getUsageStatus();

  // Check for speech recognition support
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      setSpeechSupported(!!SpeechRecognition);
    }
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (!speechSupported) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setShowVoiceHint(false);

      // Show hint after 2 seconds of dictation
      if (voiceHintTimeoutRef.current) {
        clearTimeout(voiceHintTimeoutRef.current);
      }
      voiceHintTimeoutRef.current = setTimeout(() => {
        setShowVoiceHint(true);
      }, 2000);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      // Update textarea with current transcript
      if (textareaRef.current) {
        const currentValue = textareaRef.current.value;
        const newValue = currentValue + finalTranscript;
        textareaRef.current.value = newValue;

        // Trigger resize
        const event = new Event("input", { bubbles: true });
        textareaRef.current.dispatchEvent(event);
        handleKeyDown({ key: "" } as any);

        // Check for voice command
        const trimmedValue = newValue.trim().toLowerCase();
        const sendCommands = ["send message", "send the message", "send it"];

        for (const command of sendCommands) {
          if (trimmedValue.endsWith(command)) {
            // Clear any existing timeout
            if (submitTimeoutRef.current) {
              clearTimeout(submitTimeoutRef.current);
            }

            // Set pending state and schedule submission
            setPendingSubmit(true);
            submitTimeoutRef.current = setTimeout(() => {
              // Remove the command from the message
              const startOfCommand = newValue.indexOf(command);
              const messageWithoutCommand = newValue
                .slice(0, startOfCommand)
                .trim();
              if (messageWithoutCommand && textareaRef.current) {
                textareaRef.current.value = messageWithoutCommand;
                recognitionRef.current?.stop();
                handleSubmit();
              }
              setPendingSubmit(false);
            }, 1500); // 1.5 second delay
            break;
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setShowVoiceHint(false);
      if (voiceHintTimeoutRef.current) {
        clearTimeout(voiceHintTimeoutRef.current);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
      if (voiceHintTimeoutRef.current) {
        clearTimeout(voiceHintTimeoutRef.current);
      }
    };
  }, [speechSupported]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handleSubmit = () => {
    if (!textareaRef.current) return;
    const message = textareaRef.current.value;

    if (message.trim() && !isLoading) {
      onSubmit(message, attachments);
      setAttachments([]);
      textareaRef.current.value = "";
      textareaRef.current.style.height = "20px";
    }
  };

  const handleKeyDown = (e: any) => {
    if (textareaRef.current && textareaScrollHeightRef.current) {
      textareaScrollHeightRef.current.value = textareaRef.current.value;
    }

    if (e.key === "Enter") {
      if (settings.enterToSend && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      } else if (!settings.enterToSend && e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    }

    setTimeout(() => {
      if (!textareaRef.current) return;
      if (!textareaScrollHeightRef.current) return;

      const textarea = textareaRef.current;
      const textScroll = textareaScrollHeightRef.current;

      const message = textarea.value;

      const textSize = sidebar.isMobile ? 30 : 20;

      if (message.length === 0)
        return (textarea.style.height = `${textSize}px`);

      const count = Math.max(message.split("\n").length, 1);
      textarea.style.height = `${count * textSize}px`;

      // Get the scroll height (content height)
      const scrollHeight = textScroll.scrollHeight;

      textarea.style.height = `${Math.max(scrollHeight, count * textSize)}px`;
    }, 100);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div
      className={`fixed bottom-0 ${isMobile ? "left-0" : sidebarCollapsed ? "left-[48px]" : "left-[256px]"} right-0 z-40 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-4 animate-in slide-in-from-bottom duration-300`}
    >
      <div className="max-w-4xl mx-auto px-6">
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-sm"
              >
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[200px] truncate">{file.name}</span>
                <button
                  onClick={() => removeAttachment(index)}
                  className="hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main Input Container */}
        <div className="@container">
          <div
            className={cn(
              "relative flex items-end gap-2 rounded-2xl border-2 bg-background/95 backdrop-blur-sm transition-all duration-200",
              isFocused
                ? "border-primary shadow-lg shadow-primary/20 scale-[1.01]"
                : "border-muted hover:border-muted-foreground/50 shadow-md",
              isLoading && "opacity-70",
            )}
          >
            {/* Attachment Button */}
            <label htmlFor="file-upload" className="py-2 pl-3">
              <input
                id="file-upload"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={handleFileSelect}
                className="sr-only"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-muted/50 transition-colors"
                disabled={isLoading}
                asChild
              >
                <span>
                  <Paperclip className="h-4 w-4" />
                </span>
              </Button>
            </label>

            {/* Textarea */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaScrollHeightRef}
                disabled={isLoading}
                rows={1}
                className={cn(
                  "w-full absolute bottom-[-9000px] bg-transparent text-transparent mt-2 mb-1 resize-none text-sm",
                  "min-h-[24px] max-h-[200px]",
                  isMobile ? "text-xl" : "",
                )}
                style={{
                  scrollbarWidth: "thin",
                  height: isMobile ? "30px" : "20px",
                }}
              />
              <textarea
                ref={textareaRef}
                onKeyDown={handleKeyDown}
                onChange={() => {
                  // Cancel pending submit if user types manually
                  if (submitTimeoutRef.current) {
                    clearTimeout(submitTimeoutRef.current);
                    setPendingSubmit(false);
                  }
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={placeholder}
                disabled={isLoading}
                autoFocus={true}
                rows={1}
                className={cn(
                  "w-full mt-2 mb-1 transition-all duration-50 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none",
                  "min-h-[24px] max-h-[200px]",
                  isMobile ? "text-xl" : "",
                )}
                style={{
                  scrollbarWidth: "thin",
                  height: isMobile ? "30px" : "20px",
                }}
              />
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-1 py-2 pr-3">
              {/* Mic Button */}
              {speechSupported && (
                <div className="relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 hover:bg-muted/50 transition-colors",
                      isListening &&
                        "bg-destructive/10 hover:bg-destructive/20 text-destructive",
                      pendingSubmit && "animate-pulse",
                    )}
                    disabled={isLoading}
                    onClick={toggleListening}
                    title={isListening ? "Stop recording" : "Start voice input"}
                  >
                    {isListening ? (
                      <div className="relative">
                        <Mic
                          className={cn(
                            "h-4 w-4",
                            pendingSubmit && "text-primary",
                          )}
                        />
                        <span
                          className={cn(
                            "absolute -top-1 -right-1 h-2 w-2 rounded-full",
                            pendingSubmit
                              ? "bg-primary animate-ping"
                              : "bg-destructive animate-pulse",
                          )}
                        />
                      </div>
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>

                  {/* Voice Command Hint */}
                  {showVoiceHint && isListening && !pendingSubmit && (
                    <div className="absolute bottom-full right-0 mb-2 pointer-events-none">
                      <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          Say "send message" to send
                        </p>
                        <div className="absolute bottom-0 right-3 transform translate-y-1/2 rotate-45 w-2 h-2 bg-card border-r border-b border-border" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pending Submit Indicator */}
              {pendingSubmit && (
                <span className="text-xs text-primary animate-pulse mr-1">
                  Sending...
                </span>
              )}

              {/* Send Button */}
              <Button
                type="button"
                size="icon"
                disabled={isLoading}
                onClick={handleSubmit}
                className={cn(
                  "h-8 w-8 rounded-lg transition-all duration-200",
                  pendingSubmit && "bg-primary hover:bg-primary/90",
                )}
              >
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                ) : (
                  <Send className={cn("h-4 w-4 transition-transform")} />
                )}
              </Button>
            </div>
          </div>

          {/* Helper Text and Model Selector */}
          <div className="mt-2 w-full flex flex-1 gap-2 @max-[570px]:flex-col-reverse items-center justify-between px-2">
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
                        onClick={() => updateEnterToSend(!settings.enterToSend)}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      >
                        {settings.enterToSend ? (
                          <CornerDownLeft className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowBigUp className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {settings.enterToSend
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
                        {settings.availableVoices.length === 0 ? (
                          <DropdownMenuItem disabled>
                            No voices available
                          </DropdownMenuItem>
                        ) : (
                          <>
                            {settings.availableVoices.map((voice) => (
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
                      <TooltipContent>
                        Edit system prompt for this chat
                      </TooltipContent>
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

            {/* API Key Usage Indicator */}
            {usageStatus && (
              <div className="flex flex-1 flex-col min-w-[150px] justify-center @max-[570px]:w-full @max-[570px]:flex-row @max-[600px]:text-center items-center gap-2">
                <div className="flex flex-1 items-center justify-center gap-1.5 max-w-[180px]">
                  {usageStatus.status === "critical" ? (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  ) : usageStatus.status === "warning" ? (
                    <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  )}
                  <span
                    className={cn(
                      "text-xs font-medium",
                      usageStatus.status === "critical" && "text-destructive",
                      usageStatus.status === "warning" && "text-yellow-500",
                      usageStatus.status === "good" && "text-green-500",
                    )}
                  >
                    {usageStatus.remaining > 0
                      ? `$ ${usageStatus.remaining.toFixed(3)} credits remain`
                      : "No credits remaining"}
                  </span>
                </div>
              </div>
            )}
            {selectedModel && onModelChange && (
              <div className="flex-1 min-w-[200px] max-w-[250px]">
                <ModelSelector
                  selectedModel={selectedModel}
                  onModelChange={onModelChange}
                  data={modelsData}
                  isLoading={modelsLoading}
                  error={modelsError}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
