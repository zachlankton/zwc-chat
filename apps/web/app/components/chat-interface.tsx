import * as React from "react";
import {
  Copy,
  Check,
  Sparkles,
  RotateCcw,
  GitBranchPlus,
  Trash2,
  Pencil,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { get, post, del, put, wsClient } from "~/lib/fetchWrapper";
import { AsyncAlert, AsyncConfirm, AsyncModal } from "./async-modals";
import { getHeaderAndText, type StreamResponse } from "~/lib/webSocketClient";
import { queryClient } from "~/providers/queryClient";
import { ChatInput } from "./chat-input";
import {
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";

export interface Model {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
}

export interface ModelsResponse {
  favorites: Model[];
  all: Model[];
}

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { useApiKeyInfo } from "~/stores/session";
import { parseSSEEvents } from "~/lib/llm-tools";

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
  model?: string; // Model used for this message
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

function MessageCopyButton({
  content,
  reasoning,
}: {
  content: string | any[];
  reasoning?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    // Convert content to markdown string
    let markdownContent = "";

    // Add reasoning if present
    if (reasoning) {
      markdownContent = `# Reasoning\n\n${reasoning}\n\n---\n\n`;
    }

    if (typeof content === "string") {
      markdownContent += content;
    } else if (Array.isArray(content)) {
      // Handle array content (mixed text/images/files)
      markdownContent += content
        .map((item) => {
          if (item.type === "text") {
            return item.text || "";
          } else if (item.type === "image_url") {
            return `![Image](${item.image_url?.url})`;
          } else if (item.type === "file") {
            return `[${item.file?.filename}]`;
          }
          return "";
        })
        .join("\n\n");
    }

    try {
      await navigator.clipboard.writeText(markdownContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = markdownContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-6 has-[>svg]:px-2 has-[>svg]:py-4 text-xs hover:bg-muted/50"
    >
      {copied ? <Check className="h-3" /> : <Copy className="h-3" />}
    </Button>
  );
}

function MessageRetryButton({
  messageIndex,
  messageModel,
  currentModel,
  onRetry,
}: {
  messageIndex: number;
  messageModel: string;
  currentModel: string;
  onRetry: (messageIndex: number, opts?: { newModel?: string }) => void;
}) {
  const modelsAreSame = messageModel === currentModel;
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
          <DropdownMenuItem
            onClick={() => onRetry(messageIndex, { newModel: currentModel })}
            disabled={modelsAreSame}
          >
            {modelsAreSame ? (
              <span className="flex text-muted-foreground">
                <Sparkles className="h-4 w-4 mr-2" />
                Change your current model to retry with that
              </span>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Retry with {currentModel.split("/")[1] || currentModel}
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function MessageBranchButton({
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

function MessageEditButton({
  messageId,
  content,
  onEdit,
  isUserMessage,
  hasNextAssistantMessage,
}: {
  messageId: string;
  content: string | any[];
  onEdit: (
    messageId: string,
    newContent: string,
    regenerateNext: boolean,
  ) => void;
  isUserMessage: boolean;
  hasNextAssistantMessage: boolean;
}) {
  const handleEdit = async () => {
    // Extract text content from message
    let textContent = "";
    if (typeof content === "string") {
      textContent = content;
    } else if (Array.isArray(content)) {
      // Extract text from content array
      const textPart = content.find((item: any) => item.type === "text") as any;
      textContent = textPart?.text || "";
    }

    const result = await AsyncModal(
      <>
        <DialogTitle className="mb-4 text-xl font-bold">
          Edit Message
        </DialogTitle>
        <DialogDescription className="mb-4">
          Edit the message content below:
        </DialogDescription>
        <div className="mb-4">
          <Textarea
            name="content"
            defaultValue={textContent}
            className="min-h-[50vh] w-full resize-y"
            placeholder="Enter your message..."
            autoFocus
          />
        </div>
        {isUserMessage && hasNextAssistantMessage && (
          <div className="mb-6 flex items-center space-x-2">
            <Checkbox id="regenerate" name="regenerate" defaultChecked={true} />
            <Label
              htmlFor="regenerate"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Regenerate assistant response after editing
            </Label>
          </div>
        )}
        <div className="grid grid-flow-row-dense grid-cols-2 gap-3">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" variant="default">
            Save
          </Button>
        </div>
      </>,
      {
        style: { maxWidth: "80vw" },
        initialData: {
          content: textContent,
          regenerate: true,
        },
      },
    );

    if (result.ok && result.data.content?.trim()) {
      const regenerateNext =
        isUserMessage && hasNextAssistantMessage && result.data.regenerate;
      onEdit(messageId, result.data.content.trim(), regenerateNext);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleEdit}
      className="h-6 has-[>svg]:px-2 has-[>svg]:py-4 text-xs hover:bg-muted/50"
      title="Edit message"
    >
      <Pencil className="h-3" />
    </Button>
  );
}

function MessageDeleteButton({
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
      <div className="absolute right-2 top-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 z-50"
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
  const {
    data: modelsData,
    isLoading: modelsLoading,
    error: modelsError,
  } = useQuery<ModelsResponse>({
    queryKey: ["models"],
    queryFn: () => get("/api/models"),
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const apiKeyInfo = useApiKeyInfo();

  const streamingRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [streamingMessageId, setStreamingMessageId] = React.useState<
    string | null
  >(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const [messages, setMessages] = React.useState<Message[]>(initialMessages);
  const buffer = React.useRef("");
  const assistantMessage = React.useRef<null | Message>(null);

  const wsStream = React.useCallback((data: any) => {
    if (assistantMessage.current === null) return;
    const messageHasThisChatId =
      data.type &&
      data.headers &&
      data.headers["x-zwc-chat-id"] &&
      data.headers["x-zwc-chat-id"] === chatId;

    if (data instanceof ArrayBuffer) {
      const { header, text } = getHeaderAndText(data);
      if (!header.chatId) return;
      if (header.chatId !== chatId) return;

      const stashMessageLength = messages.length;
      const isNewChat =
        initialMessages.length === 0 && stashMessageLength === 0;

      for (const chunk of parseSSEEvents(text, buffer)) {
        if (chunk.type === "data" && assistantMessage.current) {
          handleChunk({
            value: chunk.parsed,
            setMessages,
            assistantMessage: assistantMessage.current,
          });
        } else if (chunk.type === "done") {
          setIsLoading(false);
          setStreamingMessageId(null);
          streamingRef.current = null;

          assistantMessage.current = null;

          // Generate title for new chats after first response
          if (isNewChat) {
            // Fire and forget - don't wait for title generation
            post(`/chat/${chatId}/generate-title`, {})
              .then(() => {
                // Invalidate chats query to refresh the title
                setTimeout(() => {
                  queryClient.invalidateQueries({ queryKey: ["chats"] });
                  queryClient.invalidateQueries({ queryKey: ["APIKEYINFO"] });
                }, 1000);
              })
              .catch((err) => console.error("Failed to generate title:", err));
          } else {
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ["APIKEYINFO"] });
              queryClient.invalidateQueries({ queryKey: ["chats"] });
            }, 1000);
          }
        } else {
          console.log({ text, chunk });
        }
      }
    } else {
      if (!messageHasThisChatId) return;

      if (
        data.status === 403 &&
        data.body &&
        data.body.error &&
        data.body.error.message.toLowerCase().includes("key limit exceeded")
      ) {
        AsyncAlert({
          title: "Error",
          message: "You have reached your limit",
        });
      } else {
        console.error(data);
        const message =
          data?.body?.error?.message ?? "An unknown error occurred";
        AsyncAlert({
          message: (
            <div className="flex flex-col gap-2 mb-4">
              <h1 className="text-xl strong">Error</h1>
              <p>{message}</p>
              <p>
                Could be upstream, check{" "}
                <a href="https://status.openrouter.ai/" target="_blank">
                  https://status.openrouter.ai/
                </a>
              </p>
            </div>
          ),
        });
      }
      // Restore the original message
      if (assistantMessage.current !== null) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.current?.id
              ? (assistantMessage.current as Message)
              : msg,
          ),
        );
      } else {
        setMessages((prev) => [...prev.slice(0, -1)]);
      }

      setIsLoading(false);
      setStreamingMessageId(null);
      streamingRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    wsClient.on("message", wsStream);
    return () => {
      wsClient.off("message", wsStream);
    };
  }, []);

  // Initialize selectedModel based on context
  const getInitialModel = () => {
    // For existing chats, use the model from the last assistant message
    if (initialMessages.length > 0) {
      const lastAssistantMessage = [...initialMessages]
        .reverse()
        .find((msg) => msg.role === "assistant" && msg.model);
      if (lastAssistantMessage?.model) {
        return lastAssistantMessage.model;
      }
    }

    // For new chats, use localStorage
    const savedModel = localStorage.getItem("selectedModel");
    if (savedModel) {
      return savedModel;
    }

    // Default fallback
    return "openai/gpt-4o-mini";
  };

  const [selectedModel, setSelectedModel] =
    React.useState<string>(getInitialModel());

  // Update messages when initialMessages changes (e.g., when switching chats)
  React.useEffect(() => {
    setMessages(initialMessages);

    // Also update the selected model based on the new chat's messages
    if (initialMessages.length > 0) {
      const lastAssistantMessage = [...initialMessages]
        .reverse()
        .find((msg) => msg.role === "assistant" && msg.model);
      if (lastAssistantMessage?.model) {
        setSelectedModel(lastAssistantMessage.model);
      }
    }
  }, [initialMessages]);

  // Save selected model to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem("selectedModel", selectedModel);
  }, [selectedModel]);

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
      behavior: "instant",
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
    const stashMessageLength = messages.length;
    const isNewChat = initialMessages.length === 0 && stashMessageLength === 0;

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

    // If this is a new chat, immediately add a placeholder to the chat list
    if (isNewChat) {
      queryClient.setQueryData(["chats"], (oldData: any) => {
        if (!oldData) return oldData;

        const placeholderChat = {
          id: chatId,
          title: "Generating...",
          lastMessage:
            typeof content === "string"
              ? content.slice(0, 50)
              : "New conversation",
          updatedAt: new Date().toISOString(),
          messageCount: 1,
        };

        return {
          ...oldData,
          chats: [placeholderChat, ...oldData.chats],
          total: oldData.total + 1,
        };
      });
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: content,
      role: "user",
      timestamp: Date.now(),
    };

    let msgsRef = [...messages, userMessage];
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Create empty assistant message to start streaming
    assistantMessage.current = {
      id: (Date.now() + 1).toString(),
      content: "",
      role: "assistant",
      model: selectedModel, // Include the model being used
      timestamp: Date.now(),
      timeToFinish: 0,
    };

    setMessages((prev) => [...prev, assistantMessage.current as Message]);
    setStreamingMessageId(assistantMessage.current.id);
    setTimeout(scrollNewMessage, 100);

    post<StreamResponse | Response>(
      `/chat/${chatId}`,
      { messages: msgsRef, model: selectedModel },
      {
        resolveImmediately: true,
      },
    );
  };

  const handleRetry = async (
    messageIndex: number,
    opts?: { newModel?: string; newContentForPreviousMessage?: string },
  ) => {
    if (isLoading) return;

    // Get the message to retry and ensure it's an assistant message
    assistantMessage.current = messages[messageIndex];

    if (assistantMessage.current.role !== "assistant") {
      console.error(
        "messageToRetry was not assistant",
        assistantMessage.current,
      );
      AsyncAlert({
        title: "Hmmmm...",
        message: `Normally the message we are going to retry is an assistant message, but we got role: ${assistantMessage.current.role}`,
      });
      return;
    }

    // Find all messages up to and including the user message before this assistant message
    const messagesUpToRetry = messages.slice(0, messageIndex);
    const prevUserMsg = messagesUpToRetry.at(-1);

    if (opts?.newContentForPreviousMessage && prevUserMsg)
      prevUserMsg.content = opts?.newContentForPreviousMessage;

    // Update the model if a new one was selected
    const modelToUse =
      opts?.newModel || assistantMessage.current.model || selectedModel;

    setIsLoading(true);

    // Mark this specific message as being regenerated
    setStreamingMessageId(assistantMessage.current.id);

    // Clear the content of the message being retried
    setMessages((prev) =>
      prev.map((msg, idx) =>
        idx === messageIndex
          ? { ...msg, content: "", reasoning: undefined, model: modelToUse }
          : msg,
      ),
    );

    post<StreamResponse | Response>(
      `/chat/${chatId}`,
      {
        messages: messagesUpToRetry,
        model: modelToUse,
        messageIdToReplace: assistantMessage.current.id,
      },
      {
        resolveImmediately: true,
      },
    );
  };

  const handleBranch = async (messageId: string, messageIndex: number) => {
    try {
      const response = await post<{
        success: boolean;
        newChatId: string;
        branchedFrom: {
          chatId: string;
          messageId: string;
        };
      }>(`/chat/${chatId}/branch`, {
        messageId,
        messageIndex,
      });

      if (response.success && response.newChatId) {
        // Navigate to the new branched chat
        window.location.href = `/chat/${response.newChatId}`;
      }
    } catch (error) {
      console.error("Failed to branch chat:", error);
      AsyncAlert({
        title: "Error",
        message: "Failed to branch conversation. Please try again.",
      });
    }
  };

  const handleDelete = async (messageId: string) => {
    const { ok } = await AsyncConfirm({
      destructive: true,
      title: "Delete Message",
      message:
        "Are you sure you want to delete this message? This action cannot be undone.",
    });

    if (!ok) return;

    try {
      // Call API to delete message
      await del(`/chat/${chatId}/message/${messageId}`);

      // Remove message from local state
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));

      // Invalidate chat list to update last message if needed
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    } catch (error) {
      console.error("Failed to delete message:", error);
      AsyncAlert({
        title: "Error",
        message: "Failed to delete message. Please try again.",
      });
    }
  };

  const handleEdit = async (
    messageId: string,
    newContent: string,
    regenerateNext: boolean,
  ) => {
    try {
      // Find the message to edit
      const messageIndex = messages.findIndex((msg) => msg.id === messageId);
      if (messageIndex === -1) return;

      const originalMessage = messages[messageIndex];

      // Optimistically update the message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                content:
                  typeof msg.content === "string"
                    ? newContent
                    : [{ type: "text", text: newContent }],
              }
            : msg,
        ),
      );

      // Call API to update message
      await put<Response>(`/chat/${chatId}/message/${messageId}`, {
        content: newContent,
      });

      // If this was a user message and we should regenerate the next assistant message
      if (regenerateNext && originalMessage.role === "user") {
        const nextMessageIndex = messageIndex + 1;
        if (
          nextMessageIndex < messages.length &&
          messages[nextMessageIndex].role === "assistant"
        ) {
          // Use handleRetry to regenerate the assistant response
          setTimeout(() => {
            handleRetry(nextMessageIndex, {
              newContentForPreviousMessage: newContent,
            });
          }, 100);
        }
      }
    } catch (error) {
      console.error("Failed to edit message:", error);

      // Revert the optimistic update on error
      setMessages((prev) => [...prev]);

      AsyncAlert({
        title: "Error",
        message: "Failed to edit message. Please try again.",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="@container flex-1 overflow-y-auto pb-32">
        <div className="max-w-[1000px] mx-auto px-4 @max-[560px]:px-1 mb-[70vh]">
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
          {messages &&
            messages.map((message, index) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3 py-6 border-b border-border/50 last:border-0",
                  message.role === "user" ? "flex-row-reverse" : "",
                )}
              >
                <Avatar className="h-8 w-8 @max-[560px]:hidden">
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
                    "flex-1 space-y-2 max-w-[88%] @max-[560px]:max-w-full",
                    message.role === "user" ? "flex flex-col items-end" : "",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-5 py-3 max-w-full shadow-sm",
                      message.role === "user"
                        ? "bg-muted/100 text-foreground"
                        : "bg-muted/50 border border-border/50",
                    )}
                  >
                    {message.role === "user" ? (
                      <div className="prose prose-sm text-sm user-message max-w-full max-h-[40vh] overflow-y-auto">
                        {typeof message.content === "string" ? (
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

                                        return (
                                          <CodeBlock>{children}</CodeBlock>
                                        );
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
                  <div className="flex @max-[560px]:px-10 max-w-4xl items-center justify-between text-xs text-muted-foreground">
                    <div className="flex @max-[560px]:hidden items-center gap-2">
                      {message.model && message.role === "assistant" && (
                        <>
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            {message.model.split("/")[1] || message.model}
                          </span>
                        </>
                      )}
                      {message.totalTokens && (
                        <>
                          <span>•</span>
                          <span>{message.totalTokens} tokens</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {message.role === "assistant" && (
                        <>
                          <MessageRetryButton
                            messageIndex={index}
                            messageModel={message.model ?? ""}
                            currentModel={selectedModel}
                            onRetry={handleRetry}
                          />
                          <MessageBranchButton
                            messageId={message.id}
                            messageIndex={index}
                            onBranch={handleBranch}
                          />
                          <MessageCopyButton
                            content={message.content}
                            reasoning={message.reasoning}
                          />
                        </>
                      )}
                      <MessageEditButton
                        messageId={message.id}
                        content={message.content}
                        onEdit={handleEdit}
                        isUserMessage={message.role === "user"}
                        hasNextAssistantMessage={
                          message.role === "user" &&
                          index < messages.length - 1 &&
                          messages[index + 1].role === "assistant"
                        }
                      />
                      <MessageDeleteButton
                        messageId={message.id}
                        onDelete={handleDelete}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

          <div ref={messagesEndRef} className="mt-24" />
        </div>
      </div>

      {/* Modern Chat Input */}
      <ChatInput
        onSubmit={handleSubmit}
        isLoading={isLoading}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        modelsData={modelsData}
        modelsLoading={modelsLoading}
        modelsError={modelsError}
        apiKeyInfo={apiKeyInfo?.data}
      />
    </div>
  );
}

function handleChunk({
  value,
  setMessages,
  assistantMessage,
}: {
  value: any;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  assistantMessage: Message;
}) {
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
    return;
  }

  if (!delta) {
    console.error("delta is not defined", value);
    return;
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

  setMessages((prev) =>
    prev.map((msg) =>
      msg.id === assistantMessage.id
        ? { ...msg, timeToFinish: Date.now() - msg.timestamp }
        : msg,
    ),
  );
}
