import * as React from "react";
import { Send, Paperclip, Mic, Copy, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

function CodeBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const codeRef = React.useRef<HTMLElement>(null);

  const handleCopy = async () => {
    navigator.clipboard.writeText(codeRef?.current?.textContent ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(
          codeRef?.current?.textContent ?? "",
        );
        setCopied(true);
      } catch (_) {
        /* noop – could toast */
      }
    } else {
      // fallback for http / older browsers
      const textarea = document.createElement("textarea");
      textarea.value = codeRef?.current?.textContent ?? "";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
    }
  };

  return (
    <div className="relative group">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <pre className={cn("hljs", className)}>
          <code ref={codeRef}>{children}</code>
        </pre>
      </div>
    </div>
  );
}

// Streaming demo content
const DEMO_STREAMING_MESSAGE = `I'll analyze this for you! Here's a comprehensive example with **markdown**, code, and more:

## Understanding React Hooks

React hooks are functions that let you "hook into" React features. Here are the most common ones:

### 1. useState Hook
The \`useState\` hook lets you add state to functional components:

\`\`\`javascript
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
\`\`\`

### 2. useEffect Hook
The \`useEffect\` hook lets you perform side effects:

\`\`\`javascript
useEffect(() => {
  // This runs after every render
  document.title = \`Count: \${count}\`;
  
  // Cleanup function (optional)
  return () => {
    console.log('Cleanup!');
  };
}, [count]); // Only re-run if count changes
\`\`\`

### Key Benefits:
- **Simpler code** - No need for class components
- **Better logic reuse** - Custom hooks share stateful logic
- **Easier testing** - Functions are easier to test than classes

> **Pro tip:** Always follow the Rules of Hooks - only call hooks at the top level and only from React functions!

Would you like me to explain any specific hook in more detail?`;

