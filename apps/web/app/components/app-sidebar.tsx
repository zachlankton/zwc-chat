import * as React from "react";
import {
  MessageSquare,
  Plus,
  Clock,
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
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between px-4 py-4">
          <h2 className="text-xl font-semibold">ZWC Chat</h2>
        </div>
        <div className="px-4">
          <Button className="w-full justify-start gap-3 h-10" variant="default">
            <Plus className="h-5 w-5" />
            <span className="text-sm font-medium">New Chat</span>
          </Button>
        </div>
        <SidebarGroup className="pb-0">
          <SidebarGroupLabel className="flex items-center justify-between px-2 h-4 text-sm">
            <span>Recent Chats</span>
            <Search className="h-2 w-2 text-muted-foreground" />
          </SidebarGroupLabel>
        </SidebarGroup>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-2">
          <SidebarGroupContent>
            <SidebarMenu className="">
              {chatHistory.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton
                    asChild
                    className="group relative w-full justify-start h-auto px-3 hover:bg-sidebar-accent"
                  >
                    <a href={`#${chat.id}`} className="flex items-start w-full">
                      <MessageSquare className="h-4 w-4 shrink-0 mt-1" />
                      <div className="flex-1 overflow-hidden ml-3 mr-8">
                        <div className="flex items-start justify-between">
                          <span className="truncate font-medium text-sm block pr-2">
                            {chat.title}
                          </span>
                          {chat.isStarred && (
                            <Star className="h-3 w-3 fill-current text-yellow-500 shrink-0" />
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground mb-1">
                          {chat.preview}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {chat.timestamp}
                        </p>
                      </div>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </div>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarGroup className="px-2 mt-auto">
          <SidebarGroupLabel className="px-2 text-sm">
            <span>Collections</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="">
              <SidebarMenuItem>
                <SidebarMenuButton className="px-3 gap-3">
                  <Star className="h-4 w-4" />
                  <span className="text-sm">Starred</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="px-3 gap-3">
                  <Archive className="h-4 w-4" />
                  <span className="text-sm">Archived</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="px-3 gap-3">
                  <Trash2 className="h-4 w-4" />
                  <span className="text-sm">Trash</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
