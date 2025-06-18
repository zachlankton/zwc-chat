export function EmptyChat({
  handleSubmit,
}: {
  handleSubmit: (
    input: string,
    attachments: File[],
    includeWebSearch?: boolean,
  ) => Promise<void>;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
      <div className="rounded-full bg-primary/10 p-6 mb-6">
        <svg
          className="h-12 w-12 text-primary"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </div>

      <h2 className="text-2xl font-semibold mb-2">Start a conversation</h2>
      <p className="text-muted-foreground max-w-md">
        Ask me anything! I'm here to help with coding, analysis, creative
        writing, and more.
      </p>
      <div className="grid grid-cols-2 gap-3 mt-8 w-full max-w-2xl">
        <button
          onClick={() => handleSubmit("What can you help me with?", [])}
          className="text-left p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-medium mb-1">Capabilities</h3>
          <p className="text-sm text-muted-foreground">Learn what I can do</p>
        </button>
        <button
          onClick={() => handleSubmit("Help me write code", [])}
          className="text-left p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-medium mb-1">Code Assistant</h3>
          <p className="text-sm text-muted-foreground">Write and debug code</p>
        </button>
        <button
          onClick={() => handleSubmit("Help me analyze data", [])}
          className="text-left p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-medium mb-1">Data Analysis</h3>
          <p className="text-sm text-muted-foreground">
            Analyze and visualize data
          </p>
        </button>
        <button
          onClick={() => handleSubmit("Help me brainstorm ideas", [])}
          className="text-left p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-medium mb-1">Creative Writing</h3>
          <p className="text-sm text-muted-foreground">
            Brainstorm and create content
          </p>
        </button>
      </div>
    </div>
  );
}
