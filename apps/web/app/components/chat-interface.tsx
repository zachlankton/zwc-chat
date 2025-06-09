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
  children: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const language = className?.replace("language-", "") || "text";

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <code>{children}</code>
        </pre>
      </div>
    </div>
  );
}

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
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `I'll help you with that! Here's a quick example:

\`\`\`javascript
// Example code
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

Is there anything specific you'd like to know?`,
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
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
                    <p className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </p>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          pre: ({ children, ...props }) => (
                            <pre {...props} className="not-prose">
                              {children}
                            </pre>
                          ),
                          code: ({ children, className, ...props }) => {
                            const isInline = !className;
                            
                            // Extract text content from children
                            const getTextContent = (node: React.ReactNode): string => {
                              if (typeof node === 'string') return node;
                              if (typeof node === 'number') return String(node);
                              if (Array.isArray(node)) return node.map(getTextContent).join('');
                              if (React.isValidElement(node)) {
                                const element = node as React.ReactElement<{children?: React.ReactNode}>;
                                if (element.props?.children) {
                                  return getTextContent(element.props.children);
                                }
                              }
                              return '';
                            };
                            
                            if (isInline) {
                              return (
                                <code
                                  className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm"
                                  {...props}
                                >
                                  {children}
                                </code>
                              );
                            }
                            
                            const codeContent = getTextContent(children).replace(/\n$/, "");
                            return (
                              <CodeBlock className={className}>
                                {codeContent}
                              </CodeBlock>
                            );
                          },
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 py-4">
              <Avatar className="h-8 w-8">
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
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
          )}
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
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="min-h-[60px] max-h-[200px] pr-12 resize-none"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                className="absolute bottom-2 right-2 h-8 w-8"
                disabled={!input.trim() || isLoading}
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

