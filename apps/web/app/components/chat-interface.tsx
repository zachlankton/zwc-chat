import * as React from "react";
import {
  Copy,
  Check,
  Sparkles,
  RotateCcw,
  GitBranchPlus,
  Trash2,
  Pencil,
  Volume2,
  VolumeX,
  Hammer,
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
import { DialogClose } from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { ModelSelectorModal } from "./model-selector";

export function tryParseJson(txt: string) {
  try {
    return JSON.parse(txt);
  } catch (error) {
    return txt;
  }
}

export interface Model {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  supported_parameters?: string[];
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
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { useApiKeyInfo } from "~/stores/session";
import { useChatSettings } from "~/stores/chat-settings";
import { parseSSEEvents } from "~/lib/llm-tools";
import {
  DialogDescription,
  DialogTitle as DialogTitleComponent,
} from "~/components/ui/dialog";
import { ToolManager } from "./tool-manager";
import { formatToolsForAPI, executeToolCalls } from "~/lib/tool-executor";
import type { ToolCall } from "~/types/tools";
import { useNavigate } from "react-router";
import type { ChatListResponse } from "./chat-list";

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
  // Tool-related fields
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string; // Tool name for tool messages
  annotations?: any;
}

interface ChatInterfaceProps {
  chatId: string;
  initialMessages: Message[];
}

function MessageSpeakButton({
  messageId,
  isPlaying,
  onToggleSpeak,
}: {
  messageId: string;
  content: string | any[];
  reasoning?: string;
  isPlaying: boolean;
  onToggleSpeak: (messageId: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onToggleSpeak(messageId)}
      className="h-6 has-[>svg]:px-2 has-[>svg]:py-4 text-xs hover:bg-muted/50"
      title={isPlaying ? "Stop speaking" : "Speak message"}
    >
      {isPlaying ? <VolumeX className="h-3" /> : <Volume2 className="h-3" />}
    </Button>
  );
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
                <Sparkles className="h-4 w-4 mr-2" />
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
        <DialogTitleComponent className="mb-4 text-xl font-bold">
          Edit Message
        </DialogTitleComponent>
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
      <div className="absolute -right-2 -top-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
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
  const apiKeyInfo = useApiKeyInfo();
  const navigate = useNavigate();

  // Shared ReactMarkdown components configuration
  const markdownComponents = {
    a: ({ href, children }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        {children}
      </a>
    ),
    code: ({ children, className }: any) => {
      const childrenStr = typeof children === "string";
      const multiLine = childrenStr ? children.includes("\n") : false;
      const isInline = !className?.includes("language-") && !multiLine;
      if (isInline) {
        return (
          <code className="px-1 py-0.5 bg-primary text-primary-foreground rounded text-sm">
            {children}
          </code>
        );
      }
      return <CodeBlock>{children}</CodeBlock>;
    },
  };

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

  const {
    data: modelsData,
    isLoading: modelsLoading,
    error: modelsError,
  } = useQuery<ModelsResponse>({
    queryKey: ["models"],
    queryFn: () => get("/api/models"),
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const [selectedModel, setSelectedModel] =
    React.useState<string>(getInitialModel());

  const model = React.useMemo(() => {
    return modelsData
      ? modelsData.all.find((m) => m.id === selectedModel)
      : null;
  }, [selectedModel, modelsData]);

  const isNewChat = React.useRef<boolean>(false);
  const resettingOffset = React.useRef<boolean>(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [streamingMessageId, setStreamingMessageId] = React.useState<
    string | null
  >(null);
  const streamingMessageIdRef = React.useRef<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const [messages, _setMessages] = React.useState<Message[]>(initialMessages);
  const buffer = React.useRef("");
  const assistantMessage = React.useRef<null | Message>(null);
  const messagesRef = React.useRef<Message[]>(messages);

  const setMessages: React.Dispatch<React.SetStateAction<Message[]>> =
    React.useCallback((args) => {
      if (typeof args === "function") {
        // args is a function that takes the previous state and returns new state
        messagesRef.current = args(messagesRef.current);
      } else {
        // args is the new state value directly
        messagesRef.current = args;
      }
      _setMessages(messagesRef.current);
    }, []);

  // Helper to update both streamingMessageId state and ref
  const updateStreamingMessageId = React.useCallback((id: string | null) => {
    streamingMessageIdRef.current = id;
    setStreamingMessageId(id);
  }, []);

  // TTS state
  const { settings, updateTtsEnabled, updateSelectedVoice } = useChatSettings();
  const [speakingMessageId, setSpeakingMessageId] = React.useState<
    string | null
  >(null);
  const ttsQueueRef = React.useRef<string[]>([]);
  const isSpeakingRef = React.useRef(false);
  const speechSynthesisRef = React.useRef<SpeechSynthesisUtterance | null>(
    null,
  );
  const ttsBufferRef = React.useRef<string>("");
  const ttsBufferTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const chatInputRef = React.useRef<{ focus: () => void } | null>(null);
  const [showToolManager, setShowToolManager] = React.useState(false);
  const pendingToolCallsRef = React.useRef<ToolCall[] | null>(null);

  // TTS queue processor
  const processTtsQueue = React.useCallback(() => {
    if (
      isSpeakingRef.current ||
      ttsQueueRef.current.length === 0 ||
      !settings.ttsEnabled
    ) {
      return;
    }

    const text = ttsQueueRef.current.shift();
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1; // Slightly faster
    utterance.pitch = 1.0;
    utterance.volume = 0.9;

    // Set selected voice if available
    if (settings.selectedVoice) {
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find((v) => v.voiceURI === settings.selectedVoice);
      if (voice) {
        utterance.voice = voice;
      }
    }

    utterance.onstart = () => {
      isSpeakingRef.current = true;
    };

    utterance.onend = () => {
      isSpeakingRef.current = false;
      processTtsQueue(); // Process next in queue
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
      ttsQueueRef.current = []; // Clear queue on error
    };

    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [settings.ttsEnabled, settings.selectedVoice]);

  // TTS buffer processor - flushes buffer and queues for speech
  const flushTtsBuffer = React.useCallback(() => {
    if (ttsBufferRef.current.trim()) {
      ttsQueueRef.current.push(ttsBufferRef.current.trim());
      ttsBufferRef.current = "";
      processTtsQueue();
    }
    if (ttsBufferTimeoutRef.current) {
      clearTimeout(ttsBufferTimeoutRef.current);
      ttsBufferTimeoutRef.current = null;
    }
  }, [processTtsQueue]);

  // Speak a specific message
  const speakMessage = React.useCallback(
    (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      if (!message || message.role !== "assistant") return;

      // Extract text content
      let textToSpeak = "";
      if (message.reasoning) {
        textToSpeak += "Reasoning: " + message.reasoning + ". ";
      }

      if (typeof message.content === "string") {
        textToSpeak += message.content;
      } else if (Array.isArray(message.content)) {
        textToSpeak += message.content
          .filter((item) => item.type === "text")
          .map((item) => item.text || "")
          .join(" ");
      }

      // Clean up markdown formatting for better speech
      textToSpeak = textToSpeak
        .replace(/```[\s\S]*?```/g, ",,, code block ,,,") // Replace code blocks
        .replace(/`([^`]+)`/g, "$1") // Remove inline code backticks
        .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold
        .replace(/\*([^*]+)\*/g, "$1") // Remove italic
        .replace(/#+\s/g, "") // Remove headers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Convert links to text
        .replace(/\n+/g, ". ") // Convert newlines to periods
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

      if (!textToSpeak) return;

      // Stop any current speech
      window.speechSynthesis.cancel();
      setSpeakingMessageId(messageId);

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.0; // Normal speed for full messages
      utterance.pitch = 1.0;
      utterance.volume = 0.9;

      // Set selected voice if available
      if (settings.selectedVoice) {
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find((v) => v.voiceURI === settings.selectedVoice);
        if (voice) {
          utterance.voice = voice;
        }
      }

      utterance.onend = () => {
        setSpeakingMessageId(null);
      };

      utterance.onerror = () => {
        setSpeakingMessageId(null);
      };

      window.speechSynthesis.speak(utterance);
    },
    [messages, settings.selectedVoice],
  );

  // Toggle speak for a message
  const toggleSpeakMessage = React.useCallback(
    (messageId: string) => {
      if (speakingMessageId === messageId) {
        // Stop speaking
        window.speechSynthesis.cancel();
        setSpeakingMessageId(null);
      } else {
        // Start speaking
        speakMessage(messageId);
      }
    },
    [speakingMessageId, speakMessage],
  );

  // Stop TTS when disabled or component unmounts
  React.useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  React.useEffect(() => {
    if (!settings.ttsEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      ttsQueueRef.current = [];
      ttsBufferRef.current = "";
      isSpeakingRef.current = false;
      if (ttsBufferTimeoutRef.current) {
        clearTimeout(ttsBufferTimeoutRef.current);
        ttsBufferTimeoutRef.current = null;
      }
    }
  }, [settings.ttsEnabled]);

  const scrollNewMessage = React.useCallback(() => {
    // Get all elements with the class and take the last one
    const elements = document.querySelectorAll(".user-message");
    const lastElement = elements[elements.length - 1];
    if (!lastElement) return;
    lastElement.parentElement?.parentElement?.parentElement?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const handleChatSubMessage = React.useCallback(
    (data: any) => {
      function msgUpdate(data: any = {}) {
        //find message
        const msg = messagesRef.current.find((m) => m.id === data.messageId);
        if (!msg) return;
        msg.content = data.content;
        setMessages((prev) => [...prev]);
      }

      function msgDelete(data: any = {}) {
        const msgIndex = messagesRef.current.findIndex(
          (m) => m.id === data.messageId,
        );

        if (msgIndex === -1) return;
        messagesRef.current.splice(msgIndex, 1);
        setMessages((prev) => [...prev]);
      }

      function msgPost(data: any = {}) {
        const lastMessageId = data.lastMessage.id;
        const userMsg = messagesRef.current.find((m) => m.id === lastMessageId);
        if (!userMsg) {
          const newUserMessage = {
            id: lastMessageId,
            content: data.lastMessage.content,
            role: data.lastMessage.role,
            timestamp: data.lastMessage.timestamp,
          };
          setMessages((prev) => [...prev, newUserMessage]);
          setTimeout(scrollNewMessage, 100);
        }

        if (assistantMessage.current === null) {
          const newMessageId = data.messageIdToReplace;
          const existingMessage = messagesRef.current.find(
            (m) => m.id === newMessageId,
          );
          if (existingMessage) {
            existingMessage.content = "";
            existingMessage.reasoning = undefined;
            existingMessage.tool_calls = undefined;
            assistantMessage.current = existingMessage;
            setMessages((prev) => [...prev]);
          } else {
            assistantMessage.current = {
              id: newMessageId,
              content: "",
              role: "assistant",
              model: selectedModel,
              timestamp: Date.now(),
              timeToFinish: 0,
            };
            setMessages((prev) => [
              ...prev,
              assistantMessage.current as Message,
            ]);
          }
          setIsLoading(true);
          updateStreamingMessageId(assistantMessage.current.id);
        }
      }

      async function chatDelete() {
        await AsyncAlert({
          title: "Deleted",
          message: "This chat has been deleted",
        });
        const newChatId = crypto.randomUUID();
        navigate(`/chat/${newChatId}`, { replace: true });
      }

      const handlers = {
        "msg-update": msgUpdate,
        "msg-delete": msgDelete,
        "msg-post": msgPost,
        "chat-delete": chatDelete,
      };

      const msgData = data.data;
      if (!msgData) return;

      const subType: keyof typeof handlers | undefined = msgData.subType;
      if (!subType) return;
      if (!handlers[subType]) return;

      handlers[subType](msgData);
    },
    [selectedModel, navigate, updateStreamingMessageId, scrollNewMessage],
  );

  // Handle tool execution
  const executeToolsAndContinue = React.useCallback(
    async (toolCalls: ToolCall[]) => {
      if (!settings.toolsEnabled || !toolCalls || toolCalls.length === 0) {
        return;
      }

      setIsLoading(true);

      try {
        const hasWebSearch = toolCalls.some(
          (t) => t.function.name === "web_search",
        );

        if (hasWebSearch) {
          if (assistantMessage.current === null) {
            AsyncAlert({
              title: "Error",
              message:
                "There was an issue trying to perform a web search tool call: assistantMessage is null",
            });
            return;
          }

          const messageIndex = messagesRef.current.findIndex(
            (msg) => msg.id === assistantMessage?.current?.id,
          );

          if (messageIndex === -1) {
            console.error({
              hasWebSearch,
              toolCalls,
              messagesRef,
            });
            AsyncAlert({
              title: "Error",
              message:
                "There was an issue trying to perform a web search tool call: Could not find message index",
            });
            return;
          }

          return handleRetry(messageIndex, {
            newModel: assistantMessage.current.model,
            includeWebSearch: true,
            overrideIsLoading: true,
          });
        }
        // Execute tools
        const toolResults = await executeToolCalls(toolCalls, settings.tools);

        // Create tool result messages
        const toolMessages: Message[] = toolResults.map((result) => ({
          id: crypto.randomUUID(),
          role: "tool",
          tool_call_id: result.tool_call_id,
          name: result.name,
          content: result.content,
          timestamp: Date.now(),
        }));

        const currentMsgIdx = messagesRef.current.findIndex(
          (x) => x.id === assistantMessage?.current?.id,
        );

        const messagesUpToRetry = messagesRef.current.slice(
          0,
          currentMsgIdx + 1,
        );
        const msgTime = assistantMessage?.current?.timestamp ?? Date.now();

        toolMessages.forEach((t) => (t.timestamp = msgTime + 10));

        const remainingMessages = messagesRef.current.slice(currentMsgIdx + 1);

        if (assistantMessage.current?.tool_calls?.length === 0) {
          assistantMessage.current.tool_calls = undefined;
        }

        // Send a new request with the tool results
        const requestBody: any = {
          messages: [...messagesUpToRetry, ...toolMessages],
          model: selectedModel,
          overrideAssistantTimestamp: msgTime + 20,
        };

        if (settings.toolsEnabled && settings.tools.length > 0) {
          requestBody.tools = formatToolsForAPI(settings.tools);
        }

        // Create a new assistant message for the final response
        assistantMessage.current = {
          id: crypto.randomUUID(),
          content: "",
          role: "assistant",
          model: selectedModel,
          timestamp: msgTime + 20,
          timeToFinish: 0,
        };

        setMessages([
          ...messagesUpToRetry,
          ...toolMessages,
          assistantMessage.current,
          ...remainingMessages,
        ]);

        updateStreamingMessageId(assistantMessage.current.id);

        post<StreamResponse | Response>(`/chat/${chatId}`, requestBody, {
          resolveImmediately: true,
        });
      } catch (error) {
        console.error("Error executing tools:", error);

        // Show error to user
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unknown error occurred while executing tools";
        AsyncAlert({
          title: "Tool Execution Error",
          message: errorMessage,
        });

        // Reset assistant message state and pending tool calls
        assistantMessage.current = null;
        updateStreamingMessageId(null);
        pendingToolCallsRef.current = null;
      } finally {
        // Always reset loading state, but only if no streaming is happening
        if (!streamingMessageIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [chatId, selectedModel, settings.toolsEnabled, settings.tools, modelsData],
  );

  const wsStream = React.useCallback(
    (data: any) => {
      const messageHasThisChatId =
        data.type &&
        data.headers &&
        data.headers["x-zwc-chat-id"] &&
        data.headers["x-zwc-chat-id"] === chatId;

      if (data instanceof ArrayBuffer) {
        const { header, text } = getHeaderAndText(data);
        if (!header.chatId) return;
        if (header.chatId !== chatId) return;
        const messageId = header.newMessageId;
        const thisMessageIsFromTheOriginSocket =
          header.thisMessageIsFromTheOriginSocket;

        if (assistantMessage.current === null) {
          if (header.offset > 0) {
            if (resettingOffset.current) return;
            resettingOffset.current = true;
            get(`/api/chat/${chatId}`);
            return;
          }

          resettingOffset.current = false;
          setIsLoading(true);
          updateStreamingMessageId(header.newMessageId);
          const newMessageId = header.newMessageId;
          const existingMessage = messagesRef.current.find(
            (m) => m.id === newMessageId,
          );
          if (existingMessage) {
            existingMessage.content = "";
            existingMessage.reasoning = undefined;
            existingMessage.tool_calls = undefined;
            assistantMessage.current = existingMessage;
          } else {
            assistantMessage.current = {
              id: newMessageId,
              content: "",
              role: "assistant",
              model: selectedModel,
              timestamp: Date.now(),
              timeToFinish: 0,
            };
            setMessages((prev) => [
              ...prev,
              assistantMessage.current as Message,
            ]);
          }
        }

        assistantMessage.current.id = messageId;
        assistantMessage.current.timestamp = header.newMessageTimestamp;

        for (const chunk of parseSSEEvents(text, buffer)) {
          if (chunk.type === "data" && assistantMessage.current) {
            if (
              chunk.parsed.error &&
              chunk.parsed.error.metadata &&
              chunk.parsed.error.metadata.raw
            ) {
              const err = JSON.parse(chunk.parsed.error.metadata.raw);
              AsyncAlert({ title: "Error", message: err.error.message });
              setIsLoading(false);
              updateStreamingMessageId(null);
              return;
            }

            handleChunk({
              value: chunk.parsed,
              setMessages,
              assistantMessage: assistantMessage.current,
              onToolCalls: (toolCalls) => {
                // Store tool calls to execute after streaming completes
                pendingToolCallsRef.current = toolCalls;
              },
              onNewContent: (content) => {
                if (settings.ttsEnabled && content) {
                  // Add to buffer
                  ttsBufferRef.current += content;

                  // Clear existing timeout
                  if (ttsBufferTimeoutRef.current) {
                    clearTimeout(ttsBufferTimeoutRef.current);
                  }

                  // Check for natural break points
                  const breakPattern = /([.!?;,\n]+)/;
                  const parts = ttsBufferRef.current.split(breakPattern);

                  // Process complete chunks (everything except possibly the last part)
                  for (let i = 0; i < parts.length - 1; i += 2) {
                    const chunk = parts[i].trim();
                    const punctuation = parts[i + 1] || "";

                    if (chunk) {
                      // Include punctuation for natural pauses
                      ttsQueueRef.current.push(chunk + punctuation);
                    }
                  }

                  // Keep the last part in buffer (might be incomplete)
                  ttsBufferRef.current = parts[parts.length - 1] || "";

                  // Process queue if we have chunks
                  if (ttsQueueRef.current.length > 0) {
                    processTtsQueue();
                  }

                  // Set timeout to flush buffer after 800ms of no new content
                  ttsBufferTimeoutRef.current = setTimeout(() => {
                    flushTtsBuffer();
                  }, 800);
                }
              },
            });
          } else if (chunk.type === "done") {
            setIsLoading(false);
            updateStreamingMessageId(null);

            // Check if we have pending tool calls to execute
            if (pendingToolCallsRef.current && assistantMessage.current) {
              const toolCalls = pendingToolCallsRef.current;
              pendingToolCallsRef.current = null;

              // Execute tools and continue conversation
              if (thisMessageIsFromTheOriginSocket) {
                executeToolsAndContinue(toolCalls);
              }

              return; // Don't do the normal completion stuff
            }

            assistantMessage.current = null;

            // Flush any remaining TTS buffer
            if (settings.ttsEnabled) {
              flushTtsBuffer();
            }

            // Refocus the textarea after streaming completes
            setTimeout(() => {
              chatInputRef.current?.focus();
            }, 100);

            // Generate title for new chats after first response
            if (isNewChat.current) {
              // Fire and forget - don't wait for title generation
              post(`/chat/${chatId}/generate-title`, {})
                .then(() => {
                  // Invalidate chats query to refresh the title
                  setTimeout(() => {
                    queryClient.invalidateQueries({ queryKey: ["chats"] });
                    queryClient.invalidateQueries({ queryKey: ["APIKEYINFO"] });
                  }, 1000);
                })
                .catch((err) =>
                  console.error("Failed to generate title:", err),
                );
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

        if (data.type === "chat-sub-message") {
          return handleChatSubMessage(data);
        }

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
              <>
                <DialogTitleComponent className="mb-4 text-xl font-bold">
                  Error
                </DialogTitleComponent>
                <p className="mb-2">{message}</p>
              </>
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
        updateStreamingMessageId(null);
        isNewChat.current = false;
      }
    },
    [
      chatId,
      handleChatSubMessage,
      selectedModel,
      settings.ttsEnabled,
      updateStreamingMessageId,
      processTtsQueue,
      flushTtsBuffer,
      modelsData,
      executeToolsAndContinue,
    ],
  );

  React.useEffect(() => {
    wsClient.on("message", wsStream);
    return () => {
      wsClient.off("message", wsStream);
    };
  }, [wsStream]);

  // Update messages when initialMessages changes (e.g., when switching chats)
  React.useEffect(() => {
    assistantMessage.current = null;
    setMessages(initialMessages);
    setIsLoading(false);
    updateStreamingMessageId(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "auto",
      block: "end",
    });
  };

  const scrollActiveAssistantMessage = () => {
    // Get all elements with the class and take the last one
    if (assistantMessage.current === null) return;
    const element = document.getElementById(assistantMessage.current.id);
    if (!element) return;
    element.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  };

  React.useEffect(() => {
    setTimeout(() => {
      if (assistantMessage.current === null) {
        scrollToBottom();
      } else {
        scrollActiveAssistantMessage();
      }
    }, 100);
  }, [chatId]);

  const handleSubmit = async (
    input: string,
    attachments: File[],
    includeWebSearch: boolean = false,
  ) => {
    if (isLoading) return;
    if (!input.trim() || isLoading) return;
    const stashMessageLength = messages.length;
    isNewChat.current =
      initialMessages.length === 0 && stashMessageLength === 0;

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
    if (isNewChat.current) {
      queryClient.setQueryData(["chats"], (oldData: any) => {
        if (!oldData) return oldData;

        const placeholderChat = {
          id: chatId,
          title: "Generating...",
          generating: true,
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
    } else {
      queryClient.setQueryData(["chats"], (oldData: ChatListResponse) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          chats: oldData.chats.map((c) =>
            c.id === chatId ? { ...c, generating: true } : { ...c },
          ),
        };
      });
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: content,
      role: "user",
      timestamp: Date.now(),
    };

    // For new chats, add system prompt as the first message if it exists
    if (isNewChat.current && settings.systemPrompt) {
      const systemMessage: Message = {
        id: crypto.randomUUID(),
        content: settings.systemPrompt,
        role: "system",
        timestamp: Date.now(),
      };
      setMessages([systemMessage, userMessage]);
    } else {
      setMessages((prev) => [...prev, userMessage]);
    }
    setIsLoading(true);

    // Include tools if enabled
    const requestBody: any = {
      messages: [...messagesRef.current],
      model: selectedModel,
    };

    if (
      includeWebSearch === false &&
      model?.supported_parameters?.includes("tools") &&
      settings.toolsEnabled &&
      settings.tools.length > 0
    ) {
      requestBody.tools = formatToolsForAPI(settings.tools);
    }

    if (includeWebSearch) {
      requestBody.websearch = true;
    }

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
    updateStreamingMessageId(assistantMessage.current.id);
    setTimeout(scrollNewMessage, 100);

    await post<StreamResponse | Response>(`/chat/${chatId}`, requestBody, {
      resolveImmediately: true,
    });
  };

  const handleRetry = async (
    messageIndex: number,
    opts?: {
      newModel?: string;
      newContentForPreviousMessage?: string;
      includeWebSearch?: boolean;
      overrideIsLoading?: boolean;
    },
  ) => {
    const overrideIsLoading = opts?.overrideIsLoading
      ? opts.overrideIsLoading
      : false;

    if (isLoading && overrideIsLoading === false) return;

    const includeWebSearch = opts?.includeWebSearch
      ? opts.includeWebSearch
      : false;

    // Get the message to retry and ensure it's an assistant message
    assistantMessage.current = messagesRef.current[messageIndex];

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

    queryClient.setQueryData(["chats"], (oldData: ChatListResponse) => {
      if (!oldData) return oldData;

      return {
        ...oldData,
        chats: oldData.chats.map((c) =>
          c.id === chatId ? { ...c, generating: true } : { ...c },
        ),
      };
    });

    assistantMessage.current.tool_calls = undefined;

    // Find all messages up to and including the user message before this assistant message
    const messagesUpToRetry = messagesRef.current.slice(0, messageIndex);
    const prevUserMsg = messagesUpToRetry.at(-1);
    let nextMsg = messagesRef.current[messageIndex + 1];

    // remove tools from the retry
    let lastToolIndex = messageIndex;
    if (nextMsg && nextMsg.role === "tool") {
      lastToolIndex++;
      handleDelete(assistantMessage.current.id, true);
      while (nextMsg.role === "tool") {
        handleDelete(nextMsg.id, true);
        lastToolIndex++;
        nextMsg = messagesRef.current[lastToolIndex];
      }
      assistantMessage.current = nextMsg;
    }

    const remainingMessages = messagesRef.current.slice(lastToolIndex);

    setMessages([...messagesUpToRetry, ...remainingMessages]);

    if (opts?.newContentForPreviousMessage && prevUserMsg)
      prevUserMsg.content = opts?.newContentForPreviousMessage;

    // Update the model if a new one was selected
    const _modelToUse =
      opts?.newModel || selectedModel || assistantMessage.current.model;

    const modelToUse = modelsData
      ? modelsData.all.find((m) => m.id === _modelToUse)
      : null;

    if (!modelToUse) {
      AsyncAlert({ title: "Error", message: "Could not find model" });
      return console.error({ _modelToUse, modelToUse, modelsData });
    }

    setIsLoading(true);

    // Mark this specific message as being regenerated
    updateStreamingMessageId(assistantMessage.current.id);
    assistantMessage.current.model = _modelToUse;

    // Clear the content of the message being retried
    setMessages((prev) =>
      prev.map((msg, idx) =>
        idx === messageIndex
          ? { ...msg, content: "", reasoning: undefined, model: _modelToUse }
          : msg,
      ),
    );

    const retryRequestBody: any = {
      messages: messagesUpToRetry,
      model: _modelToUse,
      messageIdToReplace: assistantMessage.current.id,
    };

    if (
      includeWebSearch === false &&
      modelToUse?.supported_parameters?.includes("tools") &&
      settings.toolsEnabled &&
      settings.tools.length > 0
    ) {
      retryRequestBody.tools = formatToolsForAPI(settings.tools);
    }

    if (includeWebSearch) {
      retryRequestBody.websearch = true;
    }

    await post<StreamResponse | Response>(`/chat/${chatId}`, retryRequestBody, {
      resolveImmediately: true,
    });
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

  const handleDelete = async (messageId: string, force?: boolean) => {
    let ok;
    if (!force) {
      const { ok: _ok } = await AsyncConfirm({
        destructive: true,
        title: "Delete Message",
        message:
          "Are you sure you want to delete this message? This action cannot be undone.",
      });

      if (!_ok) return;
      ok = _ok;
    }

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
    // Find the message to edit
    const messageIndex = messages.findIndex((msg) => msg.id === messageId);
    if (messageIndex === -1) return;

    const originalMessage = messages[messageIndex];
    const isSystem = originalMessage.role === "system";
    const isFirst = messages.length === 1;

    try {
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

      const isLastMessage = messageIndex === messages.length - 1;
      const isUserMessage = originalMessage.role === "user";
      if (isLastMessage && isUserMessage) {
        await handleDelete(messageId, true);
        await handleSubmit(newContent, []);
        return;
      } else {
        // Call API to update message
        await put(`/chat/${chatId}/message/${messageId}`, {
          content: newContent,
        });
      }

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
      // editing the system prompt in a new chat would cause this, and its ok because it will get saved with the first message
      if (isSystem && isFirst) return;
      console.error("Failed to edit message:", error);

      // Revert the optimistic update on error
      setMessages((prev) => [...prev]);

      AsyncAlert({
        title: "Error",
        message: "Failed to edit message. Please try again.",
      });
    }
  };

  const handleSystemPromptEdit = async () => {
    const systemMessage = messages.find((m) => m.role === "system");

    if (systemMessage) {
      // Create a temporary visible message for editing
      const result = await AsyncModal(
        <>
          <DialogTitleComponent className="mb-4 text-xl font-bold">
            Edit System Prompt
          </DialogTitleComponent>
          <DialogDescription className="mb-4">
            Customize the system prompt for this chat:
          </DialogDescription>
          <div className="mb-4">
            <Textarea
              name="content"
              defaultValue={systemMessage.content as string}
              className="min-h-[200px] w-full resize-y"
              placeholder="Enter system prompt..."
              autoFocus
            />
          </div>
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
            content: systemMessage.content as string,
          },
        },
      );

      if (result.ok && result.data.content?.trim()) {
        handleEdit(systemMessage.id, result.data.content.trim(), false);
      }
    } else {
      // Add new system message
      const result = await AsyncModal(
        <>
          <DialogTitleComponent className="mb-4 text-xl font-bold">
            Add System Prompt
          </DialogTitleComponent>
          <DialogDescription className="mb-4">
            Add a system prompt to guide the AI's behavior in this chat:
          </DialogDescription>
          <div className="mb-4">
            <Textarea
              name="content"
              defaultValue={settings.systemPrompt}
              className="min-h-[200px] w-full resize-y"
              placeholder="Enter system prompt..."
              autoFocus
            />
          </div>
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
            content: settings.systemPrompt,
          },
        },
      );

      if (result.ok && result.data.content?.trim()) {
        const newSystemMessage: Message = {
          id: crypto.randomUUID(),
          content: result.data.content.trim(),
          role: "system",
          timestamp: Date.now(),
        };
        setMessages((prev) => [newSystemMessage, ...prev]);
      }
    }
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Messages Area */}
        <div className="@container flex-1 overflow-y-auto pb-32">
          <div className="max-w-[1000px] mx-auto px-4 @max-[560px]:px-1 mt-10 mb-[70vh]">
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
                    onClick={() =>
                      handleSubmit("What can you help me with?", [])
                    }
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
              messages.map((message, index) => {
                if (message.role === "system") return null;

                // Hide tool messages if setting is enabled
                if (message.role === "tool" && settings.hideToolCallMessages) {
                  return null;
                }

                // Handle tool messages
                if (message.role === "tool") {
                  return (
                    <div
                      key={message.id}
                      className="flex prose gap-3 py-3 px-6 bg-muted/30 border-l-4 border-primary/50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Hammer className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">
                            Tool Result: {message.name}
                          </span>
                        </div>
                        <pre>
                          <CodeBlock>
                            {typeof message.content === "string"
                              ? JSON.stringify(
                                  tryParseJson(message.content),
                                  null,
                                  2,
                                )
                              : JSON.stringify(message.content, null, 2)}
                          </CodeBlock>
                        </pre>
                      </div>
                      <MessageDeleteButton
                        messageId={message.id}
                        onDelete={handleDelete}
                      />
                    </div>
                  );
                }

                // Hide assistant messages with tool calls if setting is enabled
                if (
                  message.role === "assistant" &&
                  message.tool_calls &&
                  message.tool_calls.length > 0 &&
                  settings.hideToolCallMessages
                ) {
                  return null;
                }

                return (
                  <div
                    key={message.id}
                    id={message.id}
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
                        message.role === "user"
                          ? "flex flex-col items-end"
                          : "",
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
                                components={markdownComponents}
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
                                        components={markdownComponents}
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
                                  components={markdownComponents}
                                >
                                  {message.reasoning}
                                </ReactMarkdown>
                                <hr />
                              </>
                            ) : null}

                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeHighlight]}
                              components={markdownComponents}
                            >
                              {typeof message.content === "string"
                                ? message.content
                                : "Assistant response"}
                            </ReactMarkdown>

                            {/* Display tool calls if present */}
                            {message.tool_calls &&
                              !message.tool_calls.some((t) =>
                                ["web_search"].includes(t.function.name),
                              ) &&
                              !message.content &&
                              message.tool_calls.length > 0 && (
                                <div className="mt-4 space-y-2">
                                  <div className="flex items-center gap-2 text-sm font-medium">
                                    <Hammer className="h-4 w-4" />
                                    <span>Using tools:</span>
                                  </div>
                                  {message.tool_calls.map((toolCall) => (
                                    <div
                                      key={toolCall.id}
                                      className="bg-muted/50 rounded-lg p-3 text-sm"
                                    >
                                      <div className="font-medium mb-1">
                                        {toolCall.function.name}
                                      </div>
                                      <pre>
                                        <CodeBlock>
                                          {JSON.stringify(
                                            tryParseJson(
                                              toolCall.function.arguments,
                                            ),
                                            null,
                                            2,
                                          )}
                                        </CodeBlock>
                                      </pre>
                                    </div>
                                  ))}
                                </div>
                              )}

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
                                modelsData={modelsData}
                              />
                              <MessageBranchButton
                                messageId={message.id}
                                messageIndex={index}
                                onBranch={handleBranch}
                              />
                              <MessageSpeakButton
                                messageId={message.id}
                                content={message.content}
                                reasoning={message.reasoning}
                                isPlaying={speakingMessageId === message.id}
                                onToggleSpeak={toggleSpeakMessage}
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
                              messages.findIndex(
                                (m, i) =>
                                  i > messages.indexOf(message) &&
                                  m.role === "assistant",
                              ) !== -1
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
                );
              })}

            <div ref={messagesEndRef} className="mt-24" />
          </div>
        </div>

        {/* Modern Chat Input */}
        <ChatInput
          ref={chatInputRef}
          onSubmit={handleSubmit}
          onStop={async () => {
            try {
              const results = await post<{ ok: boolean }>(
                `/api/chat/${chatId}?abort`,
                {},
              );
              if (!results.ok) {
                AsyncAlert({
                  title: "Unable to stop at this time",
                  message: "Sorry, was not able to stop the stream",
                });
                return console.error(results);
              }
              setIsLoading(false);
              updateStreamingMessageId(null);
              assistantMessage.current = null;
            } catch (error) {
              console.error("Failed to abort generation:", error);
            }
          }}
          isLoading={isLoading}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          modelsData={modelsData}
          modelsLoading={modelsLoading}
          modelsError={modelsError}
          apiKeyInfo={apiKeyInfo?.data}
          ttsEnabled={settings.ttsEnabled}
          onTtsToggle={updateTtsEnabled}
          selectedVoice={settings.selectedVoice}
          onVoiceChange={updateSelectedVoice}
          onSystemPromptEdit={handleSystemPromptEdit}
          onToolsClick={() => setShowToolManager(true)}
        />

        {/* Tool Manager Dialog */}
        <ToolManager open={showToolManager} onOpenChange={setShowToolManager} />
      </div>
    </>
  );
}

function handleChunk({
  value,
  setMessages,
  assistantMessage,
  onNewContent,
  onToolCalls,
}: {
  value: any;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  assistantMessage: Message;
  onNewContent?: (content: string) => void;
  onToolCalls?: (toolCalls: ToolCall[]) => void;
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

  const choice = value?.choices?.[0];
  const delta = choice?.delta;

  if (!delta) {
    console.error("delta is not defined", value);
    return;
  }

  // Handle regular content
  if (delta.content || delta.reasoning) {
    const msgKey = delta.reasoning ? "reasoning" : "content";
    const newContent = delta[msgKey] || "";

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMessage.id
          ? {
              ...msg,
              tool_calls: undefined, //tool calls and content are mutually exclusive
              [msgKey]: (msg[msgKey] ?? "") + newContent,
            }
          : msg,
      ),
    );

    // Notify about new content for TTS
    if (newContent && onNewContent) {
      onNewContent(newContent);
    }
  }

  if (delta.annotations) {
    assistantMessage.annotations = delta.annotations;
  }

  // Handle tool calls streaming
  if (delta.tool_calls) {
    // Initialize tool_calls array if needed
    assistantMessage.tool_calls = assistantMessage.tool_calls ?? [];

    // Process each tool call delta
    for (const toolCallDelta of delta.tool_calls) {
      const index = toolCallDelta.index;

      // Initialize tool call if it's the first chunk for this index
      if (!assistantMessage.tool_calls[index]) {
        assistantMessage.tool_calls[index] = {
          id: toolCallDelta.id || "",
          type: toolCallDelta.type || "function",
          function: {
            name: toolCallDelta.function?.name || "",
            arguments: "",
          },
        };
      }

      // Update tool call data
      if (toolCallDelta.id) {
        assistantMessage.tool_calls[index].id = toolCallDelta.id;
      }
      if (toolCallDelta.function?.name) {
        assistantMessage.tool_calls[index].function.name =
          toolCallDelta.function.name;
      }
      if (toolCallDelta.function?.arguments) {
        assistantMessage.tool_calls[index].function.arguments +=
          toolCallDelta.function.arguments;
      }
    }

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== assistantMessage.id) return msg;

        // Update the assistantMessage reference with the tool calls
        return { ...msg, tool_calls: assistantMessage.tool_calls };
      }),
    );
  }

  // Check for finish reason
  if (choice?.finish_reason === "tool_calls") {
    // Tool calls are complete - notify the callback
    if (
      assistantMessage.tool_calls &&
      assistantMessage.tool_calls.length > 0 &&
      onToolCalls
    ) {
      onToolCalls(assistantMessage.tool_calls);
    }
  }

  setMessages((prev) =>
    prev.map((msg) =>
      msg.id === assistantMessage.id
        ? { ...msg, timeToFinish: Date.now() - msg.timestamp }
        : msg,
    ),
  );
}
