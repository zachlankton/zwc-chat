import { Mic } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface UseSpeechRecognitionProps {
  isLoading: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  handleKeyDown: (e: any) => void;
  handleSubmit: () => void;
}
export function useSpeechRecognition({
  isLoading,
  textareaRef,
  handleKeyDown,
  handleSubmit,
}: UseSpeechRecognitionProps) {
  const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showVoiceHint, setShowVoiceHint] = useState(false);
  const recognitionRef = useRef<any>(null);
  const voiceHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check for speech recognition support
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      setSpeechSupported(!!SpeechRecognition);
    }
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (!speechSupported) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setShowVoiceHint(false);

      // Show hint after 2 seconds of dictation
      if (voiceHintTimeoutRef.current) {
        clearTimeout(voiceHintTimeoutRef.current);
      }
      voiceHintTimeoutRef.current = setTimeout(() => {
        setShowVoiceHint(true);
      }, 2000);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      // Update textarea with current transcript
      if (textareaRef.current) {
        const currentValue = textareaRef.current.value;
        const newValue = currentValue + finalTranscript;
        textareaRef.current.value = newValue;

        // Trigger resize
        const event = new Event("input", { bubbles: true });
        textareaRef.current.dispatchEvent(event);
        handleKeyDown({ key: "" } as any);

        // Check for voice command
        const trimmedValue = newValue.trim().toLowerCase();
        const sendCommands = ["send message", "send the message", "send it"];

        for (const command of sendCommands) {
          if (trimmedValue.endsWith(command)) {
            // Clear any existing timeout
            if (submitTimeoutRef.current) {
              clearTimeout(submitTimeoutRef.current);
            }

            // Set pending state and schedule submission
            setPendingSubmit(true);
            submitTimeoutRef.current = setTimeout(() => {
              // Remove the command from the message
              const startOfCommand = newValue.indexOf(command);
              const messageWithoutCommand = newValue
                .slice(0, startOfCommand)
                .trim();
              if (messageWithoutCommand && textareaRef.current) {
                textareaRef.current.value = messageWithoutCommand;
                recognitionRef.current?.stop();
                handleSubmit();
              }
              setPendingSubmit(false);
            }, 1500); // 1.5 second delay
            break;
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setShowVoiceHint(false);
      if (voiceHintTimeoutRef.current) {
        clearTimeout(voiceHintTimeoutRef.current);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
      if (voiceHintTimeoutRef.current) {
        clearTimeout(voiceHintTimeoutRef.current);
      }
    };
  }, [speechSupported]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  }, [isListening]);

  return {
    pendingSubmit,
    submitTimeoutRef,
    setPendingSubmit,

    SpeechRecognition: () => (
      <InternalSpeechRecognition
        isLoading={isLoading}
        speechSupported={speechSupported}
        isListening={isListening}
        pendingSubmit={pendingSubmit}
        toggleListening={toggleListening}
        showVoiceHint={showVoiceHint}
      />
    ),
  };
}

interface SpeechRecognitionProps {
  isLoading: boolean;
  speechSupported: boolean;
  isListening: boolean;
  pendingSubmit: any;
  toggleListening: any;
  showVoiceHint: boolean;
}

function InternalSpeechRecognition({
  isLoading,
  speechSupported,
  isListening,
  pendingSubmit,
  toggleListening,
  showVoiceHint,
}: SpeechRecognitionProps) {
  return (
    <>
      {/* Mic Button */}
      {speechSupported && (
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 hover:bg-muted/50 transition-colors",
              isListening &&
                "bg-destructive/10 hover:bg-destructive/20 text-destructive",
              pendingSubmit && "animate-pulse",
            )}
            disabled={isLoading}
            onClick={toggleListening}
            title={isListening ? "Stop recording" : "Start voice input"}
          >
            {isListening ? (
              <div className="relative">
                <Mic
                  className={cn("h-4 w-4", pendingSubmit && "text-primary")}
                />
                <span
                  className={cn(
                    "absolute -top-1 -right-1 h-2 w-2 rounded-full",
                    pendingSubmit
                      ? "bg-primary animate-ping"
                      : "bg-destructive animate-pulse",
                  )}
                />
              </div>
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>

          {/* Voice Command Hint */}
          {showVoiceHint && isListening && !pendingSubmit && (
            <div className="absolute bottom-full right-0 mb-2 pointer-events-none">
              <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  Say "send message" to send
                </p>
                <div className="absolute bottom-0 right-3 transform translate-y-1/2 rotate-45 w-2 h-2 bg-card border-r border-b border-border" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pending Submit Indicator */}
      {pendingSubmit && (
        <span className="text-xs text-primary animate-pulse mr-1">
          Sending...
        </span>
      )}
    </>
  );
}
