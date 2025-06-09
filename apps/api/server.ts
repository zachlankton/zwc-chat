import "lib/logging";
import { handleRequest, routeImportPromises } from "lib/router";
import type { ExtendedRequest } from "lib/server-types";
import { bunWebsocketHandlers } from "lib/websockets";
import { connectToDatabase } from "lib/database";

const serverStartTime = performance.now();

console.log("Warming up database connection...");

// Initialize MongoDB connection
connectToDatabase().catch(error => {
	console.error("Failed to connect to MongoDB:", error);
	// Continue running without MongoDB - will use in-memory cache only
});

const dev = process.env.DEV === "TRUE";
const https = process.env.HTTPS === "TRUE";

const server = Bun.serve({
	development: dev,
	static: {
		"/favicon.ico": new Response(
			await Bun.file("./static/favicon.ico").bytes(),
			{
				headers: {
					"Content-Type": "image/x-icon",
				},
			}
		),
	},

	async fetch(_req: any, server) {
		const req = _req as ExtendedRequest;
		req.performance_start = performance.now();
		return handleRequest(req, server);
	},
	websocket: bunWebsocketHandlers,

	tls: https
		? {
				key: Bun.file("./key.pem"),
				cert: Bun.file("./cert.pem"),
			}
		: undefined,
});

await Promise.allSettled(routeImportPromises);

console.log(`All routes ready in ${performance.now() - serverStartTime}ms`);
console.log("Server ready:", server.url.href);
