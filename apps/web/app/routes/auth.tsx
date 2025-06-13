import { Button } from "~/components/ui/button";

async function getAuthUrl() {
  const newUrl = new URL(location.href);
  const authUrl = newUrl.searchParams.get("authorizationUrl");
  if (authUrl) location.assign(authUrl);
}

export default function AuthPage() {
  const newUrl = new URL(location.href);
  const authUrl = newUrl.searchParams.get("authorizationUrl");
  const status = newUrl.searchParams.get("status") ?? "Authentication Error";
  const msg =
    newUrl.searchParams.get("msg") ??
    "We couldn't complete the authentication process. This might be a temporary issue. Try again in a few moments";

  if (!authUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="w-full max-w-md px-6">
          <div className="bg-card rounded-2xl shadow-xl border border-border p-8 text-center">
            {/* Error Icon */}
            <div className="mb-6 flex justify-center">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-destructive"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            {/* Error Message */}
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {status}
            </h2>
            <p className="text-muted-foreground mb-8">{msg}</p>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={() => (window.location.href = "/")}
                className="w-full h-11"
              >
                Return to Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
      <div className="w-full max-w-md px-6">
        <div className="bg-card rounded-2xl shadow-xl border border-border p-8">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="w-48">
              <img
                src="/android-chrome-512x512.png"
                alt="ZWC Chat"
                className="block w-full dark:hidden"
              />
              <img
                src="/android-chrome-512x512.png"
                alt="ZWC Chat"
                className="hidden w-full dark:block"
              />
            </div>
          </div>

          {/* Welcome Text */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Welcome back
            </h1>
            <p className="text-muted-foreground">
              Sign in to continue to ZWC Chat
            </p>
          </div>

          {/* Google Login Button */}
          <Button
            onClick={getAuthUrl}
            className="w-full h-12 flex items-center justify-center gap-3 bg-background hover:bg-accent text-foreground border border-border transition-colors"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>

          {/* Terms and Privacy */}
          <p className="mt-8 text-center text-sm text-muted-foreground">
            By continuing, you agree to our{" "}
            <a
              href="#"
              className="font-medium text-primary hover:text-primary/80"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="font-medium text-primary hover:text-primary/80"
            >
              Privacy Policy
            </a>
          </p>
        </div>

        {/* Additional Help */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Having trouble signing in?{" "}
            <a
              href="#"
              className="font-medium text-primary hover:text-primary/80"
            >
              Get help
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
