import { tryParseJson } from "./webSocketClient";

export function* parseSSEEvents(text: string, buffer: { current: string }) {
  // Append new text to buffer
  buffer.current += text;

  // Process complete SSE events (delimited by \n\n)
  const events = buffer.current.split("\n\n");

  // Keep the last item as it might be incomplete
  buffer.current = events.pop() || "";

  // Process all complete events
  for (const event of events) {
    if (event.trim() === "") continue;

    // Extract data from SSE event
    const dataMatch = event.match(/^data: (.+)$/m);
    if (dataMatch) {
      const data = dataMatch[1];
      if (data.trim() === "[DONE]") {
        yield { type: "done" };
      } else {
        // Try to parse as JSON
        const parsed = tryParseJson(data);
        if (parsed !== null) {
          yield { type: "data", parsed };
        } else {
          yield { type: "raw", data };
        }
      }
    }
  }
}
