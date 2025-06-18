import * as React from "react";

import { NavUser } from "~/components/nav-user";
import { ChatList, type ChatListResponse } from "~/components/chat-list";
import { useNavigate, useParams } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "~/components/ui/sidebar";
import { Menu } from "lucide-react";
import { Button } from "./ui/button";
import { get, wsClient } from "~/lib/fetchWrapper";
import { queryClient } from "~/providers/queryClient";
import { useQuery } from "@tanstack/react-query";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  onNewChat?: () => void;
}

export function AppSidebar({ onNewChat, ...props }: AppSidebarProps) {
  const sb = useSidebar();
  const navigate = useNavigate();
  const params = useParams();
  const currentChatId = params.chatId;
  const isCollapsed = sb.state === "collapsed";
  const [showContent, setShowContent] = React.useState(!isCollapsed);
  const [hideElements, setHideElements] = React.useState(isCollapsed);
  const [newText, setNewText] = React.useState(isCollapsed ? "+" : "New Chat");
  const [titleText, setTitleText] = React.useState(
    isCollapsed ? "ZWC" : "ZWC Chat",
  );
  const isMobile = sb.isMobile;
  const toggleSidebar = sb.toggleSidebar;

  const [titleFading, setTitleFading] = React.useState(false);

  // Fetch user's chats
  const { data, isLoading, error } = useQuery({
    queryKey: ["chats"],
    queryFn: async () => get<ChatListResponse>("/api/chat"),
  });

  const handleChatSelect = (chatId: string) => {
    if (isMobile) toggleSidebar();
    navigate(`/chat/${chatId}`);
  };

  const handleNewChat = () => {
    if (onNewChat) {
      onNewChat();
    } else {
      // Generate a new chat ID and navigate
      const newChatId = crypto.randomUUID();
      if (isMobile) toggleSidebar();
      navigate(`/chat/${newChatId}`);
    }
  };

  React.useEffect(() => {
    if (!isCollapsed) {
      // When expanding: show elements immediately, fade in content after delay
      setHideElements(false);
      setTitleFading(true);
      const textTimer = setTimeout(() => {
        setTitleText("ZWC Chat");
        setNewText("New Chat");
        setTitleFading(false);
      }, 250);
      const timer = setTimeout(() => setShowContent(true), 150);
      return () => {
        clearTimeout(timer);
        clearTimeout(textTimer);
      };
    } else {
      // When collapsing: fade out content first, then hide elements
      setShowContent(false);
      setTitleFading(true);
      const textTimer = setTimeout(() => {
        setTitleText("");
        setNewText("+");
        setTitleFading(false);
      }, 0);
      const timer = setTimeout(() => setHideElements(true), 300);
      return () => {
        clearTimeout(timer);
        clearTimeout(textTimer);
      };
    }
  }, [isCollapsed]);

  const handleChatSubMessage = React.useCallback((data: any) => {
    // TODO: handle each message surgically instead of invalidating, just doing this for now to get across the finish line
    function msgPost(data: any) {
      console.log(data);
      const chatId = data.headers["x-zwc-chat-id"];
      queryClient.setQueryData(["chats"], (oldData: ChatListResponse) => {
        if (!oldData) return oldData;
        const chat = oldData.chats.find((c) => c.id === chatId);
        const content = data.data?.lastMessage?.content ?? "Assistant response";

        if (!chat) {
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
        } else {
          return {
            ...oldData,
            chats: oldData.chats.map((c) =>
              c.id === chatId ? { ...c, generating: true } : { ...c },
            ),
          };
        }
      });
    }

    function chatUpdate(_data: any) {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    }

    function chatDelete(_data: any) {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    }

    function chatStreamFinished(data: any) {
      queryClient.invalidateQueries({
        queryKey: ["chat", data.headers["x-zwc-chat-id"]],
      });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    }

    function chatTitleGenerated(_data: any) {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    }

    const handlers = {
      "msg-post": msgPost,
      "chat-title-generated": chatTitleGenerated,
      "chat-update": chatUpdate,
      "chat-delete": chatDelete,
      "chat-stream-finished": chatStreamFinished,
    };

    const msgData = data.data;
    if (!msgData) return;

    const subType: keyof typeof handlers | undefined = msgData.subType;
    if (!subType) return;
    if (!handlers[subType]) return;

    handlers[subType](data);
  }, []);

  const wsMsg = React.useCallback((data: any) => {
    if (data.type === "chat-sub-message") handleChatSubMessage(data);
  }, []);

  React.useEffect(() => {
    wsClient.on("message", wsMsg);
    return () => {
      wsClient.off("message", wsMsg);
    };
  }, [wsMsg]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className={` px-0`}>
        <div className="flex items-center justify-between px-2 py-1 overflow-hidden">
          <Button
            data-sidebar="trigger"
            data-slot="sidebar-trigger"
            variant="ghost"
            size="lg"
            className={"size-8"}
            onClick={() => toggleSidebar()}
          >
            <Menu className="size-8 text-foreground" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>

          <h2
            className={`${isCollapsed && !isMobile ? "text-xs" : "text-xl min-w-[238px]"} ml-12 h-6 w-full font-semibold transition-all duration-100 ${
              titleFading ? "opacity-0" : "opacity-100"
            }`}
          >
            {isMobile ? "ZWC Chat" : titleText}
          </h2>
        </div>
        <div className="p-1">
          <button
            onClick={handleNewChat}
            className="button-87 flex py-2 gap-2 w-full"
          >
            {isMobile ? "New Chat" : newText}
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-0">
        {hideElements && !isMobile ? null : (
          <div
            className={`transition-opacity duration-300 h-full ${
              showContent || isMobile ? "opacity-100" : "opacity-0"
            }`}
          >
            <ChatList
              currentChatId={currentChatId}
              onChatSelect={handleChatSelect}
              onNewChat={handleNewChat}
              data={data}
              isLoading={isLoading}
              error={error}
            />
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
