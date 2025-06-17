import { cn } from "~/lib/utils";
import { Eye, Globe, FileText, Brain, Star, Gem, Hammer } from "lucide-react";

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
    architecture?: {
      input_modalities?: string[];
      output_modalities?: string[];
    };
    supported_parameters?: string[];
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

  // Extract provider from model ID (e.g., "openai/gpt-4" -> "openai")
  const provider = modelId.split("/")[0];

  if (provider.includes("openai")) {
    return { name: "OpenAI", className: "text-gray-600", icon: "🌀" };
  }
  if (provider.includes("anthropic")) {
    return { name: "Anthropic", className: "text-orange-600", icon: "A" };
  }
  if (provider.includes("google")) {
    return { name: "Google", className: "text-blue-600", icon: "✦" };
  }
  if (provider.includes("deepseek")) {
    return { name: "DeepSeek", className: "text-purple-600", icon: "🐋" };
  }
  if (provider.includes("x-ai")) {
    return { name: "Grok", className: "text-gray-700", icon: "𝕏" };
  }
  if (provider.includes("llama")) {
    return { name: "Llama", className: "text-purple-500", icon: "🦙" };
  }
  if (provider.includes("qwen")) {
    return { name: "Qwen", className: "text-indigo-600", icon: "✧" };
  }

  // Fallback to provider name with proper capitalization
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
  return { name: providerName, className: "text-gray-500", icon: "◆" };
};

// Capability detection based on model features
const getModelCapabilities = (model: ModelCardProps["model"]) => {
  const capabilities = [];

  // Use architecture data for vision capability
  if (model.architecture?.input_modalities?.includes("image")) {
    capabilities.push({ icon: Eye, color: "text-green-500", name: "Vision" });
  }

  // Web browsing - check supported_parameters
  if (model.supported_parameters?.includes("web_search_options")) {
    capabilities.push({ icon: Globe, color: "text-blue-500", name: "Web" });
  }

  // File handling - check input modalities
  if (model.architecture?.input_modalities?.includes("file")) {
    capabilities.push({
      icon: FileText,
      color: "text-purple-500",
      name: "Files",
    });
  }

  // Tool support - check supported_parameters
  if (model.supported_parameters?.includes("tools")) {
    capabilities.push({
      icon: Hammer,
      color: "text-orange-500",
      name: "Tools",
    });
  }

  // Advanced reasoning (keep name-based detection for now)
  if (model.supported_parameters?.includes("reasoning")) {
    capabilities.push({
      icon: Brain,
      color: "text-amber-500",
      name: "Reasoning",
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
  const isPremium = parseFloat(model.pricing.prompt) > 0.000001; // Premium if > $1/M tokens

  // Extract model version/variant
  const modelName = model.name.split(" ").slice(1, 4).join(" ");
  const subModelName = model.name.split(" ").slice(4).join(" ");

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
        "relative flex flex-col items-center p-1 rounded-lg border-2 transition-all",
        "hover:border-primary hover:bg-accent/50",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        "w-full h-[150px] overflow-hidden",
        isSelected ? "border-primary bg-accent" : "border-border",
      )}
    >
      {/* Selected indicator */}
      {isSelected && (
        <Star className="absolute top-2 left-2 h-4 w-4 fill-yellow-400 text-yellow-400" />
      )}

      {/* Premium indicator */}
      {isPremium && (
        <Gem className="absolute top-2 right-2 h-4 w-4 text-amber-500" />
      )}

      {/* Provider icon/logo */}
      <div className={cn("text-3xl font-bold mb-1", provider.className)}>
        {provider.icon}
      </div>

      {/* Model name */}
      <div className="text-center">
        <div className="text-xs text-muted-foreground">{provider.name}</div>
        <div className="font-medium text-sm">{modelName}</div>
        <div className="text-xs text-muted-foreground">{subModelName}</div>
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
