import * as React from "react";
import {
  Plus,
  Star,
  Archive,
  Trash2,
  MoreHorizontal,
  Search,
} from "lucide-react";

import { NavUser } from "~/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "~/components/ui/sidebar";
import { Button } from "~/components/ui/button";

// Mock chat history data
const chatHistory = [
  {
    id: "1",
    title: "Help with React hooks",
    timestamp: "2 hours ago",
    preview: "Can you explain how useEffect works...",
    isStarred: true,
  },
  {
    id: "2",
    title: "Python data analysis",
    timestamp: "Yesterday",
    preview: "I need to analyze this CSV file...",
    isStarred: false,
  },
  {
    id: "3",
    title: "Database optimization",
    timestamp: "2 days ago",
    preview: "My queries are running slow...",
    isStarred: false,
  },
  {
    id: "4",
    title: "API design best practices",
    timestamp: "3 days ago",
    preview: "What's the best way to structure...",
    isStarred: true,
  },
  {
    id: "5",
    title: "Docker configuration",
    timestamp: "Last week",
    preview: "I'm having trouble with my Dockerfile...",
    isStarred: false,
  },
  {
    id: "1",
    title: "Help with React hooks",
    timestamp: "2 hours ago",
    preview: "Can you explain how useEffect works...",
    isStarred: true,
  },
  {
    id: "2",
    title: "Python data analysis",
    timestamp: "Yesterday",
    preview: "I need to analyze this CSV file...",
    isStarred: false,
  },
  {
    id: "3",
    title: "Database optimization",
    timestamp: "2 days ago",
    preview: "My queries are running slow...",
    isStarred: false,
  },
  {
    id: "4",
    title: "API design best practices",
    timestamp: "3 days ago",
    preview: "What's the best way to structure...",
    isStarred: true,
  },
  {
    id: "5",
    title: "Docker configuration",
    timestamp: "Last week",
    preview: "I'm having trouble with my Dockerfile...",
    isStarred: false,
  },
  {
    id: "1",
    title: "Help with React hooks",
    timestamp: "2 hours ago",
    preview: "Can you explain how useEffect works...",
    isStarred: true,
  },
  {
    id: "2",
    title: "Python data analysis",
    timestamp: "Yesterday",
    preview: "I need to analyze this CSV file...",
    isStarred: false,
  },
  {
    id: "3",
    title: "Database optimization",
    timestamp: "2 days ago",
    preview: "My queries are running slow...",
    isStarred: false,
  },
  {
    id: "4",
    title: "API design best practices",
    timestamp: "3 days ago",
    preview: "What's the best way to structure...",
    isStarred: true,
  },
  {
    id: "5",
    title: "Docker configuration",
    timestamp: "Last week",
    preview: "I'm having trouble with my Dockerfile...",
    isStarred: false,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const sb = useSidebar();
  const isCollapsed = sb.state === "collapsed";
  const [showContent, setShowContent] = React.useState(!isCollapsed);
  const [hideElements, setHideElements] = React.useState(isCollapsed);
  const [titleText, setTitleText] = React.useState(
    isCollapsed ? "ZWC" : "ZWC Chat",
  );
  const [titleFading, setTitleFading] = React.useState(false);

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
        setTitleText("ZWC");
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
        <div className="flex items-center justify-between px-2 py-4 overflow-hidden">
          <h2
            className={`${isCollapsed ? "text-xs" : "text-xl min-w-[238px]"} h-6 w-full text-center font-semibold transition-all duration-100 ${
              titleFading ? "opacity-0" : "opacity-100"
            }`}
          >
            {titleText}
          </h2>
        </div>
        <div className={`px-2`}>
          <Button
            className={`w-full justify-start h-10 has-[>svg]:px-2`}
            variant="default"
          >
            <Plus className="h-4 w-4 px-0" />
            <span
              className={`text-sm font-medium transition-opacity duration-300 ${
                showContent ? "opacity-100" : "opacity-0"
              }`}
            >
              {showContent && "New Chat"}
            </span>
          </Button>
        </div>
        <SidebarGroup className="pb-0">
          {isCollapsed ? (
            <Search className="h-8 w-8 text-muted-foreground" />
          ) : (
            <SidebarGroupLabel
              className={`flex items-center overflow-hidden justify-between px-2 h-4 text-sm transition-opacity duration-300 ${
                showContent ? "opacity-100" : "opacity-0"
              }`}
            >
              <span className="min-w-[206px]">Recent Chats</span>
              <Search className="h-2 w-2 text-muted-foreground" />
            </SidebarGroupLabel>
          )}
        </SidebarGroup>
      </SidebarHeader>

      <SidebarContent>
        {!hideElements && (
          <div
            className={`transition-opacity duration-300 ${
              showContent ? "opacity-100" : "opacity-0"
            }`}
          >
            <SidebarGroup className="px-2">
              <SidebarGroupContent>
                <SidebarMenu className="">
                  {chatHistory.map((chat) => (
                    <SidebarMenuItem key={chat.id}>
                      <SidebarMenuButton
                        asChild
                        className="group relative w-full justify-start h-auto px-3 py-0 hover:bg-sidebar-accent"
                      >
                        <a
                          href={`#${chat.id}`}
                          className="flex items-start w-full"
                        >
                          <div className="flex-1 overflow-hidden">
                            <div className="flex items-start justify-between">
                              <span className="truncate font-medium text-sm block pr-2">
                                {chat.title}
                              </span>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {chat.preview}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {chat.timestamp}
                            </p>
                          </div>
                          <div className="flex-1 max-w-2 opacity-0 transition-opacity group-hover:opacity-100">
                            {chat.isStarred ? (
                              <Star className="mt-2 h-4 w-4 fill-current text-yellow-500 shrink-0" />
                            ) : (
                              <Star className="mt-2 h-4 w-4 text-gray-500 shrink-0" />
                            )}
                            <MoreHorizontal className="mt-2 h-4 w-4" />
                          </div>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t">
        {!hideElements && (
          <div
            className={`transition-opacity duration-300 ${
              showContent ? "opacity-100" : "opacity-0"
            }`}
          >
            <SidebarGroup className="px-2 mt-auto">
              <SidebarGroupLabel className="px-2 text-sm">
                <span>Collections</span>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="">
                  <SidebarMenuItem className="h-6">
                    <SidebarMenuButton className="px-3 gap-3 py-0">
                      <Star className="h-4 w-4" />
                      <span className="text-sm">Starred</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem className="h-6">
                    <SidebarMenuButton className="px-3 gap-3">
                      <Archive className="h-4 w-4" />
                      <span className="text-sm">Archived</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem className="h-6">
                    <SidebarMenuButton className="px-3 gap-3">
                      <Trash2 className="h-4 w-4" />
                      <span className="text-sm">Trash</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        )}
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
