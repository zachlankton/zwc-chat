import {
  ChevronsUpDown,
  LogOut,
  PaintBucket,
  Keyboard,
  Volume2,
  VolumeX,
  Check,
  FileText,
  Key,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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
import { useApiKeyInfo } from "~/stores/session";
import { useChatSettings, defaultSystemPrompt } from "~/stores/chat-settings";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { startOpenRouterOAuth } from "~/lib/openrouter-pkce";

export function NavUser() {
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const session = useSession();
  const apiKeyInfo = useApiKeyInfo();
  const sessionUser = session
    ? { name: session.name, email: session.email, avatar: session.imgSrc }
    : { name: "", email: "", avatar: "" };

  // Settings state
  const {
    chatSettings,
    updateEnterToSend,
    updateTtsEnabled,
    updateSelectedVoice,
    updateSystemPrompt,
  } = useChatSettings();
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);
  const [tempSystemPrompt, setTempSystemPrompt] = useState(
    chatSettings.systemPrompt,
  );
  const [isLoadingOAuth, setIsLoadingOAuth] = useState(false);

  const hasOwnKey = apiKeyInfo?.hasOwnOpenRouterKey ?? false;

  return (
    <>
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
                  <span className="truncate font-medium">
                    {sessionUser.name}
                  </span>
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
              <DropdownMenuItem
                onClick={() => {
                  setTempSystemPrompt(chatSettings.systemPrompt);
                  setSystemPromptOpen(true);
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                System prompt
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isLoadingOAuth}
                onClick={async () => {
                  if (isLoadingOAuth) return;

                  setIsLoadingOAuth(true);
                  try {
                    // Start OAuth flow
                    const authUrl = await startOpenRouterOAuth();
                    window.location.href = authUrl;
                  } catch (error) {
                    console.error("Failed to start OAuth flow:", error);
                    setIsLoadingOAuth(false);
                  }
                }}
              >
                <Key className="mr-2 h-4 w-4" />
                {isLoadingOAuth
                  ? "Loading..."
                  : hasOwnKey
                    ? "Replace OpenRouter Key"
                    : "Use Your Own Key"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuCheckboxItem
                  checked={chatSettings.enterToSend}
                  onCheckedChange={updateEnterToSend}
                >
                  <Keyboard className="mr-2 h-4 w-4" />
                  Enter to send
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={chatSettings.ttsEnabled}
                  onCheckedChange={updateTtsEnabled}
                >
                  {chatSettings.ttsEnabled ? (
                    <Volume2 className="mr-2 h-4 w-4" />
                  ) : (
                    <VolumeX className="mr-2 h-4 w-4" />
                  )}
                  Text-to-speech
                </DropdownMenuCheckboxItem>
                {chatSettings.availableVoices.length > 0 && (
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
                        {chatSettings.availableVoices.map((voice) => (
                          <DropdownMenuItem
                            key={voice.voiceURI}
                            onClick={() => updateSelectedVoice(voice.voiceURI)}
                            className="gap-2"
                          >
                            <span className="flex-1">
                              {voice.name?.slice(0, 10)}
                            </span>
                            {chatSettings.selectedVoice === voice.voiceURI && (
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

      <Dialog open={systemPromptOpen} onOpenChange={setSystemPromptOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>System Prompt</DialogTitle>
            <DialogDescription>
              Customize the system prompt that guides the AI's behavior and
              responses
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              value={tempSystemPrompt}
              onChange={(e) => setTempSystemPrompt(e.target.value)}
              placeholder="Enter your system prompt..."
              className="min-h-[200px] resize-y"
            />
            <p className="text-sm text-muted-foreground">
              This prompt will be sent with every new conversation to help guide
              the AI's responses. But don't worry, you can customize this per
              chat as well, just use the System Prompt Button under the Chat
              Input
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTempSystemPrompt(defaultSystemPrompt);
              }}
            >
              Reset to Default
            </Button>
            <Button
              onClick={() => {
                updateSystemPrompt(tempSystemPrompt);
                setSystemPromptOpen(false);
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
