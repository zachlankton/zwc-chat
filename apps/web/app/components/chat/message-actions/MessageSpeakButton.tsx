import { Volume2, VolumeX } from "lucide-react";
import { Button } from "~/components/ui/button";

export function MessageSpeakButton({
  messageId,
  isPlaying,
  onToggleSpeak,
}: {
  messageId: string;
  content: string | any[];
  reasoning?: string;
  isPlaying: boolean;
  onToggleSpeak: (messageId: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onToggleSpeak(messageId)}
      className="h-6 has-[>svg]:px-2 has-[>svg]:py-4 text-xs hover:bg-muted/50"
      title={isPlaying ? "Stop speaking" : "Speak message"}
    >
      {isPlaying ? <VolumeX className="h-3" /> : <Volume2 className="h-3" />}
    </Button>
  );
}
