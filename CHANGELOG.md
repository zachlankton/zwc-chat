# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial open source release
- WebSocket-based real-time chat streaming
- Multi-model AI support (OpenAI, Anthropic, etc.) via OpenRouter
- Session-based authentication with WorkOS
- Modern React 19 frontend with TailwindCSS v4
- Markdown message rendering with syntax highlighting
- Self-signed SSL for local development
- MongoDB integration for data persistence
- Docker deployment configuration

### Changed

- Migrated from HTTP streaming to WebSocket architecture for better performance
- Refactored message handling to prevent stale closure issues

### Security

- Implemented secure session management
- Added environment variable protection for sensitive data
- WebSocket connections require authenticated sessions

## [0.1.0] - 2025-06-13

### Added

- Initial project setup with Bun runtime
- Basic chat interface with AI streaming
- Authentication system with WorkOS integration
- Project documentation (README, LICENSE, CONTRIBUTING)

[Unreleased]: https://github.com/zachlankton/zwc-chat/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/zachlankton/zwc-chat/releases/tag/v0.1.0
