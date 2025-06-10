import * as React from "react";
import { Send, Paperclip, Mic, Copy, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { post } from "~/lib/fetchWrapper";
import { AsyncAlert } from "./async-modals";
import type { StreamResponse } from "~/lib/webSocketClient";
import { queryClient } from "~/providers/queryClient";

interface Message {
  id: string;
  content: string;
  reasoning?: string;
  role: "system" | "developer" | "user" | "assistant" | "tool";
  timestamp: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  timeToFirstToken?: number;
  timeToFinish?: number;
}

interface ChatInterfaceProps {
  chatId: string;
  initialMessages: Message[];
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = React.useState(false);
  const codeRef = React.useRef<HTMLElement>(null);

  const handleCopy = async () => {
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(
          codeRef?.current?.textContent ?? "",
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (_) {
        /* noop – could toast */
      }
    } else {
      // fallback for http / older browsers
      const textarea = document.createElement("textarea");
      textarea.value = codeRef?.current?.textContent ?? "";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative group">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={
            copied ? "Code copied to clipboard" : "Copy code to clipboard"
          }
          title={copied ? "Copied!" : "Copy code"}
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <code ref={codeRef}>{children}</code>
      </div>
    </div>
  );
}

export function ChatInterface({
  chatId,
  initialMessages = [],
}: ChatInterfaceProps) {
  const [messages, setMessages] = React.useState<Message[]>(initialMessages);

  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const streamingRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [streamingMessageId, setStreamingMessageId] = React.useState<
    string | null
  >(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Update messages when initialMessages changes (e.g., when switching chats)
  React.useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Add cleanup effect
  React.useEffect(() => {
    return () => {
      if (streamingRef.current) {
        clearInterval(streamingRef.current);
      }
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollNewMessage = () => {
    // Get all elements with the class and take the last one
    const elements = document.querySelectorAll(".user-message");
    const lastElement = elements[elements.length - 1];
    if (!lastElement) return;
    lastElement.parentElement?.parentElement?.parentElement?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  React.useEffect(() => {
    setTimeout(scrollToBottom, 100);
  }, [chatId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textRef.current) return;
    const input = textRef.current.value ?? "";
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: Date.now(),
    };

    let msgsRef = [...messages, userMessage];
    setMessages((prev) => [...prev, userMessage]);
    textRef.current.value = "";
    setIsLoading(true);

    // Create empty assistant message to start streaming
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: "",
      role: "assistant",
      timestamp: Date.now(),
      timeToFinish: 0,
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setStreamingMessageId(assistantMessage.id);
    setTimeout(scrollNewMessage, 100);

    const streamResp = await post<StreamResponse | Response>(
      `/chat/${chatId}`,
      { messages: msgsRef },
      {
        returnResponse: true,
      },
    );

    if (streamResp.status !== 200 && streamResp instanceof Response) {
      const text = await streamResp.text();
      const message = text[0] === "{" ? JSON.parse(text).error : text;
      AsyncAlert({ title: "Error", message });
      //remove the last assistant message
      setMessages((prev) => [...prev.slice(0, -1)]);
    } else if ("stream" in streamResp) {
      const reader = streamResp.stream.getReader();

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const usage = value?.usage;

        if (usage) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                    ...msg,
                    promptTokens: usage.prompt_tokens,
                    completionTokens: usage.completion_tokens,
                    totalTokens: usage.total_tokens,
                  }
                : msg,
            ),
          );
        }

        const delta = value?.choices?.[0]?.delta;
        if (!delta) {
          console.error("delta is not defined", value);
          continue;
        }
        const msgKey = delta.reasoning ? "reasoning" : "content";
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? { ...msg, [msgKey]: (msg[msgKey] ?? "") + delta[msgKey] }
              : msg,
          ),
        );
      }
    }

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMessage.id
          ? { ...msg, timeToFinish: Date.now() }
          : msg,
      ),
    );

    // Streaming complete
    streamingRef.current = null;
    setIsLoading(false);
    setStreamingMessageId(null);
    queryClient.invalidateQueries({ queryKey: ["chats"] });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 py-4",
                message.role === "user" ? "flex-row-reverse" : "",
              )}
            >
              <Avatar className="h-8 w-8">
                {message.role === "assistant" ? (
                  <>
                    <AvatarFallback>AI</AvatarFallback>
                  </>
                ) : (
                  <>
                    <AvatarFallback>U</AvatarFallback>
                  </>
                )}
              </Avatar>
              <div
                className={cn(
                  "flex-1 space-y-2",
                  message.role === "user" ? "flex flex-col items-end" : "",
                )}
              >
                <div
                  className={cn(
                    "rounded-lg px-4 py-2 max-w-4xl",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                  )}
                >
                  {message.role === "user" ? (
                    <div className="prose prose-sm text-sm whitespace-pre-wrap user-message max-w-2xl max-h-[30vh] overflow-y-auto">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          code: ({ children, className }) => {
                            const childrenStr = typeof children === "string";
                            const multiLine = childrenStr
                              ? children.includes("\n")
                              : false;
                            const isInline =
                              !className?.includes("language-") && !multiLine;

                            if (isInline) {
                              return (
                                <code className="px-1 py-0.5 bg-primary text-primary-foreground rounded text-sm">
                                  {children}
                                </code>
                              );
                            }

                            return <CodeBlock>{children}</CodeBlock>;
                          },
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="prose prose-sm">
                      {message.reasoning ? (
                        <>
                          <h1>Reasoning</h1>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                              code: ({ children, className }) => {
                                const childrenStr =
                                  typeof children === "string";
                                const multiLine = childrenStr
                                  ? children.includes("\n")
                                  : false;
                                const isInline =
                                  !className?.includes("language-") &&
                                  !multiLine;

                                if (isInline) {
                                  return (
                                    <code className="px-1 py-0.5 bg-primary text-primary-foreground rounded text-sm">
                                      {children}
                                    </code>
                                  );
                                }

                                return <CodeBlock>{children}</CodeBlock>;
                              },
                            }}
                          >
                            {message.reasoning}
                          </ReactMarkdown>
                          <hr />
                        </>
                      ) : null}

                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          code: ({ children, className }) => {
                            const childrenStr = typeof children === "string";
                            const multiLine = childrenStr
                              ? children.includes("\n")
                              : false;
                            const isInline =
                              !className?.includes("language-") && !multiLine;

                            if (isInline) {
                              return (
                                <code className="px-1 py-0.5 bg-primary text-primary-foreground rounded text-sm">
                                  {children}
                                </code>
                              );
                            }

                            return <CodeBlock>{children}</CodeBlock>;
                          },
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                      {isLoading && streamingMessageId === message.id ? (
                        <div className="flex gap-3 py-4">
                          <div className="flex-1">
                            <div className="bg-muted rounded-lg px-4 py-2 max-w-[80%]">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(
                    message.role === "user"
                      ? message.timestamp
                      : (message.timeToFinish ?? 0),
                  ).toLocaleTimeString()}
                  {message.totalTokens
                    ? ` Total Tokens: ${message.totalTokens}`
                    : ""}
                </p>
                {isLoading && streamingMessageId === message.id ? (
                  <div className="h-lvh" />
                ) : null}
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-background">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-4">
          <div className="flex gap-2 items-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <div className="flex-1 relative">
              <Textarea
                ref={textRef}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="min-h-[60px] max-h-[200px] pr-12 resize-none"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                className="absolute bottom-2 right-2 h-8 w-8"
                disabled={isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
            >
              <Mic className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}
