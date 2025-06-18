import { CodeBlock } from "~/components/chat/code/CodeBlock";

// Shared ReactMarkdown components configuration
export const markdownComponents = {
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {children}
    </a>
  ),
  code: ({ children, className }: any) => {
    const childrenStr = typeof children === "string";
    const multiLine = childrenStr ? children.includes("\n") : false;
    const isInline = !className?.includes("language-") && !multiLine;
    if (isInline) {
      return (
        <code className="px-1 py-0.5 bg-primary text-primary-foreground rounded text-sm">
          {children}
        </code>
      );
    }
    return <CodeBlock>{children}</CodeBlock>;
  },
};
