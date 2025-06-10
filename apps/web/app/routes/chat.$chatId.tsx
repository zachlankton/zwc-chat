import { useParams } from "react-router";
import { ChatInterface } from "~/components/chat-interface";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get } from "~/lib/fetchWrapper";
import { useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: string;
  timestamp: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  timeToFirstToken?: number;
  timeToFinish?: number;
}

interface ChatResponse {
  chatId: string;
  messages: Message[];
  hasMore: boolean;
}

export default function ChatRoute() {
  const { chatId } = useParams();

  // Fetch chat history
  const { data, isLoading, error } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: async () => {
      const response = await get<Response>(`/api/chat/${chatId}`, {
        returnResponse: true,
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Chat doesn't exist yet, return empty
          return { chatId, messages: [], hasMore: false };
        }
        throw new Error("Failed to fetch chat");
      }
      return response.json() as Promise<ChatResponse>;
    },
    enabled: !!chatId,
  });

  console.log(!!chatId, chatId, data, error);

  const queryClient = useQueryClient();

  // Update chat list when we navigate to a new chat
  useEffect(() => {
    // Invalidate the chats list to refresh it
    if (chatId) {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
    }
  }, [chatId]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">Failed to load chat</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading chat...</p>
      </div>
    );
  }

  return (
    <ChatInterface chatId={chatId} initialMessages={data?.messages || []} />
  );
}
