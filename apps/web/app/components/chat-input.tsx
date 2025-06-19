import {
  Send,
  Paperclip,
  X,
  AlertCircle,
  CheckCircle,
  XCircle,
  Square,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn, getUsageStatus } from "~/lib/utils";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useSidebar } from "./ui/sidebar";
import { ModelSelector } from "./model-selector";
import { useChatSettings } from "~/stores/chat-settings";
import type { ApiKeyInfo, ModelsResponse } from "~/lib/chat/types";
import { useSpeechRecognition } from "~/hooks/chat/useSpeechRecognition";
import { ChatInputButtons } from "./chat-input-buttons";

interface ChatInputProps {
  onSubmit: (message: string, attachments: File[]) => void;
  onStop?: () => void;
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

export const ChatInput = forwardRef<{ focus: () => void }, ChatInputProps>(
  function ChatInput(
    {
      onSubmit,
      onStop,
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
    const { chatSettings, updateEnterToSend } = useChatSettings();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const textareaScrollHeightRef = useRef<HTMLTextAreaElement>(null);
    const sidebar = useSidebar();
    const sidebarCollapsed = sidebar.state === "collapsed";
    const isMobile = sidebar.isMobile;

    // Expose focus method through ref
    useImperativeHandle(ref, () => ({
      focus: () => {
        textareaRef.current?.focus();
      },
    }));

    // Calculate usage percentage and determine status
    const usageStatus = getUsageStatus(apiKeyInfo);

    const handleSubmit = useCallback(() => {
      if (!textareaRef.current) return;
      const message = textareaRef.current.value;

      if (message.trim() && !isLoading) {
        onSubmit(message, attachments);
        setAttachments([]);
        textareaRef.current.value = "";
        textareaRef.current.style.height = "20px";
      }
    }, [isLoading, onSubmit, attachments, setAttachments]);

    const handleKeyDown = useCallback(
      (e: any) => {
        if (textareaRef.current && textareaScrollHeightRef.current) {
          textareaScrollHeightRef.current.value = textareaRef.current.value;
        }

        if (e.key === "Enter") {
          if (chatSettings.enterToSend && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          } else if (!chatSettings.enterToSend && e.shiftKey) {
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
      },
      [chatSettings, sidebar],
    );

    const handleFileSelect = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setAttachments((prev) => [...prev, ...files]);
      },
      [setAttachments],
    );

    const removeAttachment = useCallback(
      (index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
      },
      [setAttachments],
    );

    const {
      pendingSubmit,
      submitTimeoutRef,
      setPendingSubmit,
      SpeechRecognition,
    } = useSpeechRecognition({
      textareaRef,
      handleKeyDown,
      handleSubmit,
      isLoading,
    });

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
                {/* Textarea for measuring text height */}
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

                {/* Textarea for actual input */}
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
                <SpeechRecognition />

                {/* Send/Stop Button */}
                <Button
                  type="button"
                  size="icon"
                  onClick={isLoading ? onStop : handleSubmit}
                  className={cn(
                    "h-8 w-8 rounded-lg transition-all duration-200",
                    pendingSubmit && "bg-primary hover:bg-primary/90",
                  )}
                  title={isLoading ? "Stop generation" : "Send message"}
                >
                  {isLoading ? (
                    <div className="relative flex items-center justify-center">
                      <div className="absolute h-7 w-7 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <Square className="h-3 w-3 fill-current" />
                    </div>
                  ) : (
                    <Send className={cn("h-4 w-4 transition-transform")} />
                  )}
                </Button>
              </div>
            </div>

            {/* Helper Text and Model Selector */}
            <div className="mt-2 w-full flex flex-1 gap-2 @max-[570px]:flex-col-reverse items-center justify-between px-2">
              <ChatInputButtons
                updateEnterToSend={updateEnterToSend}
                chatSettings={chatSettings}
                onTtsToggle={onTtsToggle}
                ttsEnabled={ttsEnabled}
                onVoiceChange={onVoiceChange}
                selectedVoice={selectedVoice}
                onSystemPromptEdit={onSystemPromptEdit}
                onToolsClick={onToolsClick}
              />

              {/* API Key Usage Indicator */}
              {usageStatus && <UsageStatus usageStatus={usageStatus} />}

              {/* Model Selector */}
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
  },
);

function UsageStatus({
  usageStatus,
}: {
  usageStatus: {
    percentage: number;
    status: "good" | "warning" | "critical";
    remaining: number;
    limit: number | null;
    usage: number;
  };
}) {
  return (
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
          {usageStatus.limit === null
            ? "Unlimited credits remaining"
            : usageStatus.remaining > 0
              ? `$ ${usageStatus.remaining.toFixed(3)} credits remain`
              : "No credits remaining"}
        </span>
      </div>
    </div>
  );
}
