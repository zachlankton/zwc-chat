import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "~/lib/chat/types";
import type { ChatSettingsHook } from "~/stores/chat-settings";

interface UseTextToSpeechProps {
  messagesRef: React.RefObject<Message[]>;
  chatSettings: ChatSettingsHook;
}

export function useTextToSpeech({
  messagesRef,
  chatSettings: settings,
}: UseTextToSpeechProps) {
  // TTS state
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null,
  );

  const { chatSettings } = settings;

  const ttsQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef(false);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ttsBufferRef = useRef<string>("");
  const ttsBufferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // TTS queue processor
  const processTtsQueue = useCallback(() => {
    if (
      isSpeakingRef.current ||
      ttsQueueRef.current.length === 0 ||
      !chatSettings.ttsEnabled
    ) {
      return;
    }

    const text = ttsQueueRef.current.shift();
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1; // Slightly faster
    utterance.pitch = 1.0;
    utterance.volume = 0.9;

    // Set selected voice if available
    if (chatSettings.selectedVoice) {
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(
        (v) => v.voiceURI === chatSettings.selectedVoice,
      );
      if (voice) {
        utterance.voice = voice;
      }
    }

    utterance.onstart = () => {
      isSpeakingRef.current = true;
    };

    utterance.onend = () => {
      isSpeakingRef.current = false;
      processTtsQueue(); // Process next in queue
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
      ttsQueueRef.current = []; // Clear queue on error
    };

    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [chatSettings.ttsEnabled, chatSettings.selectedVoice]);

  // TTS buffer processor - flushes buffer and queues for speech
  const flushTtsBuffer = useCallback(() => {
    if (ttsBufferRef.current.trim()) {
      ttsQueueRef.current.push(ttsBufferRef.current.trim());
      ttsBufferRef.current = "";
      processTtsQueue();
    }
    if (ttsBufferTimeoutRef.current) {
      clearTimeout(ttsBufferTimeoutRef.current);
      ttsBufferTimeoutRef.current = null;
    }
  }, [processTtsQueue]);

  // Speak a specific message
  const speakMessage = useCallback(
    (messageId: string) => {
      const message = messagesRef.current.find((m) => m.id === messageId);
      if (!message || message.role !== "assistant") return;

      // Extract text content
      let textToSpeak = "";
      if (message.reasoning) {
        textToSpeak += "Reasoning: " + message.reasoning + ". ";
      }

      if (typeof message.content === "string") {
        textToSpeak += message.content;
      } else if (Array.isArray(message.content)) {
        textToSpeak += message.content
          .filter((item) => item.type === "text")
          .map((item) => item.text || "")
          .join(" ");
      }

      // Clean up markdown formatting for better speech
      textToSpeak = textToSpeak
        .replace(/```[\s\S]*?```/g, ",,, code block ,,,") // Replace code blocks
        .replace(/`([^`]+)`/g, "$1") // Remove inline code backticks
        .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold
        .replace(/\*([^*]+)\*/g, "$1") // Remove italic
        .replace(/#+\s/g, "") // Remove headers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Convert links to text
        .replace(/\n+/g, ". ") // Convert newlines to periods
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

      if (!textToSpeak) return;

      // Stop any current speech
      window.speechSynthesis.cancel();
      setSpeakingMessageId(messageId);

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.0; // Normal speed for full messages
      utterance.pitch = 1.0;
      utterance.volume = 0.9;

      // Set selected voice if available
      if (chatSettings.selectedVoice) {
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(
          (v) => v.voiceURI === chatSettings.selectedVoice,
        );
        if (voice) {
          utterance.voice = voice;
        }
      }

      utterance.onend = () => {
        setSpeakingMessageId(null);
      };

      utterance.onerror = () => {
        setSpeakingMessageId(null);
      };

      window.speechSynthesis.speak(utterance);
    },
    [chatSettings.selectedVoice],
  );

  // Toggle speak for a message
  const toggleSpeakMessage = useCallback(
    (messageId: string) => {
      if (speakingMessageId === messageId) {
        // Stop speaking
        window.speechSynthesis.cancel();
        setSpeakingMessageId(null);
      } else {
        // Start speaking
        speakMessage(messageId);
      }
    },
    [speakingMessageId, speakMessage],
  );

  // Stop TTS when disabled or component unmounts
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!chatSettings.ttsEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      ttsQueueRef.current = [];
      ttsBufferRef.current = "";
      isSpeakingRef.current = false;
      if (ttsBufferTimeoutRef.current) {
        clearTimeout(ttsBufferTimeoutRef.current);
        ttsBufferTimeoutRef.current = null;
      }
    }
  }, [chatSettings.ttsEnabled]);

  const onNewContent = useCallback(
    (content: string) => {
      if (chatSettings.ttsEnabled && content) {
        // Add to buffer
        ttsBufferRef.current += content;

        // Clear existing timeout
        if (ttsBufferTimeoutRef.current) {
          clearTimeout(ttsBufferTimeoutRef.current);
        }

        // Check for natural break points
        const breakPattern = /([.!?;,\n]+)/;
        const parts = ttsBufferRef.current.split(breakPattern);

        // Process complete chunks (everything except possibly the last part)
        for (let i = 0; i < parts.length - 1; i += 2) {
          const chunk = parts[i].trim();
          const punctuation = parts[i + 1] || "";

          if (chunk) {
            // Include punctuation for natural pauses
            ttsQueueRef.current.push(chunk + punctuation);
          }
        }

        // Keep the last part in buffer (might be incomplete)
        ttsBufferRef.current = parts[parts.length - 1] || "";

        // Process queue if we have chunks
        if (ttsQueueRef.current.length > 0) {
          processTtsQueue();
        }

        // Set timeout to flush buffer after 800ms of no new content
        ttsBufferTimeoutRef.current = setTimeout(() => {
          flushTtsBuffer();
        }, 800);
      }
    },
    [chatSettings.ttsEnabled, processTtsQueue, flushTtsBuffer],
  );

  return {
    ttsBufferRef,
    ttsBufferTimeoutRef,
    flushTtsBuffer,
    ttsQueueRef,
    processTtsQueue,
    speakingMessageId,
    toggleSpeakMessage,
    onNewContent,
  };
}
