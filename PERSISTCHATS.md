# Chat Persistence Implementation Plan

## Overview
This document outlines the comprehensive plan for implementing full chat persistence in the z3chat application. The system will store all chat messages in MongoDB, provide CRUD endpoints for chat management, and update the frontend to support chat history and multiple conversations.

## Current State Analysis

### Already Implemented:
- **MongoDB Infrastructure**: Connection pooling and session management
- **OpenRouterMessage Interface**: Complete message schema with all necessary fields
- **Chat API**: POST endpoint with OpenRouter integration and streaming
- **WebSocket Server**: Real-time streaming with message object creation
- **Frontend Chat UI**: Complete interface with markdown rendering and syntax highlighting
- **Authentication**: Session-based auth with MongoDB backing

### Missing Components:
- Message persistence to database
- Chat history retrieval
- Chat management (create, list, delete)
- Frontend chat switching and history loading

## Implementation Tasks

### Phase 1: Database Layer (Backend)

#### 1.1 Create Messages Collection
```typescript
// In database.ts
- Create messages collection with proper typing
- Add compound indexes:
  - { userEmail: 1, chatId: 1, timestamp: -1 }
  - { chatId: 1, timestamp: -1 }
  - { userEmail: 1, timestamp: -1 }
```

#### 1.2 Create Chats Collection
```typescript
interface Chat {
  id: string;
  userEmail: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: string;
  messageCount: number;
}
```

### Phase 2: Message Persistence (Backend)

#### 2.1 Update WebSocket Handler
- Modify `websockets.ts` to save messages after streaming completes
- Save both user messages and assistant responses
- Update message with final token counts and timing data

#### 2.2 Update Chat POST Endpoint
- Ensure messages are saved even if WebSocket fails
- Add error handling for persistence failures

### Phase 3: API Endpoints (Backend)

#### 3.1 GET /api/chat
- List all chats for authenticated user
- Include last message preview and message count
- Sort by most recent activity
- Pagination support (limit/offset)

Response format:
```json
{
  "chats": [
    {
      "id": "chat-id",
      "title": "Chat about React hooks",
      "lastMessage": "Sure, I can explain useEffect...",
      "updatedAt": "2024-01-10T12:00:00Z",
      "messageCount": 15
    }
  ],
  "total": 50,
  "limit": 20,
  "offset": 0
}
```

#### 3.2 GET /api/chat/[chatId]
- Fetch all messages for a specific chat
- Verify user owns the chat
- Include all message metadata
- Pagination for large conversations

Response format:
```json
{
  "chatId": "chat-id",
  "messages": [
    {
      "id": "msg-id",
      "role": "user",
      "content": "Hello",
      "timestamp": "2024-01-10T12:00:00Z"
    }
  ],
  "hasMore": false
}
```

#### 3.3 DELETE /api/chat/[chatId]
- Soft delete or hard delete chat and all messages
- Verify user owns the chat
- Return success/failure status

#### 3.4 PUT /api/chat/[chatId]
- Update chat metadata (title, etc.)
- Auto-generate title from first message if not provided
- Update lastMessage and updatedAt

### Phase 4: Frontend Updates

#### 4.1 Chat State Management
- Add chat list state to session store
- Add current chatId state
- Add messages cache by chatId

#### 4.2 Chat List Component
```typescript
// components/chat-list.tsx
- Display list of user's chats in sidebar
- Show title, last message preview, date
- Highlight active chat
- Search/filter functionality
```

#### 4.3 Chat History Loading
- Load messages when chat is selected
- Implement infinite scroll for long conversations
- Show loading states
- Handle empty states

#### 4.4 Chat Creation and Switching
- "New Chat" button in sidebar
- Generate unique chatId (nanoid)
- Update URL to include chatId
- Persist chatId in URL for sharing

#### 4.5 Update Chat Interface
- Remove hardcoded chatId
- Use dynamic chatId from URL/state
- Auto-save messages as they stream
- Show save status indicators

### Phase 5: Enhanced Features (Future)

#### 5.1 Search
- Full-text search across all messages
- Filter by date range
- Search within specific chats

#### 5.2 Export/Import
- Export chat as markdown
- Export as JSON
- Import previous conversations

#### 5.3 Sharing
- Generate shareable links
- Public/private chat settings
- Collaboration features

## Migration Strategy

1. **Deploy database changes first** (backward compatible)
2. **Add message saving** without breaking existing functionality
3. **Deploy new endpoints** one at a time
4. **Update frontend** incrementally with feature flags
5. **Migrate any existing data** if necessary

## Testing Requirements

### Backend Tests
- Message persistence verification
- API endpoint authorization tests
- Pagination edge cases
- Database index performance

### Frontend Tests
- Chat switching functionality
- Message loading and caching
- Error state handling
- Real-time updates

## Performance Considerations

1. **Database Indexes**: Ensure proper indexes for common queries
2. **Message Pagination**: Limit message fetching to prevent large payloads
3. **Caching Strategy**: Cache recent chats and messages in frontend
4. **WebSocket Optimization**: Batch message saves if needed

## Security Considerations

1. **Authorization**: Verify user owns chat before any operation
2. **Input Validation**: Sanitize all user inputs
3. **Rate Limiting**: Prevent spam and abuse
4. **Data Privacy**: Ensure users can only access their own data

## Timeline Estimate

- **Phase 1**: 2-3 hours (Database setup)
- **Phase 2**: 3-4 hours (Message persistence)
- **Phase 3**: 4-6 hours (API endpoints)
- **Phase 4**: 6-8 hours (Frontend updates)
- **Testing**: 3-4 hours

**Total**: ~18-25 hours for full implementation

## Success Metrics

1. All messages are persisted successfully
2. Chat history loads within 200ms
3. No message loss during streaming
4. Smooth chat switching experience
5. Zero unauthorized data access