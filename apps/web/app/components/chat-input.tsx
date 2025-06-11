import * as React from "react";
import {
  Send,
  Paperclip,
  Mic,
  X,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useRef, useState } from "react";
import { useSidebar } from "./ui/sidebar";
import { ModelSelector } from "./model-selector";
import type { ModelsResponse } from "./chat-interface";

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
}

export function ChatInput({
  onSubmit,
  isLoading = false,
  placeholder = "Message AI assistant...",
  selectedModel,
  onModelChange,
  modelsData,
  modelsLoading,
  modelsError,
  apiKeyInfo,
}: ChatInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sidebar = useSidebar();
  const sidebarCollapsed = sidebar.state === "collapsed";

  // Calculate usage percentage and determine status
  const getUsageStatus = () => {
    if (!apiKeyInfo) return null;

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

  const handleKeyUp = (extra?: any) => {
    if (!textareaRef.current) return;
    const message = textareaRef.current.value;
    const extraNumber = typeof extra === "number" ? extra : 0;

    const count = Math.max(message.split("\n").length, 1) + extraNumber;
    if (textareaRef.current) {
      textareaRef.current.style.height = `${count * 20}px`;
    }
  };

  const handleKeyDown = (e: any) => {
    if (e.key === "Enter") handleKeyUp(1);
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
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
      className={`fixed bottom-0 ${sidebarCollapsed ? "left-[48px]" : "left-[256px]"} right-0 z-40 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-4 animate-in slide-in-from-bottom duration-300`}
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
        <div>
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
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                onKeyUp={() => handleKeyUp()}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={placeholder}
                disabled={isLoading}
                autoFocus={true}
                rows={1}
                className={cn(
                  "w-full mt-2 mb-1 transition-all duration-50 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none",
                  "min-h-[24px] max-h-[200px]",
                )}
                style={{
                  scrollbarWidth: "thin",
                  height: "20px",
                }}
              />
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-1 py-2 pr-3">
              {/* Mic Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-muted/50 transition-colors"
                disabled={isLoading}
              >
                <Mic className="h-4 w-4" />
              </Button>

              {/* Send Button */}
              <Button
                type="button"
                size="icon"
                disabled={isLoading}
                onClick={handleSubmit}
                className={cn("h-8 w-8 rounded-lg transition-all duration-200")}
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
          <div className="mt-2 flex items-center justify-between px-2">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Press Enter to send, Shift+Enter for new line</span>
            </div>
            <div className="flex items-center gap-4">
              {/* API Key Usage Indicator */}
              {usageStatus && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
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
                        ? `${usageStatus.percentage.toFixed(1)}% remaining`
                        : "No credits remaining"}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="relative w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "absolute left-0 top-0 h-full transition-all duration-300",
                        usageStatus.status === "critical" && "bg-destructive",
                        usageStatus.status === "warning" && "bg-yellow-500",
                        usageStatus.status === "good" && "bg-green-500",
                      )}
                      style={{ width: `${usageStatus.percentage}%` }}
                    />
                  </div>
                </div>
              )}
              {selectedModel && onModelChange && (
                <ModelSelector
                  selectedModel={selectedModel}
                  onModelChange={onModelChange}
                  data={modelsData}
                  isLoading={modelsLoading}
                  error={modelsError}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
