# Multiple Models Implementation Plan

## Overview
This document outlines the implementation plan for supporting multiple AI models through OpenRouter's API, allowing users to switch between models during conversations and see which model generated each response.

## Current State
- Single hardcoded model: `deepseek/deepseek-r1-0528-qwen3-8b:free`
- Model is defined in `/apps/api/api/chat/[chatId]/route.ts:25`
- No UI for model selection
- No model information stored with messages

## Implementation Plan

### Phase 1: Backend API for Model Management

#### 1.1 Create Models Endpoint
**File**: `/apps/api/api/models/route.ts`

```typescript
GET /api/models
```

**Features**:
- Fetch models from OpenRouter API (`https://openrouter.ai/api/v1/models`)
- Cache the results with a TTL (e.g., 1 hour) to reduce API calls
- Return a curated list with favorites marked
- Include model metadata (pricing, context length, capabilities)

**Response Structure**:
```typescript
{
  favorites: [
    {
      id: "anthropic/claude-3-5-sonnet",
      name: "Claude 3.5 Sonnet",
      contextLength: 200000,
      pricing: { prompt: "0.003", completion: "0.015" },
      capabilities: ["text", "vision"],
      description: "Most intelligent model..."
    }
  ],
  all: [
    // All available models from OpenRouter
  ]
}
```

#### 1.2 Curated Favorites List
**File**: `/apps/api/lib/modelConfig.ts`

Define a curated list of favorite models:
```typescript
export const FAVORITE_MODELS = [
  "anthropic/claude-3-5-sonnet",
  "openai/gpt-4o",
  "google/gemini-2.0-flash-exp",
  "deepseek/deepseek-r1",
  "anthropic/claude-3-5-haiku",
  "meta-llama/llama-3.3-70b-instruct",
  "x-ai/grok-2-1212"
];
```

### Phase 2: Update Chat API

#### 2.1 Modify Chat Message Structure
**File**: `/apps/api/lib/server-types.ts`

Update `OpenRouterMessage` type:
```typescript
export type OpenRouterMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  model?: string; // Add model field
  timestamp: Date;
  // ... existing fields
};
```

#### 2.2 Update Chat POST Handler
**File**: `/apps/api/api/chat/[chatId]/route.ts`

Changes:
- Accept `model` parameter in request body
- Validate model against available models
- Use the requested model or fall back to default
- Store the model with each assistant message

```typescript
const { messages, model = DEFAULT_MODEL } = await request.json();

// Validate model exists
const isValidModel = await validateModel(model);
if (!isValidModel) {
  return new Response("Invalid model", { status: 400 });
}

// Use the model in OpenRouter request
const openRouterResponse = await fetch(OPENROUTER_API_URL, {
  // ...
  body: JSON.stringify({
    model,  // Use dynamic model
    messages: formattedMessages,
    stream: true,
  }),
});
```

### Phase 3: Frontend Implementation

#### 3.1 Model Selector Component
**File**: `/apps/web/app/components/model-selector.tsx`

Create a dropdown/modal component that:
- Fetches available models from `/api/models`
- Shows favorites at the top with a separator
- Displays model info (context length, pricing)
- Allows searching/filtering models
- Shows current model selection

#### 3.2 Update Chat Interface
**File**: `/apps/web/app/components/chat-interface.tsx`

- Add model selector above or beside the input field
- Pass selected model with chat requests
- Store selected model in component state
- Persist last selected model in localStorage

#### 3.3 Update Chat Input
**File**: `/apps/web/app/components/chat-input.tsx`

Modify to accept and use selected model:
```typescript
interface ChatInputProps {
  onSendMessage: (message: string, model: string) => void;
  selectedModel: string;
  // ... existing props
}
```

#### 3.4 Display Model in Messages
**File**: `/apps/web/app/components/chat-interface.tsx`

Show which model was used for each assistant message:
- Small badge/label with model name
- Tooltip with full model details
- Different styling for different model providers

### Phase 4: WebSocket Updates

