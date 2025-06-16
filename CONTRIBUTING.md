# Contributing to ZWCChat

First off, thank you for considering contributing to ZWCChat! It's people like you that make ZWCChat such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by the [ZWCChat Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- Use a clear and descriptive title
- Describe the exact steps which reproduce the problem
- Provide specific examples to demonstrate the steps
- Describe the behavior you observed after following the steps
- Explain which behavior you expected to see instead and why
- Include screenshots if relevant
- Include your environment details (OS, Bun version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- Use a clear and descriptive title
- Provide a step-by-step description of the suggested enhancement
- Provide specific examples to demonstrate the steps
- Describe the current behavior and explain which behavior you expected to see instead
- Explain why this enhancement would be useful

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code follows the existing code style
6. Issue that pull request!

## Development Process

### Setting Up Your Development Environment

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Set up your environment variables (see README.md)
4. Start MongoDB for local development:
   ```bash
   cd apps/api
   bun run mongo:start
   ```
5. Run the development servers:
   ```bash
   bun run dev:api
   bun run dev:web
   ```

### Code Style

- Use TypeScript for all new code
- Follow the existing code formatting (we recommend using Prettier)
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Write self-documenting code where possible

### Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Test your changes manually in both development and production builds
- Check for console errors and warnings

### Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line
- Consider starting the commit message with an applicable emoji:
  - 🎨 `:art:` when improving the format/structure of the code
  - 🐛 `:bug:` when fixing a bug
  - 🔥 `:fire:` when removing code or files
  - 📝 `:memo:` when writing docs
  - 🚀 `:rocket:` when improving performance
  - ✨ `:sparkles:` when introducing new features

### Branch Naming

Use descriptive branch names:

- `feature/add-user-profiles`
- `fix/websocket-connection-issue`
- `docs/update-api-documentation`
- `refactor/optimize-chat-rendering`

## Project Structure

Please maintain the existing project structure:

```
zwc-chat/
├── apps/
│   ├── api/        # Backend code
│   └── web/        # Frontend code
├── packages/       # Shared packages
└── docs/          # Documentation
```

## API Design Guidelines

- Follow RESTful principles where applicable
- Use consistent naming conventions
- Implement proper error handling
- Add appropriate TypeScript types
- Document new endpoints in the code

## Frontend Guidelines

- Use React hooks and functional components
- Follow the existing component structure
- Use TailwindCSS for styling
- Ensure responsive design
- Test on multiple browsers

## Questions?

Feel free to open an issue with your question or reach out to the maintainers.

Thank you for contributing! 🎉
