import type { ToolCall } from "~/types/tools";

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

export interface Message {
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
  stoppedByUser?: boolean;
  // Tool-related fields
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string; // Tool name for tool messages
  annotations?: any;
}

export interface ChatInterfaceProps {
  chatId: string;
  initialMessages: Message[];
}

export type HandleRetry = (
  messageIndex: number,
  opts?: {
    newModel?: string;
    newContentForPreviousMessage?: string;
    includeWebSearch?: boolean;
    overrideIsLoading?: boolean;
  },
) => Promise<void>;

export interface Chat {
  id: string;
  title: string;
  lastMessage?: string;
  updatedAt: string;
  messageCount: number;
  pinnedAt?: string | null;
  generating?: boolean;
}

export interface ChatListProps {
  currentChatId?: string;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
  data?: ChatListResponse;
  isLoading: boolean;
  error: any;
}

export interface ChatListResponse {
  chats: Chat[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiKeyInfo {
  label: string;
  limit: number | null;
  usage: number;
  is_provisioning_key: boolean;
  limit_remaining: number;
  is_free_tier: boolean;
  rate_limit: {
    requests: number;
    interval: string;
  };
}
