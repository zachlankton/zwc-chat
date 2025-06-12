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
  SidebarTrigger,
} from "~/components/ui/sidebar";

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
  const [titleText, setTitleText] = React.useState(
    isCollapsed ? "ZWC" : "ZWC Chat",
  );
  const isMobile = sb.isMobile;
  const [titleFading, setTitleFading] = React.useState(false);

  const handleChatSelect = (chatId: string) => {
    navigate(`/chat/${chatId}`);
  };

  const handleNewChat = () => {
    if (onNewChat) {
      onNewChat();
    } else {
      // Generate a new chat ID and navigate
      const newChatId = crypto.randomUUID();
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
        setTitleFading(false);
      }, 250);
      const timer = setTimeout(() => setHideElements(true), 300);
      return () => {
        clearTimeout(timer);
        clearTimeout(textTimer);
      };
    }
  }, [isCollapsed]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className={`border-b border-sidebar-border px-0`}>
        <div className="flex items-center justify-between px-2 py-1 overflow-hidden">
          <SidebarTrigger className="" />

          <h2
            className={`${isCollapsed ? "text-xs" : "text-xl min-w-[238px]"} ml-12 h-6 w-full font-semibold transition-all duration-100 ${
              titleFading ? "opacity-0" : "opacity-100"
            }`}
          >
            {titleText}
          </h2>
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
