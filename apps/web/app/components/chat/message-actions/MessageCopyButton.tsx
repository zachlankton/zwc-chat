import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";

export function MessageCopyButton({
  content,
  reasoning,
}: {
  content: string | any[];
  reasoning?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // Convert content to markdown string
    let markdownContent = "";

    // Add reasoning if present
    if (reasoning) {
      markdownContent = `# Reasoning\n\n${reasoning}\n\n---\n\n`;
    }

    if (typeof content === "string") {
      markdownContent += content;
    } else if (Array.isArray(content)) {
      // Handle array content (mixed text/images/files)
      markdownContent += content
        .map((item) => {
          if (item.type === "text") {
            return item.text || "";
          } else if (item.type === "image_url") {
            return `![Image](${item.image_url?.url})`;
          } else if (item.type === "file") {
            return `[${item.file?.filename}]`;
          }
          return "";
        })
        .join("\n\n");
    }

    try {
      await navigator.clipboard.writeText(markdownContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = markdownContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-6 has-[>svg]:px-2 has-[>svg]:py-4 text-xs hover:bg-muted/50"
    >
      {copied ? <Check className="h-3" /> : <Copy className="h-3" />}
    </Button>
  );
}
