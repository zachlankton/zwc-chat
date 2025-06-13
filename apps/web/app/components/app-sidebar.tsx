import * as React from "react";

import { NavUser } from "~/components/nav-user";
import { ChatList } from "~/components/chat-list";
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
