import type { Tool, ToolCall, ToolExecutionResult } from "~/types/tools";

// Maximum execution time for a tool (5 seconds)
const MAX_EXECUTION_TIME = 5000;

/**
 * Execute a tool call with the provided arguments
 */
export async function executeTool(
  tool: Tool,
  args: Record<string, any>,
): Promise<ToolExecutionResult> {
  try {
    // Validate required parameters
    for (const requiredParam of tool.function.parameters.required) {
      if (!(requiredParam in args)) {
        return {
          success: false,
          error: `Missing required parameter: ${requiredParam}`,
        };
      }
    }

    // Extract parameter names in order
    const paramNames = Object.keys(tool.function.parameters.properties);

    // Create a promise that will timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Tool execution timeout")),
        MAX_EXECUTION_TIME,
      );
    });

    // Create the execution promise
    const executionPromise = new Promise((resolve, reject) => {
      try {
        // Create isolated function with parameters
        const func = new Function(...paramNames, tool.code);

        // Call function with arguments in correct order
        const orderedArgs = paramNames.map((name) => args[name]);
        const result = func(...orderedArgs);

        // Handle async results
        if (result instanceof Promise) {
          result.then(resolve).catch(reject);
        } else {
          resolve(result);
        }
      } catch (error) {
        reject(error);
      }
    });

    // Race between execution and timeout
    const result = await Promise.race([executionPromise, timeoutPromise]);

    return {
      success: true,
      result,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Unknown error occurred",
    };
  }
}

/**
 * Execute multiple tool calls from an AI response
 */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  availableTools: Tool[],
): Promise<Array<{ tool_call_id: string; name: string; content: string }>> {
  const results = [];

  for (const toolCall of toolCalls) {
    // Find the matching tool
    const tool = availableTools.find(
      (t) => t.function.name === toolCall.function.name && t.enabled,
    );

    if (!tool) {
      results.push({
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify({
          error: `Tool not found or disabled: ${toolCall.function.name}`,
        }),
      });
      continue;
    }

    try {
      // Parse arguments
      const args = JSON.parse(toolCall.function.arguments);

      // Execute the tool
      const executionResult = await executeTool(tool, args);

      results.push({
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify(
          executionResult.success
            ? executionResult.result
            : { error: executionResult.error },
        ),
      });
    } catch (error: any) {
      results.push({
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify({
          error: `Failed to parse arguments: ${error.message}`,
        }),
      });
    }
  }

  return results;
}

/**
 * Format tools for the API request
 */
export function formatToolsForAPI(tools: Tool[]) {
  return tools
    .filter((tool) => tool.enabled)
    .map((tool) => ({
      type: "function" as const,
      function: tool.function,
    }));
}