#### 4.1 Extract Model from Streaming Response
**File**: `/apps/api/lib/websockets.ts`

The model information is already included in the OpenRouter streaming response! The `EventType` interface (line 269) shows that each event includes:

```typescript
interface EventType {
  id: string;
  provider: string;
  model: string;  // Model is already here!
  // ... other fields
}
```

#### 4.2 Update Message Parsing to Capture Model
**File**: `/apps/api/lib/websockets.ts`

Update the `parseStreamingChunks` function to extract the model:

```typescript
function parseStreamingChunks(
  dataChunks: number[],
  newMessage: OpenRouterMessage
): void {
  const view = new Uint8Array(dataChunks);
  const text = txtDecoder.decode(view);
  const chunks = text.split("data: ");
  if (chunks[0] === "") chunks.shift();

  for (const chunk of chunks) {
    if (chunk[0] === "{") {
      const value = tryParseJson(chunk) as EventType;
      if (!value) continue;

      // Extract model information (ADD THIS)
      if (value.model && !newMessage.model) {
        newMessage.model = value.model;
      }

      // Extract usage information (existing)
      const usage = value?.usage;
      if (usage) {
        newMessage.promptTokens = usage.prompt_tokens;
        newMessage.completionTokens = usage.completion_tokens;
        newMessage.totalTokens = usage.total_tokens;
      }

      // ... rest of existing parsing logic
    }
  }
}
```

#### 4.3 No Changes Needed in Chat Route
Since the model information comes from OpenRouter's response, we don't need to pass it through headers or context. The chat route just needs to:
1. Accept the model parameter from the client
2. Use it in the OpenRouter API request
3. Let the streaming response carry the model information back

#### 4.4 Frontend Model Display
The frontend can:
- Show the selected model in the UI while streaming
- After the message is saved and retrieved from the database, display the actual model used (in case of fallbacks or model changes)

### Phase 5: Model Management Features

#### 5.1 Model Switching Mid-Conversation
- Allow users to change models between messages
- Each message tracks which model was used
- No need to restart conversations

#### 5.2 Model Comparison
- Option to send the same prompt to multiple models
- Side-by-side response comparison
- Cost tracking per model

#### 5.3 Model Preferences
- Save user's favorite models
- Default model selection per user
- Quick switch between recently used models

## Implementation Order

1. **Backend Models API** (Phase 1)
   - Create `/api/models` endpoint
   - Implement caching and favorites

2. **Update Message Structure** (Phase 2.1)
   - Add model field to types
   - Update database schema if needed

3. **Basic Model Selection** (Phase 3.1-3.3)
   - Create model selector UI
   - Integrate with chat input
   - Pass model to API

4. **Update Chat Handler** (Phase 2.2)
   - Accept dynamic model parameter
   - Validate and use selected model

5. **Display Model Info** (Phase 3.4)
   - Show model used in chat history
   - Add visual indicators

6. **Advanced Features** (Phase 5)
   - Model comparison
   - User preferences
   - Cost tracking

## Testing Considerations

1. **API Testing**
   - Mock OpenRouter models response
   - Test model validation
   - Test fallback behavior

2. **UI Testing**
   - Model selector interaction
   - Model persistence across sessions
   - Error handling for invalid models

3. **Integration Testing**
   - End-to-end chat with different models
   - Model switching mid-conversation
   - WebSocket message handling

## Security Considerations

1. **Model Validation**
   - Validate model IDs against whitelist
   - Prevent injection attacks
   - Rate limit model list API

2. **Cost Management**
   - Track usage per model
   - Implement spending limits
   - Show cost estimates before sending

## Future Enhancements

1. **Smart Model Selection**
   - Recommend models based on task
   - Auto-select based on context length
   - Cost/performance optimization

2. **Model Analytics**
   - Track model performance
   - User satisfaction per model
   - Response time analytics

3. **Custom Model Configs**
   - Temperature/parameter presets
   - Model-specific prompts
   - Custom system messages per model