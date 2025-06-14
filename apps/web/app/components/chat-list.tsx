import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, put } from "../lib/fetchWrapper";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Trash2, Pencil, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router";
import { AsyncConfirm, AsyncPrompt } from "./async-modals";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";

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

export function ChatList({ currentChatId, onChatSelect }: ChatListProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch user's chats
  const { data, isLoading, error } = useQuery({
    queryKey: ["chats"],
    queryFn: async () => get<ChatListResponse>("/api/chat"),
  });

  // Delete chat mutation
  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const response = await del<Response>(`/api/chat/${chatId}`);
      return response;
    },
    onSuccess: (_, deletedChatId) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      // If we deleted the current chat, navigate to home
      if (deletedChatId === currentChatId) {
        navigate("/");
      }
    },
  });

  // Update chat title mutation
  const updateChatMutation = useMutation({
    mutationFn: async ({
      chatId,
      title,
    }: {
      chatId: string;
      title: string;
    }) => {
      const response = await put<Response>(`/api/chat/${chatId}`, { title });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const handleRenameChat = async (chatId: string, currentTitle: string) => {
    const result = await AsyncPrompt({
      title: "Rename Chat",
      message: "Enter a new name for this chat:",
      defaultValue: currentTitle,
      confirmBtnText: "Save",
      cancelBtnText: "Cancel",
    });

    if (result.ok && result.data.results.trim()) {
      updateChatMutation.mutate({ chatId, title: result.data.results.trim() });
    }
  };

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">Failed to load chats</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
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
                  "group relative rounded-lg pl-2 mb-1 hover:bg-muted cursor-pointer transition-colors",
                  currentChatId === chat.id && "bg-muted ring ring-primary",
                )}
                onClick={() => onChatSelect(chat.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium truncate">
                      {chat.title}
                    </h4>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={async (e) => {
                          e.stopPropagation();
                          await handleRenameChat(chat.id, chat.title);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const { ok } = await AsyncConfirm({
                            destructive: true,
                            title: "Delete Chat",
                            message:
                              "Are you sure you want to delete this chat?",
                          });

                          if (ok) deleteChatMutation.mutate(chat.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
