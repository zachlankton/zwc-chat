// OpenRouter-compatible tool types
export interface ToolFunction {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<
      string,
      {
        type: "string" | "number" | "boolean" | "object" | "array";
        description: string;
        items?: { type: string };
        enum?: string[];
      }
    >;
    required: string[];
  };
}

export interface Tool {
  id: string;
  type: "function";
  function: ToolFunction;
  // Custom fields for browser-based implementation
  code: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// Tool execution types
export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
}

// OpenRouter tool call types
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

// Tool message type
export interface ToolMessage {
  role: "tool";
  tool_call_id: string;
  name: string;
  content: string; // JSON string of result
}
