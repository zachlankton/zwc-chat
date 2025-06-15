import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Switch } from "~/components/ui/switch";
import { useChatSettings } from "~/stores/chat-settings";
import type { Tool } from "~/types/tools";
import { Plus, Trash2, Download, Upload, Edit2, Sparkles, ChevronDown } from "lucide-react";
import { ToolEditor } from "./tool-editor";
import { cn } from "~/lib/utils";
import { exampleTools } from "~/lib/example-tools";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

interface ToolManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ToolManager({ open, onOpenChange }: ToolManagerProps) {
  const { settings, updateTools, updateToolsEnabled } = useChatSettings();
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createWithExample, setCreateWithExample] = useState(false);

  const handleToggleTool = (toolId: string) => {
    const updatedTools = settings.tools.map((tool) =>
      tool.id === toolId ? { ...tool, enabled: !tool.enabled } : tool,
    );
    updateTools(updatedTools);
  };

  const handleDeleteTool = (toolId: string) => {
    const updatedTools = settings.tools.filter((tool) => tool.id !== toolId);
    updateTools(updatedTools);
  };

  const handleSaveTool = (tool: Tool) => {
    const existingIndex = settings.tools.findIndex((t) => t.id === tool.id);
    const updatedTools =
      existingIndex >= 0
        ? settings.tools.map((t) => (t.id === tool.id ? tool : t))
        : [...settings.tools, tool];

    updateTools(updatedTools);
    setEditingTool(null);
    setIsCreating(false);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(settings.tools, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;

    const exportFileDefaultName = "chat-tools.json";

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedTools = JSON.parse(e.target?.result as string) as Tool[];
        // Merge imported tools, avoiding duplicates by name
        const existingNames = new Set(
          settings.tools.map((t) => t.function.name),
        );
        const newTools = importedTools.filter(
          (t) => !existingNames.has(t.function.name),
        );
        updateTools([...settings.tools, ...newTools]);
      } catch (error) {
        console.error("Failed to import tools:", error);
        // TODO: Show error toast
      }
    };
    reader.readAsText(file);
  };

  const handleAddExampleTools = () => {
    // Filter out tools that already exist
    const existingNames = new Set(settings.tools.map((t) => t.function.name));
    const newExampleTools = exampleTools.filter(
      (t) => !existingNames.has(t.function.name),
    );

    if (newExampleTools.length === 0) {
      // TODO: Show toast that all example tools already exist
      return;
    }

    updateTools([...settings.tools, ...newExampleTools]);
  };

  if (editingTool || isCreating) {
    return (
      <ToolEditor
        tool={editingTool}
        open={true}
        startWithExample={createWithExample}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTool(null);
            setIsCreating(false);
            setCreateWithExample(false);
          }
        }}
        onSave={handleSaveTool}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[80dvw] h-[60dvw] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Tools</DialogTitle>
          <DialogDescription>
            Create and manage JavaScript functions that the AI can call during
            conversations. Tools execute locally in your browser for privacy and
            security.
          </DialogDescription>
        </DialogHeader>

        {/* Tools Enabled Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
          <div>
            <h3 className="font-medium">Enable Tools</h3>
            <p className="text-sm text-muted-foreground">
              Allow the AI to call your custom tools during conversations
            </p>
          </div>
          <Switch
            checked={settings.toolsEnabled}
            onCheckedChange={updateToolsEnabled}
          />
        </div>

        {/* Tools List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {settings.tools.length === 0 ? (
            <div className="space-y-6">
              <div className="text-center py-12 text-muted-foreground">
                <p>No tools created yet.</p>
                <p className="text-sm mt-2">
                  Create your first tool to get started!
                </p>
              </div>

              {/* Add example tools button */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mx-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <h4 className="font-medium">
                      Get Started with Example Tools
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add pre-built tools to see how they work
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddExampleTools}
                  >
                    Add Examples
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {settings.tools.map((tool) => (
                <div
                  key={tool.id}
                  className={cn(
                    "flex items-center justify-between p-4 border rounded-lg",
                    !tool.enabled && "opacity-60",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={tool.enabled}
                      onCheckedChange={() => handleToggleTool(tool.id)}
                    />
                    <div>
                      <h4 className="font-medium">{tool.function.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {tool.function.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingTool(tool)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteTool(tool.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={settings.tools.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <label>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="sr-only"
              />
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </span>
              </Button>
            </label>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Tool
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setCreateWithExample(false);
                  setIsCreating(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Start from Scratch
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setCreateWithExample(true);
                  setIsCreating(true);
                }}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Start with Example
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </DialogContent>
    </Dialog>
  );
}

