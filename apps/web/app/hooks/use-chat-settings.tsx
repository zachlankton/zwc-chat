import { useState, useEffect, useCallback } from "react";

interface ChatSettings {
  enterToSend: boolean;
  ttsEnabled: boolean;
  selectedVoice: string;
  availableVoices: SpeechSynthesisVoice[];
}

// Event emitter for settings changes
class SettingsEventEmitter extends EventTarget {
  emit(key: string, value: any) {
    this.dispatchEvent(new CustomEvent(key, { detail: value }));
  }
}

const settingsEmitter = new SettingsEventEmitter();

export function useChatSettings() {
  const [enterToSend, setEnterToSend] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

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
  }, []);

  // Listen for settings changes from other components
  useEffect(() => {
    const handleEnterChange = (e: Event) => {
      const value = (e as CustomEvent).detail;
      setEnterToSend(value);
    };

    const handleTtsChange = (e: Event) => {
      const value = (e as CustomEvent).detail;
      setTtsEnabled(value);
    };

    const handleVoiceChange = (e: Event) => {
      const value = (e as CustomEvent).detail;
      setSelectedVoice(value);
    };

    settingsEmitter.addEventListener("enterToSend", handleEnterChange);
    settingsEmitter.addEventListener("ttsEnabled", handleTtsChange);
    settingsEmitter.addEventListener("selectedVoice", handleVoiceChange);

    return () => {
      settingsEmitter.removeEventListener("enterToSend", handleEnterChange);
      settingsEmitter.removeEventListener("ttsEnabled", handleTtsChange);
      settingsEmitter.removeEventListener("selectedVoice", handleVoiceChange);
    };
  }, []);

  // Update functions that save to localStorage and emit events
  const updateEnterToSend = useCallback((value: boolean) => {
    setEnterToSend(value);
    if (typeof window !== "undefined") {
      localStorage.setItem("enterToSend", String(value));
      settingsEmitter.emit("enterToSend", value);
    }
  }, []);

  const updateTtsEnabled = useCallback((value: boolean) => {
    setTtsEnabled(value);
    if (typeof window !== "undefined") {
      localStorage.setItem("ttsEnabled", String(value));
      settingsEmitter.emit("ttsEnabled", value);
    }
  }, []);

  const updateSelectedVoice = useCallback((value: string) => {
    setSelectedVoice(value);
    if (typeof window !== "undefined") {
      localStorage.setItem("ttsVoice", value);
      settingsEmitter.emit("selectedVoice", value);
    }
  }, []);

  return {
    enterToSend,
    ttsEnabled,
    selectedVoice,
    availableVoices,
    updateEnterToSend,
    updateTtsEnabled,
    updateSelectedVoice,
  };
}