export function ChatInterface() {
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "1",
      content:
        "Hello! I can help you with **programming**, *markdown formatting*, and more. What would you like to know?",
      role: "assistant",
      timestamp: new Date(Date.now() - 3600000),
    },
    {
      id: "2",
      content:
        "Can you show me how to create a React component with TypeScript?",
      role: "user",
      timestamp: new Date(Date.now() - 3000000),
    },
    {
      id: "3",
      content: `Sure! Here's a complete example of a React component with TypeScript:

## Basic Function Component

\`\`\`typescript
import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  label, 
  onClick, 
  variant = 'primary',
  disabled = false 
}) => {
  return (
    <button
      className={\`btn btn-\${variant}\`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};

export default Button;
\`\`\`

### Key Features:
1. **Type Safety** - Props are fully typed
2. **Default Values** - Using ES6 default parameters
3. **Optional Props** - marked with \`?\`

### Usage Example:

\`\`\`tsx
<Button 
  label="Click me!" 
  onClick={() => console.log('Clicked!')}
  variant="primary"
/>
\`\`\`

You can also create more complex components with hooks:

\`\`\`typescript
import React, { useState, useEffect } from 'react';

const Counter: React.FC = () => {
  const [count, setCount] = useState<number>(0);
  
  useEffect(() => {
    document.title = \`Count: \${count}\`;
  }, [count]);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
};
\`\`\``,
      role: "assistant",
      timestamp: new Date(Date.now() - 2400000),
    },
    {
      id: "4",
      content:
        "That's helpful! Can you also show me a Python example with some data analysis?",
      role: "user",
      timestamp: new Date(Date.now() - 1800000),
    },
    {
      id: "5",
      content: `Of course! Here's a Python data analysis example using pandas and matplotlib:

## Data Analysis with Python

\`\`\`python
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Create sample data
data = {
    'Month': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    'Sales': [45000, 52000, 48000, 61000, 58000, 67000],
    'Expenses': [35000, 38000, 36000, 42000, 40000, 45000]
}

# Create DataFrame
df = pd.DataFrame(data)

# Calculate profit
df['Profit'] = df['Sales'] - df['Expenses']

# Basic statistics
print("Sales Statistics:")
print(df['Sales'].describe())
print("\\nProfit Margin:")
df['Profit_Margin'] = (df['Profit'] / df['Sales']) * 100
print(df[['Month', 'Profit_Margin']])

# Visualization
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

# Bar chart
ax1.bar(df['Month'], df['Sales'], label='Sales', alpha=0.7)
ax1.bar(df['Month'], df['Expenses'], label='Expenses', alpha=0.7)
ax1.set_title('Monthly Sales vs Expenses')
ax1.set_ylabel('Amount ($)')
ax1.legend()

# Line chart
ax2.plot(df['Month'], df['Profit'], marker='o', linewidth=2)
ax2.set_title('Monthly Profit Trend')
ax2.set_ylabel('Profit ($)')
ax2.grid(True, alpha=0.3)

plt.tight_layout()
plt.show()
\`\`\`

### Output Example:
\`\`\`
Sales Statistics:
count        6.000000
mean     55166.666667
std       7943.280813
min      45000.000000
25%      48750.000000
50%      55000.000000
75%      60250.000000
max      67000.000000

Profit Margin:
  Month  Profit_Margin
0   Jan      22.222222
1   Feb      26.923077
2   Mar      25.000000
3   Apr      31.147541
4   May      31.034483
5   Jun      32.835821
\`\`\`

This example demonstrates:
- **Data manipulation** with pandas
- **Statistical analysis** using describe()
- **Data visualization** with matplotlib
- **Profit calculation** and margin analysis`,
      role: "assistant",
      timestamp: new Date(Date.now() - 600000),
    },
  ]);

  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [streamingMessageId, setStreamingMessageId] = React.useState<
    string | null
  >(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollNewMessage = () => {
    // Get all elements with the class and take the last one
    const elements = document.querySelectorAll(".user-message");
    const lastElement = elements[elements.length - 1];
    if (!lastElement) return;
    lastElement.parentElement?.parentElement?.parentElement?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textRef.current) return;
    const input = textRef.current.value ?? "";
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    textRef.current.value = "";
    setIsLoading(true);

    // Create empty assistant message to start streaming
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: "",
      role: "assistant",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setStreamingMessageId(assistantMessage.id);
    setTimeout(scrollNewMessage, 100);

    // Simulate streaming response
    const tokens = DEMO_STREAMING_MESSAGE.split("");
    let currentIndex = 0;

    const streamInterval = setInterval(() => {
      if (currentIndex < tokens.length) {
        // Add next token
        const nextToken =
          tokens[currentIndex] + (currentIndex < tokens.length - 1 ? "" : "");
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? { ...msg, content: msg.content + nextToken }
              : msg,
          ),
        );
        currentIndex++;
      } else {
        // Streaming complete
        clearInterval(streamInterval);
        setIsLoading(false);
        setStreamingMessageId(null);
      }
    }, 50); // 50ms between tokens for smooth streaming effect
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 py-4",
                message.role === "user" ? "flex-row-reverse" : "",
              )}
            >
              <Avatar className="h-8 w-8">
                {message.role === "assistant" ? (
                  <>
                    <AvatarImage src="/ai-avatar.png" />
                    <AvatarFallback>AI</AvatarFallback>
                  </>
                ) : (
                  <>
                    <AvatarImage src="/user-avatar.png" />
                    <AvatarFallback>U</AvatarFallback>
                  </>
                )}
              </Avatar>
              <div
                className={cn(
                  "flex-1 space-y-2",
                  message.role === "user" ? "flex flex-col items-end" : "",
                )}
              >
                <div
                  className={cn(
                    "rounded-lg px-4 py-2 max-w-[80%]",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                  )}
                >
                  {message.role === "user" ? (
                    <p className="text-sm whitespace-pre-wrap user-message">
                      {message.content}
                    </p>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          code: ({ children, className }) => {
                            const isInline = !className;

                            if (isInline) {
                              return (
                                <code className="px-1 py-0.5 bg-primary text-primary-foreground rounded text-sm">
                                  {children}
                                </code>
                              );
                            }

                            return (
                              <CodeBlock className={className}>
                                {children}
                              </CodeBlock>
                            );
                          },
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                      {isLoading && streamingMessageId === message.id ? (
                        <div className="flex gap-3 py-4">
                          <div className="flex-1">
                            <div className="bg-muted rounded-lg px-4 py-2 max-w-[80%]">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {message.timestamp.toLocaleTimeString()}
                </p>
                {isLoading && streamingMessageId === message.id ? (
                  <div className="h-lvh" />
                ) : null}
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-background">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-4">
          <div className="flex gap-2 items-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <div className="flex-1 relative">
              <Textarea
                ref={textRef}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="min-h-[60px] max-h-[200px] pr-12 resize-none"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                className="absolute bottom-2 right-2 h-8 w-8"
                disabled={isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
            >
              <Mic className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}
