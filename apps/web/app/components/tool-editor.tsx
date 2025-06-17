import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { ScrollArea } from "~/components/ui/scroll-area";
import type { Tool } from "~/types/tools";
import { Plus, Trash2, Play } from "lucide-react";
import { cn } from "~/lib/utils";

interface ToolEditorProps {
  tool?: Tool | null;
  open: boolean;
  startWithExample?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (tool: Tool) => void;
}

interface Parameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required: boolean;
}

export function ToolEditor({
  tool,
  open,
  startWithExample = false,
  onOpenChange,
  onSave,
}: ToolEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [code, setCode] = useState("");
  const [testInput, setTestInput] = useState("{}");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [advancedMode, setAdvancedMode] = useState(false);
  const [rawParameters, setRawParameters] = useState<string>("{}");

  // Convert parameters to raw JSON format
  const parametersToRaw = React.useCallback((params: Parameter[]) => {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    params.forEach((param) => {
      properties[param.name] = {
        type: param.type,
        description: param.description,
      };
      if (param.required) {
        required.push(param.name);
      }
    });

    return JSON.stringify(
      {
        type: "object",
        properties,
        required,
      },
      null,
      2,
    );
  }, []);

  // Convert raw JSON to parameters
  const rawToParameters = React.useCallback(
    (raw: string): Parameter[] | null => {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed.properties || typeof parsed.properties !== "object") {
          return null;
        }

        const params: Parameter[] = [];
        const requiredSet = new Set(parsed.required || []);

        for (const [paramName, paramDef] of Object.entries(parsed.properties)) {
          if (typeof paramDef === "object" && paramDef !== null) {
            params.push({
              name: paramName,
              type: (paramDef as any).type || "string",
              description: (paramDef as any).description || "",
              required: requiredSet.has(paramName),
            });
          }
        }

        return params;
      } catch (e) {
        return null;
      }
    },
    [],
  );

  // Generate test input template based on parameters
  const generateTestInputTemplate = React.useCallback(() => {
    if (parameters.length === 0) return "{}";

    const template: Record<string, any> = {};
    parameters.forEach((param) => {
      // Generate more contextual example values based on parameter name
      const nameLower = param.name.toLowerCase();

      switch (param.type) {
        case "string":
          if (nameLower.includes("email")) {
            template[param.name] = "user@example.com";
          } else if (nameLower.includes("url") || nameLower.includes("link")) {
            template[param.name] = "https://example.com";
          } else if (nameLower.includes("name")) {
            template[param.name] = "John Doe";
          } else if (
            nameLower.includes("message") ||
            nameLower.includes("text")
          ) {
            template[param.name] = "Hello, world!";
          } else if (nameLower.includes("id")) {
            template[param.name] = "abc123";
          } else if (nameLower.includes("type")) {
            template[param.name] = "default";
          } else {
            template[param.name] = param.description || "example string";
          }
          break;

        case "number":
          if (nameLower.includes("age")) {
            template[param.name] = 25;
          } else if (
            nameLower.includes("price") ||
            nameLower.includes("cost")
          ) {
            template[param.name] = 99.99;
          } else if (
            nameLower.includes("count") ||
            nameLower.includes("quantity")
          ) {
            template[param.name] = 10;
          } else if (nameLower.includes("year")) {
            template[param.name] = 2024;
          } else if (nameLower.includes("percent")) {
            template[param.name] = 50;
          } else {
            template[param.name] = 42;
          }
          break;

        case "boolean":
          template[param.name] =
            nameLower.includes("is") ||
            nameLower.includes("has") ||
            nameLower.includes("enable");
          break;

        case "object":
          if (nameLower.includes("config") || nameLower.includes("settings")) {
            template[param.name] = { enabled: true, value: "default" };
          } else if (nameLower.includes("data")) {
            template[param.name] = { id: 1, name: "example" };
          } else {
            template[param.name] = { key: "value" };
          }
          break;

        case "array":
          if (nameLower.includes("tags")) {
            template[param.name] = ["tag1", "tag2", "tag3"];
          } else if (
            nameLower.includes("items") ||
            nameLower.includes("list")
          ) {
            template[param.name] = ["item1", "item2", "item3"];
          } else if (nameLower.includes("numbers")) {
            template[param.name] = [1, 2, 3, 4, 5];
          } else {
            template[param.name] = ["value1", "value2"];
          }
          break;
      }
    });

    return JSON.stringify(template, null, 2);
  }, [parameters]);

  useEffect(() => {
    if (tool) {
      setName(tool.function.name);
      setDescription(tool.function.description);
      setCode(tool.code);

      // Convert tool parameters to our format
      const params: Parameter[] = [];
      for (const [paramName, paramDef] of Object.entries(
        tool.function.parameters.properties,
      )) {
        params.push({
          name: paramName,
          type: paramDef.type as any,
          description: paramDef.description,
          required: tool.function.parameters.required.includes(paramName),
        });
      }
      setParameters(params);
      setRawParameters(JSON.stringify(tool.function.parameters, null, 2));
    } else if (startWithExample) {
      // Reset for new tool with hello world example
      setName("greet_user");
      setDescription("Greets a user with a personalized message");
      setParameters([
        {
          name: "name",
          type: "string",
          description: "The name of the person to greet",
          required: true,
        },
        {
          name: "timeOfDay",
          type: "string",
          description: "The time of day (morning, afternoon, evening)",
          required: false,
        },
      ]);
      setRawParameters(
        JSON.stringify(
          {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "The name of the person to greet",
              },
              timeOfDay: {
                type: "string",
                description: "The time of day (morning, afternoon, evening)",
              },
            },
            required: ["name"],
          },
          null,
          2,
        ),
      );
      setCode(`// This is a simple example function that greets a user
// Feel free to modify or replace this with your own logic

// Get the current time of day if not provided
if (!timeOfDay) {
  const hour = new Date().getHours();
  if (hour < 12) timeOfDay = "morning";
  else if (hour < 17) timeOfDay = "afternoon";
  else timeOfDay = "evening";
}

// Create a personalized greeting
const greeting = \`Good \${timeOfDay}, \${name}!\`;

// Return an object with the greeting and some additional info
return {
  greeting: greeting,
  timestamp: new Date().toISOString(),
  message: "Welcome to the AI assistant! How can I help you today?"
};`);
      setTestInput(
        JSON.stringify(
          {
            name: "Alice",
            timeOfDay: "morning",
          },
          null,
          2,
        ),
      );
    } else {
      // Reset for new tool from scratch
      setName("");
      setDescription("");
      setParameters([]);
      setRawParameters(
        JSON.stringify(
          {
            type: "object",
            properties: {},
            required: [],
          },
          null,
          2,
        ),
      );
      setCode(`// This function receives parameters and must return a result
// Example: function(param1, param2) { return param1 + param2; }
`);
      setTestInput("{}");
    }
    setTestResult(null);
    setErrors({});
    setAdvancedMode(false);
  }, [tool, startWithExample]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Tool name is required";
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      newErrors.name = "Tool name must be a valid function name";
    }

    if (!description.trim()) {
      newErrors.description = "Description is required";
    }

    if (!code.trim()) {
      newErrors.code = "Function code is required";
    }

    // Validate parameters
    parameters.forEach((param, index) => {
      if (!param.name.trim()) {
        newErrors[`param-${index}-name`] = "Parameter name is required";
      } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(param.name)) {
        newErrors[`param-${index}-name`] = "Invalid parameter name";
      }
      if (!param.description.trim()) {
        newErrors[`param-${index}-desc`] = "Parameter description is required";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddParameter = () => {
    setParameters([
      ...parameters,
      {
        name: "",
        type: "string",
        description: "",
        required: false,
      },
    ]);
  };

  const handleRemoveParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const handleToggleAdvancedMode = () => {
    if (!advancedMode) {
      // Switching to advanced mode - convert parameters to raw
      setRawParameters(parametersToRaw(parameters));
      setAdvancedMode(true);
    } else {
      // Switching to easy mode - try to parse raw
      const parsed = rawToParameters(rawParameters);
      if (parsed === null) {
        setErrors({
          rawParameters:
            "Invalid JSON format. Please fix before switching modes.",
        });
        return;
      }
      setParameters(parsed);
      setAdvancedMode(false);
      setErrors({});
    }
  };

  const handleUpdateParameter = (
    index: number,
    field: keyof Parameter,
    value: any,
  ) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    setParameters(updated);
  };

  // Update test input when parameters change
  React.useEffect(() => {
    // Only update if current test input is empty or is the default
    if (testInput === "{}" || testInput.trim() === "") {
      setTestInput(generateTestInputTemplate());
    }
  }, [parameters, generateTestInputTemplate]);

  const handleTest = async () => {
    try {
      // Parse test input
      const args = JSON.parse(testInput);

      // Get parameter names based on current mode
      let paramNames: string[];
      if (advancedMode) {
        // Parse raw parameters to get param names
        const parsed = rawToParameters(rawParameters);
        if (!parsed) {
          setTestResult(`Error: Invalid parameter schema`);
          return;
        }
        paramNames = parsed.map((p) => p.name);
      } else {
        paramNames = parameters.map((p) => p.name);
      }

      // Create function from code
      const func = new Function(...paramNames, code);

      // Execute function
      const result = await func(...paramNames.map((name) => args[name]));

      setTestResult(JSON.stringify(result, null, 2));
    } catch (error: any) {
      setTestResult(`Error: ${error.message}`);
    }
  };

  const handleSave = () => {
    if (!validateForm()) return;

    let parametersObject;

    if (advancedMode) {
      // Parse raw parameters
      try {
        parametersObject = JSON.parse(rawParameters);
        if (!parametersObject.type || !parametersObject.properties) {
          setErrors({
            rawParameters:
              "Parameters must have 'type' and 'properties' fields",
          });
          return;
        }
      } catch (e) {
        setErrors({ rawParameters: "Invalid JSON format" });
        return;
      }
    } else {
      // Convert parameters to OpenRouter format
      const properties: Record<string, any> = {};
      const required: string[] = [];

      parameters.forEach((param) => {
        properties[param.name] = {
          type: param.type,
          description: param.description,
        };
        if (param.required) {
          required.push(param.name);
        }
      });

      parametersObject = {
        type: "object",
        properties,
        required,
      };
    }

    const newTool: Tool = {
      id: tool?.id || `tool-${Date.now()}`,
      type: "function",
      function: {
        name,
        description,
        parameters: parametersObject,
      },
      code,
      enabled: tool?.enabled ?? true,
      createdAt: tool?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(newTool);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[80dvw] h-[80dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{tool ? "Edit Tool" : "Create New Tool"}</DialogTitle>
          <DialogDescription>
            {tool
              ? "Define a JavaScript function that the AI can call. The function will execute in your browser."
              : startWithExample
                ? "Start with this hello world example and modify it to create your own tool. The function will execute in your browser."
                : "Define a JavaScript function that the AI can call. The function will execute in your browser."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Tool Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="calculate, format_date, etc."
                  className={cn(errors.name && "border-destructive")}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this tool does and when to use it"
                  rows={2}
                  className={cn(errors.description && "border-destructive")}
                />
                {errors.description && (
                  <p className="text-sm text-destructive">
                    {errors.description}
                  </p>
                )}
              </div>
            </div>

            {/* Parameters */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Parameters</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleAdvancedMode}
                  >
                    {advancedMode ? "Easy Mode" : "Advanced Mode"}
                  </Button>
                  {!advancedMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddParameter}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Parameter
                    </Button>
                  )}
                </div>
              </div>

              {advancedMode ? (
                <div className="space-y-2">
                  <Textarea
                    value={rawParameters}
                    onChange={(e) => setRawParameters(e.target.value)}
                    placeholder='{"type": "object", "properties": {}, "required": []}'
                    rows={12}
                    className={cn(
                      "font-mono text-sm",
                      errors.rawParameters && "border-destructive",
                    )}
                  />
                  {errors.rawParameters && (
                    <p className="text-sm text-destructive">
                      {errors.rawParameters}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Define the parameters schema in JSON format. Must include
                    "type", "properties", and "required" fields.
                  </p>
                </div>
              ) : parameters.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No parameters defined. Click "Add Parameter" to define inputs
                  for your function.
                </p>
              ) : (
                <div className="space-y-4">
                  {parameters.map((param, index) => (
                    <div
                      key={index}
                      className="p-4 border rounded-lg space-y-3"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Name</Label>
                              <Input
                                value={param.name}
                                onChange={(
                                  e: React.ChangeEvent<HTMLInputElement>,
                                ) =>
                                  handleUpdateParameter(
                                    index,
                                    "name",
                                    e.target.value,
                                  )
                                }
                                placeholder="parameter_name"
                                className={cn(
                                  errors[`param-${index}-name`] &&
                                    "border-destructive",
                                )}
                              />
                              {errors[`param-${index}-name`] && (
                                <p className="text-sm text-destructive">
                                  {errors[`param-${index}-name`]}
                                </p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label>Type</Label>
                              <select
                                value={param.type}
                                onChange={(
                                  e: React.ChangeEvent<HTMLSelectElement>,
                                ) =>
                                  handleUpdateParameter(
                                    index,
                                    "type",
                                    e.target.value,
                                  )
                                }
                                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="boolean">Boolean</option>
                                <option value="object">Object</option>
                                <option value="array">Array</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                              value={param.description}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) =>
                                handleUpdateParameter(
                                  index,
                                  "description",
                                  e.target.value,
                                )
                              }
                              placeholder="Describe this parameter"
                              className={cn(
                                errors[`param-${index}-desc`] &&
                                  "border-destructive",
                              )}
                            />
                            {errors[`param-${index}-desc`] && (
                              <p className="text-sm text-destructive">
                                {errors[`param-${index}-desc`]}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`required-${index}`}
                              checked={param.required}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) =>
                                handleUpdateParameter(
                                  index,
                                  "required",
                                  e.target.checked,
                                )
                              }
                              className="h-4 w-4 rounded border-gray-300"
                            />
                            <Label
                              htmlFor={`required-${index}`}
                              className="font-normal"
                            >
                              Required parameter
                            </Label>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveParameter(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Code Editor */}
            <div className="space-y-2">
              <Label htmlFor="code">Function Code</Label>
              <div className="relative">
                <Textarea
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="// Write your function code here"
                  rows={12}
                  className={cn(
                    "font-mono text-sm",
                    errors.code && "border-destructive",
                  )}
                  style={{ tabSize: 2 }}
                />
              </div>
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code}</p>
              )}
              <p className="text-sm text-muted-foreground">
                The function will receive parameters as arguments in the order
                defined above. It must return a value that will be sent back to
                the AI.
              </p>
            </div>

            {/* Test Section */}
            <div className="space-y-4 border-t pt-4 mb-48">
              <h3 className="font-medium">Test Tool</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="test-input">Test Input (JSON)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (advancedMode) {
                        // Parse raw parameters to generate template
                        const parsed = rawToParameters(rawParameters);
                        if (parsed) {
                          const tempParams = parameters;
                          setParameters(parsed);
                          setTestInput(generateTestInputTemplate());
                          setParameters(tempParams);
                        }
                      } else {
                        setTestInput(generateTestInputTemplate());
                      }
                    }}
                    disabled={advancedMode ? false : parameters.length === 0}
                  >
                    Generate Template
                  </Button>
                </div>
                <Textarea
                  id="test-input"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder='{"param1": "value1", "param2": 123}'
                  rows={Math.max(5, parameters.length + 2)}
                  className="font-mono text-sm"
                />
                {parameters.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Template generated based on your parameters. Modify values
                    as needed.
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleTest}
                disabled={!code.trim()}
              >
                <Play className="h-4 w-4 mr-2" />
                Run Test
              </Button>
              {testResult && (
                <div className="space-y-2">
                  <Label>Test Result</Label>
                  <pre
                    className={cn(
                      "p-4 rounded-lg bg-muted text-sm overflow-x-auto",
                      testResult.startsWith("Error:") && "text-destructive",
                    )}
                  >
                    {testResult}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Tool</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
