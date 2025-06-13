# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Development

```bash
# Start both API and web servers simultaneously (run from root)
bun run dev:api  # API server on https://localhost:3000
bun run dev:web  # Web app on https://localhost:5173

# Or run individually from their directories
cd apps/api && bun run dev
cd apps/web && bun run dev
```

### MongoDB Local Development

```bash
cd apps/api
bun run mongo:start   # Create/start local MongoDB container
bun run mongo:stop    # Stop MongoDB container
bun run mongo:delete  # Delete MongoDB container and data
```

### Build & Type Checking

```bash
# Build both apps (from root)
bun run build

# Type checking
cd apps/api && bun run check      # TypeScript check for API
cd apps/web && bun run typecheck  # TypeScript check + React Router typegen
```

### Environment Variables

- API uses `.env.development` for dev mode (or `.env` with `dev:local` script)
- Both apps require environment-specific configuration
- API needs: MongoDB URI, WorkOS keys, SendGrid API key, OpenRouter API key

## Architecture Overview

This is a **monorepo** chat application with AI integration:

- **apps/api**: Bun-based backend with WebSocket support for real-time chat streaming
- **apps/web**: React 19 SPA with React Router v7 (SSR disabled)
- **packages**: Shared packages directory (currently unused)

### Key Technologies

- **Backend**: Bun runtime, MongoDB driver, OpenAI/Anthropic SDKs, WorkOS auth, WebSockets
- **Frontend**: React 19, TailwindCSS v4, Radix UI/shadcn components, TanStack Query
- **Real-time**: Native Bun WebSocket server for chat streaming
- **Auth**: Session-based authentication with MongoDB backing

### API Route Structure

```text
/api/auth/login      - WorkOS authentication
/api/auth/callback   - OAuth callback
/api/auth/logout     - Session cleanup
/api/auth/session    - Current user session
/api/chat           - Chat management endpoints
/api/chat/[chatId]  - Specific chat operations
/api/users          - User management
```

### Current Feature Status

The application is implementing chat persistence (see PERSISTCHATS.md for detailed plan):

- ✅ WebSocket streaming with OpenRouter
- ✅ Session-based authentication
- ✅ Real-time message streaming
- ✅ Markdown rendering with syntax highlighting
- 🚧 Message persistence to MongoDB (in progress on `persist-user-chats` branch)
- 🚧 Chat history and management

### Important Implementation Notes

1. **WebSocket Messages**: Messages are created as `OpenRouterMessage` objects with full metadata
2. **Streaming**: Uses raw ArrayBuffer responses to avoid serialization overhead
3. **Session Management**: MongoDB-backed sessions with in-memory cache
4. **SSL**: Self-signed certificates for local HTTPS development
5. **Deployment**: Dockerfiles configured for both apps
