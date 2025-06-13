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
import { useState, useEffect } from "react";

export function NavUser() {
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const session = useSession();
  const sessionUser = session
    ? { name: session.name, email: session.email, avatar: session.imgSrc }
    : { name: "", email: "", avatar: "" };

  // Settings state
  const [enterToSend, setEnterToSend] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);

  // Load settings from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Load enter key preference
      const savedEnter = localStorage.getItem("enterToSend");
      if (savedEnter !== null) {
        setEnterToSend(savedEnter === "true");
      }

      // Load TTS preference
      const savedTts = localStorage.getItem("ttsEnabled");
      if (savedTts !== null) {
        setTtsEnabled(savedTts === "true");
      }

      // Load voice preference
      const savedVoice = localStorage.getItem("ttsVoice");
      if (savedVoice) {
        setSelectedVoice(savedVoice);
      }

      // Load available voices
      const loadVoices = () => {
        const allVoices = window.speechSynthesis.getVoices();
        const userLocale = navigator.language || "en-US";
        const userLang = userLocale.split("-")[0];

        const localVoices = allVoices.filter((voice) => {
          const voiceLang = voice.lang.split("-")[0];
          return (
            voice.localService &&
            (voice.lang.startsWith(userLocale) || voiceLang === userLang)
          );
        });

        setAvailableVoices(localVoices);
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Save settings to localStorage
  const handleEnterToggle = () => {
    const newValue = !enterToSend;
    setEnterToSend(newValue);
    localStorage.setItem("enterToSend", String(newValue));
  };

  const handleTtsToggle = () => {
    const newValue = !ttsEnabled;
    setTtsEnabled(newValue);
    localStorage.setItem("ttsEnabled", String(newValue));
  };

  const handleVoiceChange = (voice: string) => {
    setSelectedVoice(voice);
    localStorage.setItem("ttsVoice", voice);
  };

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
                checked={enterToSend}
                onCheckedChange={handleEnterToggle}
              >
                <Keyboard className="mr-2 h-4 w-4" />
                Enter to send
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={ttsEnabled}
                onCheckedChange={handleTtsToggle}
              >
                {ttsEnabled ? (
                  <Volume2 className="mr-2 h-4 w-4" />
                ) : (
                  <VolumeX className="mr-2 h-4 w-4" />
                )}
                Text-to-speech
              </DropdownMenuCheckboxItem>
              {availableVoices.length > 0 && (
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
                      {availableVoices.map((voice) => (
                        <DropdownMenuItem
                          key={voice.voiceURI}
                          onClick={() => handleVoiceChange(voice.voiceURI)}
                          className="gap-2"
                        >
                          <span className="flex-1">
                            {voice.name?.slice(0, 10)}
                          </span>
                          {selectedVoice === voice.voiceURI && (
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
