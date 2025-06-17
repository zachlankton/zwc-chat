import { cn } from "~/lib/utils";
import {
  Eye,
  Globe,
  FileText,
  Brain,
  Star,
  Diamond,
  Info,
  Image,
} from "lucide-react";

interface ModelCardProps {
  model: {
    id: string;
    name: string;
    context_length: number;
    description: string;
    pricing: {
      prompt: string;
      completion: string;
    };
  };
  isSelected: boolean;
  onSelect: () => void;
  onHover?: (modelId: string | null) => void;
}

// Provider logos mapping
const getProviderInfo = (
  modelId: string,
): { name: string; className: string; icon?: string } => {
  const id = modelId.toLowerCase();

  if (id.includes("gpt-4") || id.includes("gpt-3")) {
    return { name: "GPT", className: "text-gray-600", icon: "🌀" };
  }
  if (id.includes("claude")) {
    return { name: "Claude", className: "text-orange-600", icon: "A" };
  }
  if (id.includes("gemini")) {
    return { name: "Gemini", className: "text-blue-600", icon: "✦" };
  }
  if (id.includes("deepseek")) {
    return { name: "DeepSeek", className: "text-purple-600", icon: "🐋" };
  }
  if (id.includes("grok")) {
    return { name: "Grok", className: "text-gray-700", icon: "𝕏" };
  }
  if (id.includes("llama")) {
    return { name: "Llama", className: "text-purple-500", icon: "🦙" };
  }
  if (id.includes("mixtral") || id.includes("mistral")) {
    return { name: "Mistral", className: "text-orange-500", icon: "M" };
  }
  if (id.includes("qwen")) {
    return { name: "Qwen", className: "text-indigo-600", icon: "✧" };
  }
  if (id.includes("o1")) {
    return { name: "OpenAI", className: "text-green-600", icon: "o1" };
  }

  return { name: "Other", className: "text-gray-500", icon: "◆" };
};

// Capability detection based on model features
const getModelCapabilities = (model: any) => {
  const capabilities = [];
  const id = model.id.toLowerCase();
  const name = model.name.toLowerCase();

  // Vision capability
  if (
    id.includes("vision") ||
    id.includes("4o") ||
    id.includes("gemini-2") ||
    name.includes("vision") ||
    id.includes("claude-3")
  ) {
    capabilities.push({ icon: Eye, color: "text-green-500", name: "Vision" });
  }

  // Web browsing
  if (id.includes("online") || id.includes("web") || name.includes("online")) {
    capabilities.push({ icon: Globe, color: "text-blue-500", name: "Web" });
  }

  // File handling
  if (id.includes("4") || id.includes("claude") || id.includes("gemini")) {
    capabilities.push({
      icon: FileText,
      color: "text-purple-500",
      name: "Files",
    });
  }

  // Advanced reasoning
  if (
    id.includes("o1") ||
    name.includes("reasoning") ||
    id.includes("deepseek-r")
  ) {
    capabilities.push({
      icon: Brain,
      color: "text-orange-500",
      name: "Reasoning",
    });
  }

  // Image generation
  if (id.includes("imagegen") || name.includes("image")) {
    capabilities.push({
      icon: Image,
      color: "text-pink-500",
      name: "Image Gen",
    });
  }

  return capabilities;
};

export function ModelCard({
  model,
  isSelected,
  onSelect,
  onHover,
}: ModelCardProps) {
  const provider = getProviderInfo(model.id);
  const capabilities = getModelCapabilities(model);
  const isPremium = parseFloat(model.pricing.prompt) > 0.001; // Premium if > $1/M tokens

  // Extract model version/variant
  const modelName = model.name.split(" ").slice(1, 4).join(" ");

  // Format pricing
  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    if (num === 0) return "Free";
    return `$${(num * 1000000).toFixed(2)}`;
  };

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => onHover?.(model.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        "relative flex flex-col items-center p-4 rounded-lg border-2 transition-all",
        "hover:border-primary hover:bg-accent/50",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        "w-full h-[140px] overflow-hidden",
        isSelected ? "border-primary bg-accent" : "border-border",
      )}
    >
      {/* Selected indicator */}
      {isSelected && (
        <Star className="absolute top-2 left-2 h-4 w-4 fill-yellow-400 text-yellow-400" />
      )}

      {/* Premium indicator */}
      {isPremium && (
        <Diamond className="absolute top-2 right-2 h-4 w-4 text-amber-500" />
      )}

      {/* Provider icon/logo */}
      <div className={cn("text-3xl font-bold mb-1", provider.className)}>
        {provider.icon}
      </div>

      {/* Model name */}
      <div className="text-center">
        <div className="text-xs text-muted-foreground">{provider.name}</div>
        <div className="font-medium text-sm">{modelName}</div>
      </div>

      {/* Price */}
      <div className="text-xs text-muted-foreground mt-1">
        {formatPrice(model.pricing.prompt)}/M
      </div>

      {/* Capabilities */}
      <div className="flex gap-1 mt-auto">
        {capabilities.map((cap, idx) => (
          <cap.icon key={idx} className={cn("h-4 w-4", cap.color)} />
        ))}
      </div>
    </button>
  );
}
