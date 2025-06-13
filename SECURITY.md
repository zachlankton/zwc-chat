# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of z3chat seriously. If you have discovered a security vulnerability in our project, please report it to us as described below.

### How to Report a Security Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to:

- **Email**: security@z3chat.com (replace with your actual security email)

Please include the following information in your report:

- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

### What to Expect

When you report a vulnerability to us, here's what will happen:

1. **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours.

2. **Investigation**: We will investigate the issue and determine its impact and severity.

3. **Updates**: We will keep you informed about the progress of addressing the vulnerability.

4. **Fix**: We will work on a fix for the vulnerability. For critical issues, we aim to release a patch within 7 days.

5. **Disclosure**: Once the issue is resolved, we will work with you to coordinate the disclosure of the vulnerability.

### Security Best Practices for Contributors

When contributing to z3chat, please keep these security considerations in mind:

1. **Never commit secrets**: Don't commit API keys, passwords, or other sensitive data
2. **Validate inputs**: Always validate and sanitize user inputs
3. **Use HTTPS**: Ensure all external communications use HTTPS
4. **Keep dependencies updated**: Regularly update dependencies to patch known vulnerabilities
5. **Follow authentication best practices**: Use the existing WorkOS authentication system

## Security Features

z3chat implements several security measures:

- **Authentication**: Session-based authentication with WorkOS
- **HTTPS**: All traffic is encrypted using TLS
- **Input Validation**: User inputs are validated and sanitized
- **Secure WebSocket**: WebSocket connections require authenticated sessions
- **Environment Variables**: Sensitive configuration is stored in environment variables

## Responsible Disclosure

We believe in responsible disclosure. If you discover a vulnerability:

- Give us reasonable time to address the issue before public disclosure
- Make a good faith effort to avoid privacy violations, data destruction, and service disruption
- We will acknowledge your contribution in our security advisories (unless you prefer to remain anonymous)

Thank you for helping keep z3chat and our users safe!
