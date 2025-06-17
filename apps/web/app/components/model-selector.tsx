import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  ChevronDown,
  Sparkles,
  Search,
  X,
  FileText,
  Diamond,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { ModelsResponse } from "./chat-interface";
import { ModelCard } from "./model-card";
import { AsyncModal } from "./async-modals";
import { useModalContext } from "./async-modals";

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  data?: ModelsResponse;
  isLoading: boolean;
  error: any;
}

// Modal content component
export function ModelSelectorModal({
  selectedModel,
  onModelChange,
  data,
}: {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  data: ModelsResponse;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(true);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { closeModal } = useModalContext();

  useEffect(() => {
    if (searchQuery && showFavoritesOnly) {
      setShowFavoritesOnly(false);
    }
  }, [searchQuery, showFavoritesOnly]);

  // Focus search input when modal opens
  useEffect(() => {
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  // Find the selected model info
  const selectedModelInfo = data?.all.find((m) => m.id === selectedModel);

  // Find the hovered model info (or fall back to selected)
  const displayedModelInfo = hoveredModel
    ? data?.all.find((m) => m.id === hoveredModel)
    : selectedModelInfo;

  // Filter models based on search
  const filteredFavorites =
    data?.favorites.filter(
      (m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(searchQuery.toLowerCase()),
    ) || [];

  const filteredAll =
    data?.all.filter(
      (m) =>
        !data.favorites.some((f) => f.id === m.id) &&
        (m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.id.toLowerCase().includes(searchQuery.toLowerCase())),
    ) || [];

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    if (num === 0) return "Free";
    return `$${(num * 1000000).toFixed(2)}/M`;
  };

  const handleModelSelect = (modelId: string) => {
    onModelChange(modelId);
    closeModal();
  };

  return (
    <div className="flex flex-col h-[80dvh]">
      {/* Header */}
      <div className="p-6 pb-4 border-b flex items-center justify-between">
        <div className="flex-1">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={closeModal}
          className="ml-4"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Favorites Section */}
        {!showFavoritesOnly && filteredFavorites.length > 0 && (
          <div className="mb-6">
            <h3 className="flex items-center gap-2 text-sm font-medium mb-3">
              <span className="text-lg">⚡</span> Favorites
            </h3>
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredFavorites.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  isSelected={model.id === selectedModel}
                  onSelect={() => handleModelSelect(model.id)}
                  onHover={setHoveredModel}
                />
              ))}
            </div>
          </div>
        )}

        {/* Others Section */}
        {!showFavoritesOnly && filteredAll.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3">Others</h3>
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredAll.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  isSelected={model.id === selectedModel}
                  onSelect={() => handleModelSelect(model.id)}
                  onHover={setHoveredModel}
                />
              ))}
            </div>
          </div>
        )}

        {/* Favorites only view */}
        {showFavoritesOnly && (
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredFavorites.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                isSelected={model.id === selectedModel}
                onSelect={() => handleModelSelect(model.id)}
                onHover={setHoveredModel}
              />
            ))}
          </div>
        )}

        {/* No results */}
        {filteredFavorites.length === 0 && filteredAll.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No models found</p>
            <p className="text-sm mt-1">Try adjusting your search</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-muted/50">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className="gap-2"
          >
            {showFavoritesOnly ? <>Show all</> : <>Favorites</>}
          </Button>

          <div className="flex items-center gap-4 flex-1 justify-end">
            {/* Model details display */}
            {displayedModelInfo && (
              <div className="flex items-center gap-4 text-sm">
                {/* Context length */}
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {displayedModelInfo.context_length >= 1000000
                      ? `${(displayedModelInfo.context_length / 1000000).toFixed(1)}M`
                      : `${(displayedModelInfo.context_length / 1000).toFixed(0)}K`}{" "}
                    tokens
                  </span>
                </div>

                {/* Pricing */}
                <div className="flex items-center gap-1">
                  <Diamond className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Input: {formatPrice(displayedModelInfo.pricing.prompt)}/M
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">
                    Output: {formatPrice(displayedModelInfo.pricing.completion)}
                    /M
                  </span>
                </div>
              </div>
            )}

            {/* Current selection indicator */}
            <div className="flex items-center gap-2 px-3 py-1 bg-background rounded-md border min-w-[200px]">
              <span className="text-sm font-medium">
                {displayedModelInfo?.name || "None selected"}
              </span>
              {hoveredModel && hoveredModel !== selectedModel && (
                <span className="text-xs text-muted-foreground">(hover)</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  data,
  isLoading,
  error,
}: ModelSelectorProps) {
  // Find the selected model info
  const selectedModelInfo = data?.all.find((m) => m.id === selectedModel);

  if (isLoading) {
    return <Skeleton className="h-9 w-48" />;
  }

  if (error) {
    return (
      <Button variant="outline" disabled>
        Error loading models
      </Button>
    );
  }

  const openModelSelector = () => {
    if (!data) return;

    AsyncModal(
      <ModelSelectorModal
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        data={data}
      />,
      {
        showCloseButton: false,
        extraClasses: "min-w-[80dvw] p-0",
      },
    );
  };

  return (
    <Button
      variant="outline"
      className="justify-between w-full max-w-full"
      size="sm"
      onClick={openModelSelector}
    >
      <div className="flex items-center gap-2 truncate">
        <Sparkles className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">
          {selectedModelInfo?.name || "Select model"}
        </span>
      </div>
      <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 rotate-180" />
    </Button>
  );
}
