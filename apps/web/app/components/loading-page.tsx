import { cn } from "~/lib/utils";

export function LoadingPage() {
  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="relative">
        {/* Main loading spinner */}
        <div className="relative w-32 h-32 m-auto">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-4 border-muted animate-pulse" />

          {/* Spinning gradient ring */}
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary animate-spin [animation-duration:1.5s]" />

          {/* Inner spinning ring */}
          <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-primary/50 border-l-primary/50 animate-spin [animation-duration:3s] [animation-direction:reverse]" />

          {/* Center dot */}
          <div className="absolute inset-8 rounded-full bg-primary/20 animate-pulse" />
          <div className="absolute inset-10 rounded-full bg-primary animate-pulse [animation-delay:0.5s]" />
        </div>

        {/* Loading text */}
        <div className="mt-8 text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground animate-pulse">
            Loading
            <span className="inline-flex ml-1">
              <span className="animate-bounce [animation-delay:0ms]">.</span>
              <span className="animate-bounce [animation-delay:150ms]">.</span>
              <span className="animate-bounce [animation-delay:300ms]">.</span>
            </span>
          </h2>
          <p className="text-sm text-muted-foreground animate-fade-in [animation-delay:0.5s]">
            Please wait while we prepare your experience
          </p>
        </div>

        {/* Decorative elements */}
        <div className="absolute -inset-20 pointer-events-none">
          {/* Floating particles */}
          <div className="absolute top-0 left-0 w-2 h-2 bg-primary/30 rounded-full animate-float-1" />
          <div className="absolute top-10 right-0 w-3 h-3 bg-primary/20 rounded-full animate-float-2" />
          <div className="absolute bottom-0 left-10 w-2 h-2 bg-primary/25 rounded-full animate-float-3" />
          <div className="absolute bottom-10 right-10 w-4 h-4 bg-primary/15 rounded-full animate-float-4" />
        </div>
      </div>
    </div>
  );
}

export function LoadingSpinner({
  className,
  size = "default",
}: {
  className?: string;
  size?: "small" | "default" | "large";
}) {
  const sizeClasses = {
    small: "w-4 h-4",
    default: "w-8 h-8",
    large: "w-16 h-16",
  };

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      <div className="absolute inset-0 rounded-full border-2 border-muted" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-primary animate-spin" />
    </div>
  );
}

export function LoadingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center space-x-1", className)}>
      <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

export function LoadingBar({
  className,
  progress,
}: {
  className?: string;
  progress?: number;
}) {
  return (
    <div
      className={cn(
        "w-full h-1 bg-muted rounded-full overflow-hidden",
        className,
      )}
    >
      <div
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{ width: progress ? `${progress}%` : "100%" }}
      >
        {!progress && (
          <div className="h-full w-full bg-gradient-to-r from-transparent via-primary-foreground/20 to-transparent animate-shimmer" />
        )}
      </div>
    </div>
  );
}
