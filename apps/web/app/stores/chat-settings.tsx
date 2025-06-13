import { useQuery, type FetchQueryOptions } from "@tanstack/react-query";
import { queryClient } from "~/providers/queryClient";

export interface ChatSettings {
  enterToSend: boolean;
  ttsEnabled: boolean;
  selectedVoice: string;
  availableVoices: SpeechSynthesisVoice[];
}

const CHAT_SETTINGS_KEY = "CHAT_SETTINGS";

// Initialize default settings
const defaultSettings: ChatSettings = {
  enterToSend: true,
  ttsEnabled: false,
  selectedVoice: "",
  availableVoices: [],
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
    if (settings.availableVoices.length === 0 && typeof window !== "undefined") {
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
  value: ChatSettings[K]
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
    updateEnterToSend: (value: boolean) => updateChatSetting("enterToSend", value),
    updateTtsEnabled: (value: boolean) => updateChatSetting("ttsEnabled", value),
    updateSelectedVoice: (value: string) => updateChatSetting("selectedVoice", value),
  };
}