import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, fetchWrapper, get } from "../lib/fetchWrapper";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Trash2, Plus } from "lucide-react";
import { useNavigate } from "react-router";
import { AsyncConfirm } from "./async-modals";

interface Chat {
  id: string;
  title: string;
  lastMessage?: string;
  updatedAt: string;
  messageCount: number;
}

interface ChatListResponse {
  chats: Chat[];
  total: number;
  limit: number;
  offset: number;
}

interface ChatListProps {
  currentChatId?: string;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
}

export function ChatList({
  currentChatId,
  onChatSelect,
  onNewChat,
}: ChatListProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch user's chats
  const { data, isLoading, error } = useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const response = await get<Response>("/api/chat", {
        returnResponse: true,
      });
      if (!response.ok) throw new Error("Failed to fetch chats");
      return response.json() as Promise<ChatListResponse>;
    },
  });

  // Delete chat mutation
  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const response = await del<Response>(`/api/chat/${chatId}`, {
        returnResponse: true,
      });
      if (!response.ok) throw new Error("Failed to delete chat");
      return response.json();
    },
    onSuccess: (_, deletedChatId) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      // If we deleted the current chat, navigate to home
      if (deletedChatId === currentChatId) {
        navigate("/");
      }
    },
  });

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">Failed to load chats</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2"
          variant="default"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">
            Loading chats...
          </div>
        ) : data?.chats.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No chats yet. Start a new conversation!
          </div>
        ) : (
          <div className="p-2">
            {data?.chats.map((chat) => (
              <div
                key={chat.id}
                className={cn(
                  "group relative rounded-lg p-3 hover:bg-muted cursor-pointer transition-colors",
                  currentChatId === chat.id && "bg-muted",
                )}
                onClick={() => onChatSelect(chat.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium truncate">
                      {chat.title}
                    </h4>
                    {chat.lastMessage && (
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {chat.lastMessage}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const { ok } = await AsyncConfirm({
                        destructive: true,
                        title: "Delete Chat",
                        message: "Are you sure you want to delete this chat?",
                      });

                      if (ok) deleteChatMutation.mutate(chat.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
