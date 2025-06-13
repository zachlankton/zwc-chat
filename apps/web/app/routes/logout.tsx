import { useEffect } from "react";
import { Button } from "~/components/ui/button";
import { LS_TOKEN } from "~/lib/fetchWrapper";

export default function LogoutPage() {
  useEffect(() => {
    // Clear the authentication token
    localStorage.removeItem(LS_TOKEN);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <div className="w-full max-w-md px-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
          {/* Success Icon */}
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-600 dark:text-green-400"
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            You've been logged out
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Thanks for using ZWC Chat. You've been securely signed out of your
            account.
          </p>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => (window.location.href = "/")}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Sign In Again
            </Button>

            <Button
              onClick={() => (window.location.href = "/")}
              variant="outline"
              className="w-full h-11 border-gray-300 dark:border-gray-600"
            >
              Go to Homepage
            </Button>
          </div>

          {/* Security Notice */}
          <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <svg
                className="w-4 h-4 inline mr-2 text-gray-500"
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
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <a
              href="#"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 mr-4"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Terms of Service
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
