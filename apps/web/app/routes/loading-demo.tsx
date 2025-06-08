import { useState } from "react";
import {
  LoadingPage,
  LoadingSpinner,
  LoadingDots,
  LoadingBar,
} from "~/components/loading-page";
import { Button } from "~/components/ui/button";

export default function LoadingDemo() {
  const [showFullPageLoading, setShowFullPageLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const simulateProgress = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  return (
    <div className="container mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold mb-8">Loading Components Demo</h1>

      {/* Full Page Loading */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Full Page Loading</h2>
        <Button
          onClick={() => {
            setShowFullPageLoading(true);
          }}
        >
          Show Full Page Loading (3 seconds)
        </Button>
        {showFullPageLoading && <LoadingPage />}
      </section>

      {/* Loading Spinners */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Loading Spinners</h2>
        <div className="flex items-center gap-8">
          <div className="text-center">
            <LoadingSpinner size="small" />
            <p className="text-sm text-muted-foreground mt-2">Small</p>
          </div>
          <div className="text-center">
            <LoadingSpinner size="default" />
            <p className="text-sm text-muted-foreground mt-2">Default</p>
          </div>
          <div className="text-center">
            <LoadingSpinner size="large" />
            <p className="text-sm text-muted-foreground mt-2">Large</p>
          </div>
        </div>
      </section>

      {/* Loading Dots */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Loading Dots</h2>
        <div className="space-y-4">
          <p>
            Loading content
            <LoadingDots className="ml-1" />
          </p>
          <p className="text-2xl">
            Please wait
            <LoadingDots className="ml-2 text-primary" />
          </p>
        </div>
      </section>

      {/* Loading Bar */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Loading Bar</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Indeterminate</p>
            <LoadingBar />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              With Progress: {progress}%
            </p>
            <LoadingBar progress={progress} />
            <Button onClick={simulateProgress} className="mt-2">
              Simulate Progress
            </Button>
          </div>
        </div>
      </section>

      {/* Usage Examples */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Usage Examples</h2>
        <div className="space-y-4 bg-muted/50 p-4 rounded-lg">
          <p className="text-sm font-mono">
            {`import { LoadingPage, LoadingSpinner, LoadingDots, LoadingBar } from "~/components/loading-page";`}
          </p>
          <div className="space-y-2 text-sm">
            <p>
              • Use <code className="bg-muted px-1 rounded">LoadingPage</code>{" "}
              for full-page loading states
            </p>
            <p>
              • Use{" "}
              <code className="bg-muted px-1 rounded">LoadingSpinner</code> for
              inline loading indicators
            </p>
            <p>
              • Use <code className="bg-muted px-1 rounded">LoadingDots</code>{" "}
              for text-based loading animations
            </p>
            <p>
              • Use <code className="bg-muted px-1 rounded">LoadingBar</code>{" "}
              for progress indicators
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

