import "../login.ts";
import React from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import "./styles/markdown.css";
import { LoadingPage } from "~/components/loading-page";
import { checkLogin } from "../login";
import { ThemeProvider } from "./providers/theme-provider.js";
import { queryClient } from "./providers/queryClient.js";
import { QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";

// Lazy load ReactQueryDevtools only in development
const ReactQueryDevtools =
  process.env.NODE_ENV === "development"
    ? React.lazy(() =>
        import("@tanstack/react-query-devtools").then((module) => ({
          default: module.ReactQueryDevtools,
        })),
      )
    : () => null;

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <PostHogProvider
          apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
          options={{
            api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
            capture_exceptions: true,
            debug: false, //import.meta.env.MODE === "development",
            disable_session_recording: import.meta.env.MODE === "development",
          }}
        >
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>{children}</ThemeProvider>
            {process.env.NODE_ENV === "development" && (
              <React.Suspense fallback={null}>
                <ReactQueryDevtools initialIsOpen={false} />
              </React.Suspense>
            )}
          </QueryClientProvider>
        </PostHogProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export async function clientLoader() {
  const ret = await checkLogin();
  if (ret === undefined) return;
  if (ret.state) location.assign(ret.state);
  if (ret.authorizationUrl) {
    const newUrl = new URL(location.origin);
    newUrl.pathname = "/auth";
    newUrl.searchParams.set("authorizationUrl", ret.authorizationUrl);
    location.assign(newUrl.toString());
  }
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}

export function HydrateFallback() {
  return <LoadingPage />;
}
