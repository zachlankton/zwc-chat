import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Skeleton } from "~/components/ui/skeleton";
import { ChevronDown, Sparkles, Zap } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import type { ModelsResponse } from "./chat-interface";

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  data?: ModelsResponse;
  isLoading: boolean;
  error: any;
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  data,
  isLoading,
  error,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch models from API

  // Find the selected model info
  const selectedModelInfo = data?.all.find((m) => m.id === selectedModel);

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

  // Load last selected model from localStorage
  useEffect(() => {
    const savedModel = localStorage.getItem("selectedModel");
    if (savedModel && data?.all.some((m) => m.id === savedModel)) {
      onModelChange(savedModel);
    }
  }, [data, onModelChange]);

  // Save selected model to localStorage
  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem("selectedModel", selectedModel);
    }
  }, [selectedModel]);

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    if (num === 0) return "Free";
    return `$${(num * 1000000).toFixed(2)}/M`;
  };

  const formatContextLength = (length: number) => {
    if (length >= 1000000) {
      return `${(length / 1000000).toFixed(1)}M`;
    }
    return `${(length / 1000).toFixed(0)}K`;
  };

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

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) {
          setSearchQuery("");
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between max-w-xs"
          size="sm"
        >
          <div className="flex items-center gap-2 truncate">
            <Sparkles className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              {selectedModelInfo?.name || "Select model"}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-96 max-h-[60vh] overflow-hidden"
        align="start"
      >
        <div className="sticky top-0 bg-background p-2">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>

        <div className="overflow-y-auto max-h-[50vh]">
          {filteredFavorites.length > 0 && (
            <>
              <DropdownMenuLabel className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Favorites
              </DropdownMenuLabel>
              {filteredFavorites.map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  onClick={() => {
                    onModelChange(model.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                  onSelect={(e) => e.preventDefault()}
                >
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{model.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatContextLength(model.context_length)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate pr-2">{model.description}</span>
                      <span className="flex-shrink-0">
                        {formatPrice(model.pricing.prompt)}
                      </span>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
              {filteredAll.length > 0 && <DropdownMenuSeparator />}
            </>
          )}

          {filteredAll.length > 0 && (
            <>
              <DropdownMenuLabel>All Models</DropdownMenuLabel>
              {filteredAll.map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  onClick={() => {
                    onModelChange(model.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                  onSelect={(e) => e.preventDefault()}
                >
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{model.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatContextLength(model.context_length)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate pr-2">{model.description}</span>
                      <span className="flex-shrink-0">
                        {formatPrice(model.pricing.prompt)}
                      </span>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}

          {filteredFavorites.length === 0 && filteredAll.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No models found
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

