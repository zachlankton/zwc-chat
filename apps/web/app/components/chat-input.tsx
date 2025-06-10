import * as React from "react";
import { Send, Paperclip, Mic, Sparkles, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useEffect, useRef, useState } from "react";

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSubmit,
  isLoading = false,
  placeholder = "Message AI assistant...",
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200,
      )}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSubmit(message);
      setMessage("");
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
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
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-4 animate-in slide-in-from-bottom duration-300">
      <div className="max-w-4xl mx-auto px-4">
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
        <form onSubmit={handleSubmit}>
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
            <label htmlFor="file-upload" className="pb-3 pl-3">
              <input
                id="file-upload"
                type="file"
                multiple
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
            <div className="flex-1 py-3">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={placeholder}
                disabled={isLoading}
                rows={1}
                className={cn(
                  "w-full resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none",
                  "min-h-[24px] max-h-[200px]",
                )}
                style={{
                  scrollbarWidth: "thin",
                }}
              />
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-1 pb-3 pr-3">
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
                type="submit"
                size="icon"
                disabled={!message.trim() || isLoading}
                className={cn(
                  "h-8 w-8 rounded-lg transition-all duration-200",
                  message.trim()
                    ? "bg-primary hover:bg-primary/90 shadow-sm"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                ) : (
                  <Send
                    className={cn(
                      "h-4 w-4 transition-transform",
                      message.trim() && "translate-x-0.5",
                    )}
                  />
                )}
              </Button>
            </div>
          </div>

          {/* Helper Text */}
          <div className="mt-2 flex items-center justify-between px-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Press Enter to send, Shift+Enter for new line</span>
              {isFocused && (
                <div className="flex items-center gap-1 animate-in fade-in duration-300">
                  <Sparkles className="h-3 w-3" />
                  <span>AI is ready to help</span>
                </div>
              )}
            </div>
            {message.length > 0 && (
              <span className="animate-in fade-in duration-300">
                {message.length} / 4000
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}