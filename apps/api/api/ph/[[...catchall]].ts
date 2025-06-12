import { apiHandler } from "lib/utils";
import type { RequestWithSession } from "../auth/session/sessionCache";

// PostHog endpoints
const POSTHOG_STATIC_URL = "https://us-assets.i.posthog.com";
const POSTHOG_MAIN_URL = "https://us.i.posthog.com";

// Allowed domains for referer check
const ALLOWED_DOMAINS = [
	"localhost",
	"*.zwc.chat", // Update this to your actual domain
];

function isValidReferer(referer: string | null): boolean {
	if (!referer) return false;

	try {
		const url = new URL(referer);
		const hostname = url.hostname;

		// Check each allowed domain
		return ALLOWED_DOMAINS.some((domain) => {
			if (domain.startsWith("*.")) {
				// Wildcard subdomain check
				const baseDomain = domain.slice(2);
				return hostname === baseDomain || hostname.endsWith(`.${baseDomain}`);
			}
			return hostname === domain;
		});
	} catch {
		return false;
	}
}

async function proxyRequest(
	req: Request,
	targetUrl: string,
	targetHost: string
): Promise<Response> {
	// Get the path from the request
	const url = new URL(req.url);
	const path = url.pathname.replace(/^\/ph/, "");
	const queryString = url.search;

	// Build the full target URL
	const fullTargetUrl = `${targetUrl}${path}${queryString}`;

	// Clone headers from the original request
	const headers = new Headers(req.headers);

	// Set the correct host header
	headers.set("Host", targetHost);

	// Remove headers that might cause issues
	headers.delete("host");
	headers.delete("content-length");

	// Forward the request
	const response = await fetch(fullTargetUrl, {
		method: req.method,
		headers: headers,
		body:
			req.method !== "GET" && req.method !== "HEAD"
				? await req.blob()
				: undefined,
		redirect: "manual",
	});

	// Clone response headers
	const responseHeaders = new Headers(response.headers);

	// Remove headers that might cause issues
	responseHeaders.delete("content-encoding");
	responseHeaders.delete("content-length");
	responseHeaders.delete("transfer-encoding");

	// Add CORS headers if needed
	responseHeaders.set("Access-Control-Allow-Origin", "*");
	responseHeaders.set(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, DELETE, OPTIONS"
	);
	responseHeaders.set("Access-Control-Allow-Headers", "*");

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: responseHeaders,
	});
}

// Handle all HTTP methods
export const GET = apiHandler(async (req: RequestWithSession) => {
	// Check referer
	const referer = req.headers.get("referer");
	if (!isValidReferer(referer)) {
		return new Response("Forbidden", { status: 403 });
	}

	const url = new URL(req.url);
	const path = url.pathname.replace(/^\/ph/, "");

	// Determine which PostHog endpoint to use
	if (path.startsWith("/static/")) {
		return proxyRequest(req, POSTHOG_STATIC_URL, "us-assets.i.posthog.com");
	} else {
		return proxyRequest(req, POSTHOG_MAIN_URL, "us.i.posthog.com");
	}
});

export const POST = apiHandler(async (req: RequestWithSession) => {
	// Check referer
	const referer = req.headers.get("referer");
	if (!isValidReferer(referer)) {
		return new Response("Forbidden", { status: 403 });
	}

	const url = new URL(req.url);
	const path = url.pathname.replace(/^\/ph/, "");

	// Determine which PostHog endpoint to use
	if (path.startsWith("/static/")) {
		return proxyRequest(req, POSTHOG_STATIC_URL, "us-assets.i.posthog.com");
	} else {
		return proxyRequest(req, POSTHOG_MAIN_URL, "us.i.posthog.com");
	}
});

export const PUT = POST;
export const DELETE = POST;
export const PATCH = POST;
export const OPTIONS = apiHandler(async () => {
	return new Response(null, {
		status: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
			"Access-Control-Allow-Headers": "*",
		},
	});
});
