import type { Server } from "bun";
import {
	LogResponseBody,
	LogResponseHeaders,
	LogRequestBody,
	LogRequestHeaders,
	runtimeOptions,
} from "./logging";
import type { ExtendedRequest } from "./server-types";
import { asyncLocalStorage } from "./asyncLocalStore";
import { handleWebsocketUpgrade } from "./websockets";

const corsOptions = {
	"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization, x-account-id",
};

export const server_id = Date.now().toString(36);
let request_id = 0;

export const router = new Bun.FileSystemRouter({
	style: "nextjs",
	dir: "./api",
	origin: process.env.ORIGIN || "http://localhost:3000",
});

export async function getRoute(path: string) {
	const routeString = path.replace("/api/", "/") + "/route";
	const route = router.match(routeString);

	if (route === null) {
		return { modules: null, route };
	}
	const modules = await import(route.filePath);

	return { modules, route };
}

export function NotFound(path: string, method: string) {
	console.log(`${method} ${path} Not Found`);
	if (method === "HEAD" || method === "OPTIONS")
		return new Response(null, { status: 404 });
	return Response.json({ error: "Not Found" }, { status: 404 });
}

export function MethodNotAllowed(path: string) {
	console.log(`${path} method not allowed`);
	return Response.json({ error: "Method not allowed" }, { status: 405 });
}

export function cookiesToMap(cookieHeader: string | null): Map<string, string> {
	const cookieMap = new Map<string, string>();

	if (!cookieHeader) {
		return cookieMap;
	}

	cookieHeader.split(";").forEach((cookie) => {
		const [key, ...valueParts] = cookie.trim().split("=");
		const value = valueParts.join("=");
		if (key) {
			cookieMap.set(
				decodeURIComponent(key.trim()),
				decodeURIComponent(value.trim())
			);
		}
	});

	return cookieMap;
}

export function handleRequest(req: ExtendedRequest, server: Server) {
	if (!server) return new Response("No Server Instance!", { status: 500 });

	request_id++;
	const requestIpAddress =
		req.ip ??
		req.headers.get("x-forwarded-for") ??
		req.headers.get("cf-connecting-ip") ??
		req.headers.get("x-real-ip") ??
		req.headers.get("x-forwarded") ??
		server.requestIP(req)?.address;

	const url = new URL(req.url);

	if (url.href === "http://localhost:3000/shutdown") {
		server.stop();
		server.unref();
		return new Response("ok");
	}

	const _path = url.pathname;

	// remove trailing slash
	const path = _path.endsWith("/") ? _path.slice(0, -1) : _path;

	req.cookies = cookiesToMap(req.headers.get("cookie"));
	req.ip = requestIpAddress;
	req.server_id = server_id;
	req.id = request_id.toString();
	const requestClone = req.clone();
	req.requestCloneInCaseOfError = requestClone;

	const ws_connection =
		(req.headers.get("connection") ?? "").toLowerCase() === "upgrade";
	const ws_upgrade =
		(req.headers.get("upgrade") ?? "").toLowerCase() === "websocket";

	if (ws_connection && ws_upgrade)
		return handleWebsocketUpgrade(server, req, url.origin, path);

	return asyncLocalStorage.run(req, async () => {
		// import route
		const { modules, route } = await getRoute(path);
		if (route === null) return NotFound(path, req.method);

		if (req.method === "OPTIONS") {
			const resp = new Response();
			Object.entries(corsOptions).forEach(([key, value]) => {
				resp.headers.set(key, value);
			});
			resp.headers.set(
				"Access-Control-Allow-Origin",
				req.headers.get("origin") ?? "*"
			);

			return resp;
		}

		// if req method property not on the route object, return 405
		if (!(req.method in modules)) return MethodNotAllowed(path);
		req.path = path;

		console.log(
			`${req.ip} ${req.method} ${path} - PENDING REQS: ${server.pendingRequests}`
		);
		if (runtimeOptions.logRequestHeaders) LogRequestHeaders(req);
		if (runtimeOptions.logRequestBody) LogRequestBody(req);

		// call route handler
		const handler = modules[req.method];

		const response = await handler(req, { server, params: route.params });
		console.log(
			`${response.status} Response in ${(
				performance.now() - req.performance_start
			).toFixed(2)}ms`
		);

		if (runtimeOptions.logResponseHeaders) LogResponseHeaders(response);
		if (runtimeOptions.logResponseBody) LogResponseBody(response);

		Object.entries(corsOptions).forEach(([key, value]) => {
			response.headers.set(key, value);
		});
		response.headers.set(
			"Access-Control-Allow-Origin",
			req.headers.get("origin") ?? "*"
		);

		return response;
	});
}

console.log("Importing route modules...");

export const routePaths: string[] = [];
export const routeImportPromises: Promise<any>[] = [];
for (const [path, route] of Object.entries(router.routes)) {
	const isRoute = path.split("/").at(-1) === "route";
	if (!isRoute) continue;
	console.log(`Importing route module ${path}`);
	routeImportPromises.push(import(route));
	routePaths.push(path);
}
