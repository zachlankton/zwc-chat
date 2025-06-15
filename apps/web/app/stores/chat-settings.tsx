import { useQuery, type FetchQueryOptions } from "@tanstack/react-query";
import { queryClient } from "~/providers/queryClient";
import type { Tool } from "~/types/tools";

export interface ChatSettings {
  enterToSend: boolean;
  ttsEnabled: boolean;
  selectedVoice: string;
  availableVoices: SpeechSynthesisVoice[];
  systemPrompt: string;
  tools: Tool[];
  toolsEnabled: boolean;
}

const CHAT_SETTINGS_KEY = "CHAT_SETTINGS";

// Initialize default settings
export const defaultSystemPrompt =
  "Your name is ZWC Chat. You are a helpful AI assistant. Be concise, accurate, and friendly. When providing code, ensure it is well-documented and follows best practices.";

const defaultSettings: ChatSettings = {
  enterToSend: true,
  ttsEnabled: false,
  selectedVoice: "",
  availableVoices: [],
  systemPrompt: defaultSystemPrompt,
  tools: [],
  toolsEnabled: false,
};

// Load settings from localStorage
function loadSettings(): ChatSettings {
  if (typeof window === "undefined") return defaultSettings;

  const settings = { ...defaultSettings };

  // Load enter key preference
  const savedEnter = localStorage.getItem("enterToSend");
  if (savedEnter !== null) {
    settings.enterToSend = savedEnter === "true";
  }

  // Load TTS preference
  const savedTts = localStorage.getItem("ttsEnabled");
  if (savedTts !== null) {
    settings.ttsEnabled = savedTts === "true";
  }

  // Load voice preference
  const savedVoice = localStorage.getItem("ttsVoice");
  if (savedVoice) {
    settings.selectedVoice = savedVoice;
  }

  // Load system prompt
  const savedSystemPrompt = localStorage.getItem("systemPrompt");
  if (savedSystemPrompt) {
    settings.systemPrompt = savedSystemPrompt;
  }

  // Load tools
  const savedTools = localStorage.getItem("chat-tools");
  if (savedTools) {
    try {
      const parsedTools = JSON.parse(savedTools);
      // Ensure the parsed value is an array
      if (Array.isArray(parsedTools)) {
        settings.tools = parsedTools;
      } else {
        console.error("Saved tools is not an array, resetting to empty array");
        settings.tools = [];
        // Clean up the corrupted data
        localStorage.removeItem("chat-tools");
      }
    } catch (e) {
      console.error("Failed to parse saved tools:", e);
      settings.tools = [];
      // Clean up the corrupted data
      localStorage.removeItem("chat-tools");
    }
  }

  // Load tools enabled preference
  const savedToolsEnabled = localStorage.getItem("toolsEnabled");
  if (savedToolsEnabled !== null) {
    settings.toolsEnabled = savedToolsEnabled === "true";
  }

  // Load available voices
  const allVoices = window.speechSynthesis.getVoices();
  const userLocale = navigator.language || "en-US";
  const userLang = userLocale.split("-")[0];

  settings.availableVoices = allVoices.filter((voice) => {
    const voiceLang = voice.lang.split("-")[0];
    return (
      voice.localService &&
      (voice.lang.startsWith(userLocale) || voiceLang === userLang)
    );
  });

  return settings;
}

// Query function that loads settings
const SETTINGS_Q_FUN = async (): Promise<ChatSettings> => {
  return new Promise((resolve) => {
    const settings = loadSettings();

    // If voices aren't loaded yet, wait for them
    if (
      settings.availableVoices.length === 0 &&
      typeof window !== "undefined"
    ) {
      const handleVoicesChanged = () => {
        const updatedSettings = loadSettings();
        resolve(updatedSettings);
      };

      // Check if voices are already available
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve(loadSettings());
      } else {
        window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
      }
    } else {
      resolve(settings);
    }
  });
};

export const chatSettingsQuery: FetchQueryOptions<ChatSettings> = {
  queryKey: [CHAT_SETTINGS_KEY],
  queryFn: SETTINGS_Q_FUN,
  staleTime: Infinity, // Settings don't go stale
};

// Get current settings from cache
export function getChatSettings(): ChatSettings | undefined {
  return queryClient.getQueryData([CHAT_SETTINGS_KEY]);
}

// Update a specific setting
export function updateChatSetting<K extends keyof ChatSettings>(
  key: K,
  value: ChatSettings[K],
): void {
  const currentSettings = getChatSettings() || defaultSettings;
  const newSettings = { ...currentSettings, [key]: value };

  // Save to localStorage
  if (typeof window !== "undefined") {
    if (key === "enterToSend") {
      localStorage.setItem("enterToSend", String(value));
    } else if (key === "ttsEnabled") {
      localStorage.setItem("ttsEnabled", String(value));
    } else if (key === "selectedVoice") {
      localStorage.setItem("ttsVoice", value as string);
    } else if (key === "systemPrompt") {
      localStorage.setItem("systemPrompt", value as string);
    } else if (key === "tools") {
      localStorage.setItem("chat-tools", JSON.stringify(value));
    } else if (key === "toolsEnabled") {
      localStorage.setItem("toolsEnabled", String(value));
    }
  }

  // Update cache
  queryClient.setQueryData([CHAT_SETTINGS_KEY], newSettings);

  // Invalidate to trigger re-renders
  queryClient.invalidateQueries({ queryKey: [CHAT_SETTINGS_KEY] });
}

// Hook to use chat settings
export function useChatSettings() {
  const { data } = useQuery(chatSettingsQuery);

  return {
    settings: data || defaultSettings,
    updateEnterToSend: (value: boolean) =>
      updateChatSetting("enterToSend", value),
    updateTtsEnabled: (value: boolean) =>
      updateChatSetting("ttsEnabled", value),
    updateSelectedVoice: (value: string) =>
      updateChatSetting("selectedVoice", value),
    updateSystemPrompt: (value: string) =>
      updateChatSetting("systemPrompt", value),
    updateTools: (value: Tool[]) => updateChatSetting("tools", value),
    updateToolsEnabled: (value: boolean) =>
      updateChatSetting("toolsEnabled", value),
  };
}
