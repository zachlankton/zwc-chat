import { useEffect } from "react";
import { Button } from "~/components/ui/button";
import { LS_TOKEN } from "~/lib/fetchWrapper";

export default function LogoutPage() {
  useEffect(() => {
    // Clear the authentication token
    localStorage.removeItem(LS_TOKEN);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
      <div className="w-full max-w-md px-6">
        <div className="bg-card rounded-2xl shadow-xl border border-border p-8 text-center">
          {/* Success Icon */}
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          {/* Logout Message */}
          <h1 className="text-2xl font-bold text-foreground mb-2">
            You've been logged out
          </h1>
          <p className="text-muted-foreground mb-8">
            Thanks for using ZWC Chat. You've been securely signed out of your
            account.
          </p>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => (window.location.href = "/")}
              className="w-full h-11"
            >
              Sign In Again
            </Button>

            <Button
              onClick={() => (window.location.href = "/")}
              variant="outline"
              className="w-full h-11"
            >
              Go to Homepage
            </Button>
          </div>

          {/* Security Notice */}
          <div className="mt-8 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <svg
                className="w-4 h-4 inline mr-2 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              For your security, we recommend closing this browser tab if you're
              using a shared device.
            </p>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            <a
              href="#"
              className="font-medium text-primary hover:text-primary/80 mr-4"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="font-medium text-primary hover:text-primary/80"
            >
              Terms of Service
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
