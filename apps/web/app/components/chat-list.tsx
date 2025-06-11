import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, fetchWrapper, get, put } from "../lib/fetchWrapper";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { useNavigate } from "react-router";
import { AsyncConfirm } from "./async-modals";
import { useState } from "react";

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
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

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

  // Update chat title mutation
  const updateChatMutation = useMutation({
    mutationFn: async ({ chatId, title }: { chatId: string; title: string }) => {
      const response = await put<Response>(`/api/chat/${chatId}`, 
        { title }, 
        { returnResponse: true }
      );
      if (!response.ok) throw new Error("Failed to update chat");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      setEditingChatId(null);
    },
  });

  const handleEditStart = (chatId: string, currentTitle: string) => {
    setEditingChatId(chatId);
    setEditTitle(currentTitle);
  };

  const handleEditSave = (chatId: string) => {
    if (editTitle.trim() && editTitle.trim() !== "") {
      updateChatMutation.mutate({ chatId, title: editTitle.trim() });
    } else {
      setEditingChatId(null);
    }
  };

  const handleEditCancel = () => {
    setEditingChatId(null);
    setEditTitle("");
  };

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
                    {editingChatId === chat.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleEditSave(chat.id);
                            } else if (e.key === "Escape") {
                              handleEditCancel();
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-2 py-1 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditSave(chat.id);
                          }}
                          className="h-6 w-6 p-0"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCancel();
                          }}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <h4 className="text-sm font-medium truncate">
                          {chat.title}
                        </h4>
                        {chat.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {chat.lastMessage}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {editingChatId !== chat.id && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditStart(chat.id, chat.title);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
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
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
