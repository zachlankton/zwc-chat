# ZWC Chat

A modern, real-time chat application with AI integration, built with Bun, React, and WebSockets.

## Features

- 🤖 **Multiple AI Model Support** - Integrate with OpenAI, Anthropic, and other models via OpenRouter
- 💬 **Real-time Streaming** - WebSocket-based streaming for instant AI responses
- 🔐 **Secure Authentication** - WorkOS integration for enterprise-grade auth
- 💾 **Persistent Chat History** - MongoDB-backed chat storage and retrieval
- 🎨 **Modern UI** - React 19 with TailwindCSS v4 and Radix UI components
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices
- 🚀 **High Performance** - Built on Bun runtime for blazing-fast performance
- 🎙️ **Speech Recognition** - Talk to the LLM instead of typing, say 'send message' to send it
- 🗣️ **Text-to-Speech** - Listen to AI responses as they stream in real-time
- 🎯 **System Prompts** - Customize AI behavior with default and per-chat system prompts
- ⤵︎ **Chat Branching** - Branch any chat off into another chat to take the conversation in a different direction
- 💡 **Syntax Highlighting** - Beautiful code blocks with syntax highlighting for multiple languages
- 📎 **Attachment Support** - Upload images and files to include in your conversations
- ✏️ **Message Editing** - Edit and delete individual messages in your conversation
- 🔄 **Message Retry** - Retry AI responses with any model at any point in the conversation
- 🤖 **AI-Generated Titles** - Automatic chat title generation and summaries
- 💳 **Credits System** - Track API usage with visual credits remaining indicator
- 🛠️ **Tool Calling** - Create and manage JavaScript functions that AI can execute locally in your browser
- 🔑 **BYOK (Bring Your Own Key)** - Use your own OpenRouter API key for unlimited access
- 🔄 **Resumable Streams** - WebSocket state syncing with seamless reconnection

## Tech Stack

### Backend

- **Runtime**: [Bun](https://bun.sh/) - Fast all-in-one JavaScript runtime
- **Database**: MongoDB with native driver
- **Authentication**: WorkOS for secure, enterprise-ready auth
- **AI Integration**: OpenRouter API for multiple model support
- **Real-time**: Native Bun WebSocket server
- **Email**: SendGrid for transactional emails

### Frontend

- **Framework**: React 19 with React Router v7
- **Styling**: TailwindCSS v4 with custom design system
- **Components**: Radix UI primitives with shadcn/ui
- **State Management**: TanStack Query for server state
- **Build Tool**: Vite for fast development and optimized builds

## Prerequisites

- [Bun](https://bun.sh/) (latest version)
- MongoDB (local or cloud instance)
- WorkOS account and API keys
- OpenRouter API key
- SendGrid API key (for email functionality)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/zachlankton/zwc-chat.git
cd zwc-chat
```

2. Install dependencies:

```bash
bun install
```

3. Set up environment variables:

Create `.env.development` files in both `apps/api` and `apps/web` directories:

**apps/api/.env.development**

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/zwcchat
WORKOS_API_KEY=your_workos_api_key
WORKOS_CLIENT_ID=your_workos_client_id
WORKOS_REDIRECT_URI=https://localhost:3000/api/auth/callback
SENDGRID_API_KEY=your_sendgrid_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
```

**apps/web/.env.development**

```env
VITE_API_URL=https://localhost:3000
```

4. Start MongoDB (for local development):

```bash
cd apps/api
bun run mongo:start
```

## Development

Run both the API server and web app simultaneously:

```bash
# API server
cd apps/api && bun run dev

# Web app
cd apps/web && bun run dev
```

## Type Checking

```bash
# API TypeScript checking
cd apps/api && bun run check

# Web app TypeScript checking + React Router typegen
cd apps/web && bun run typecheck
```

## Building for Production

Build both applications:

```bash
# From root directory
bun run build

# Or individually
cd apps/api && bun run build
cd apps/web && bun run build
```

## Docker Support

Both applications include Dockerfiles for containerized deployment:

```bash
# Build API container
cd apps/api
docker build -t zwc-chat-api .

# Build web container
cd apps/web
docker build -t zwc-chat-web .
```

## Project Structure

```
zwc-chat/
├── apps/
│   ├── api/              # Backend API server
│   │   ├── src/          # Source code
│   │   ├── lib/          # Shared utilities
│   │   └── Dockerfile    # API container configuration
│   └── web/              # React frontend
│       ├── app/          # Application code
│       ├── public/       # Static assets
│       └── Dockerfile    # Web container configuration
├── packages/             # Shared packages (future use)
├── bun.lockb            # Bun lock file
└── package.json         # Root package configuration
```

## API Endpoints

- `/api/auth/login` - WorkOS authentication
- `/api/auth/callback` - OAuth callback handler
- `/api/auth/logout` - Session cleanup
- `/api/auth/session` - Current user session
- `/api/chat` - Chat management (CRUD operations)
- `/api/chat/[chatId]` - Individual chat operations
- `/api/users` - User management
- `/api/models` - Available AI models
- `/api/title` - Generate chat titles
- `/api/ws` - WebSocket endpoint for real-time streaming

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Security

For security concerns, please review our [Security Policy](SECURITY.md).

## Acknowledgments

- Built with [Bun](https://bun.sh/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

## Roadmap

- 👥 **Admin Panel** - User management interface for administrators
- 👤 **User Profile** - Settings page with subscription management

---

Made with ❤️ by the ZWCChat team
