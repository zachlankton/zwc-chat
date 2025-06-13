import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  PaintBucket,
  Settings,
  Sparkles,
  Keyboard,
  Volume2,
  VolumeX,
  Check,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "~/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";
import { post } from "~/lib/fetchWrapper";
import { useTheme } from "~/providers/theme-provider";
import { useSession } from "~/stores/session";
import { useChatSettings } from "~/stores/chat-settings";

export function NavUser() {
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const session = useSession();
  const sessionUser = session
    ? { name: session.name, email: session.email, avatar: session.imgSrc }
    : { name: "", email: "", avatar: "" };

  // Settings state
  const { settings, updateEnterToSend, updateTtsEnabled, updateSelectedVoice } = useChatSettings();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage
                  src={sessionUser.avatar ?? ""}
                  alt={sessionUser.name ?? ""}
                />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{sessionUser.name}</span>
                <span className="truncate text-xs">{sessionUser.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <PaintBucket />
                  Theme
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => setTheme("light")}
                      className="gap-2"
                    >
                      <span className="flex-1">Light</span>
                      {theme === "light" && <Check className="h-3 w-3" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme("dark")}
                      className="gap-2"
                    >
                      <span className="flex-1">Dark</span>
                      {theme === "dark" && <Check className="h-3 w-3" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme("system")}
                      className="gap-2"
                    >
                      <span className="flex-1">System</span>
                      {theme === "system" && <Check className="h-3 w-3" />}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuCheckboxItem
                checked={settings.enterToSend}
                onCheckedChange={updateEnterToSend}
              >
                <Keyboard className="mr-2 h-4 w-4" />
                Enter to send
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={settings.ttsEnabled}
                onCheckedChange={updateTtsEnabled}
              >
                {settings.ttsEnabled ? (
                  <Volume2 className="mr-2 h-4 w-4" />
                ) : (
                  <VolumeX className="mr-2 h-4 w-4" />
                )}
                Text-to-speech
              </DropdownMenuCheckboxItem>
              {settings.availableVoices.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Volume2 className="mr-2 h-4 w-4" />
                    Voice
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent
                      sideOffset={-120}
                      className="max-h-80 overflow-y-auto"
                    >
                      {settings.availableVoices.map((voice) => (
                        <DropdownMenuItem
                          key={voice.voiceURI}
                          onClick={() => updateSelectedVoice(voice.voiceURI)}
                          className="gap-2"
                        >
                          <span className="flex-1">
                            {voice.name?.slice(0, 10)}
                          </span>
                          {settings.selectedVoice === voice.voiceURI && (
                            <Check className="h-3 w-3" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                const results = await post<{ logOutUrl: string }>(
                  "/auth/logout",
                  {},
                );
                location.assign(results.logOutUrl);
              }}
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
