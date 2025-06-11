import * as React from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { post } from "~/lib/fetchWrapper";
import { AsyncAlert } from "./async-modals";
import type { StreamResponse } from "~/lib/webSocketClient";
import { queryClient } from "~/providers/queryClient";
import { ChatInput } from "./chat-input";

interface Message {
  id: string;
  content:
    | string
    | Array<{
        type: string;
        text?: string;
        image_url?: { url: string };
        file?: { filename: string; file_data: string };
      }>;
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
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
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

  const handleSubmit = async (input: string, attachments: File[]) => {
    if (!input.trim() || isLoading) return;

    // Convert files to base64
    const fileToBase64 = async (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });
    };

    // Create content array if we have attachments
    let content: string | any[] = input;
    if (attachments.length > 0) {
      content = [{ type: "text", text: input }];

      // Add attachments to content array
      for (const file of attachments) {
        const base64Data = await fileToBase64(file);

        if (file.type.startsWith("image/")) {
          content.push({
            type: "image_url",
            image_url: { url: base64Data },
          });
        } else if (file.type === "application/pdf") {
          content.push({
            type: "file",
            file: {
              filename: file.name,
              file_data: base64Data,
            },
          });
        }
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content,
      role: "user",
      timestamp: Date.now(),
    };

    let msgsRef = [...messages, userMessage];
    setMessages((prev) => [...prev, userMessage]);
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
      const _message = text[0] === "{" ? JSON.parse(text).error : text;
      const raw = _message?.metadata?.raw
        ? JSON.parse(_message.metadata.raw)
        : { detail: "" };
      const message = _message.message
        ? `${_message.message} ${raw.detail}`
        : "Unknown Error Occurred, check console log for details";
      console.error(streamResp, text);
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
        const role = delta.role;
        if (role !== "assistant") {
          console.error(
            "obviously we forgot to plan for message roles that aren't assistant",
            value,
          );
          continue;
        }

        if (!delta) {
          console.error("delta is not defined", value);
          continue;
        }
        const msgKey = delta.reasoning ? "reasoning" : "content";
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? {
                  ...msg,
                  [msgKey]: (msg[msgKey] ?? "") + (delta[msgKey] || ""),
                }
              : msg,
          ),
        );
      }
    }

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMessage.id
          ? { ...msg, timeToFinish: Date.now() - msg.timestamp }
          : msg,
      ),
    );

    // Streaming complete
    streamingRef.current = null;
    setIsLoading(false);
    setStreamingMessageId(null);
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-5xl mx-auto px-4 mb-[70vh]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
              <div className="rounded-full bg-primary/10 p-6 mb-6">
                <svg
                  className="h-12 w-12 text-primary"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold mb-2">
                Start a conversation
              </h2>
              <p className="text-muted-foreground max-w-md">
                Ask me anything! I'm here to help with coding, analysis,
                creative writing, and more.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-8 w-full max-w-2xl">
                <button
                  onClick={() => handleSubmit("What can you help me with?", [])}
                  className="text-left p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                >
                  <h3 className="font-medium mb-1">Capabilities</h3>
                  <p className="text-sm text-muted-foreground">
                    Learn what I can do
                  </p>
                </button>
                <button
                  onClick={() => handleSubmit("Help me write code", [])}
                  className="text-left p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                >
                  <h3 className="font-medium mb-1">Code Assistant</h3>
                  <p className="text-sm text-muted-foreground">
                    Write and debug code
                  </p>
                </button>
                <button
                  onClick={() => handleSubmit("Help me analyze data", [])}
                  className="text-left p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                >
                  <h3 className="font-medium mb-1">Data Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Analyze and visualize data
                  </p>
                </button>
                <button
                  onClick={() => handleSubmit("Help me brainstorm ideas", [])}
                  className="text-left p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                >
                  <h3 className="font-medium mb-1">Creative Writing</h3>
                  <p className="text-sm text-muted-foreground">
                    Brainstorm and create content
                  </p>
                </button>
              </div>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 py-6 border-b border-border/50 last:border-0",
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
                    "rounded-2xl px-5 py-3 max-w-4xl shadow-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 border border-border/50",
                  )}
                >
                  {message.role === "user" ? (
                    <div className="prose prose-sm text-sm whitespace-pre-wrap user-message max-w-2xl max-h-[30vh] overflow-y-auto">
                      {typeof message.content === "string" ? (
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
                      ) : (
                        <div className="space-y-2">
                          {message.content.map((item, index) => {
                            if (item.type === "text") {
                              return (
                                <ReactMarkdown
                                  key={index}
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
                                  {item.text || ""}
                                </ReactMarkdown>
                              );
                            } else if (item.type === "image_url") {
                              return (
                                <img
                                  key={index}
                                  src={item.image_url?.url}
                                  alt="Uploaded image"
                                  className="max-w-full rounded-lg"
                                />
                              );
                            } else if (item.type === "file") {
                              return (
                                <div
                                  key={index}
                                  className="flex items-center gap-2 bg-primary/10 rounded-lg p-2"
                                >
                                  <span className="text-sm">
                                    📎 {item.file?.filename}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}
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
                        {typeof message.content === "string"
                          ? message.content
                          : "Assistant response"}
                      </ReactMarkdown>
                      {isLoading &&
                        streamingMessageId === message.id &&
                        !message.content && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" />
                              <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse [animation-delay:0.2s]" />
                              <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse [animation-delay:0.4s]" />
                            </div>
                            <span className="text-sm">Thinking...</span>
                          </div>
                        )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(
                    message.role === "user"
                      ? message.timestamp
                      : message.timestamp + (message.timeToFinish ?? 0),
                  ).toLocaleTimeString()}
                  {message.totalTokens
                    ? ` Total Tokens: ${message.totalTokens}`
                    : ""}
                </p>
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} className="mt-24" />
        </div>
      </div>

      {/* Modern Chat Input */}
      <ChatInput onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  );
}
