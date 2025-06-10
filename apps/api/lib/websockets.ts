import {
	type RequestWithSession,
	type SessionData,
} from "api/auth/session/sessionCache";
import { getCurrentSession } from "api/auth/session/utils";
import type { Server, ServerWebSocket } from "bun";
import { handleRequest } from "./router";
import type { ExtendedRequest } from "./server-types";

export async function handleWebsocketUpgrade(
	server: Server,
	req: ExtendedRequest,
	url: string,
	path: string
) {
	const token = path.slice(1);
	if (!token) {
		return Response.json({ error: "Not Found" }, { status: 404 });
	}

	const session = await getWsSession(url, token);

	if (!session) {
		return Response.json({ error: "Not Found" }, { status: 404 });
	}

	console.log(`Opening WebSocket for user: ${session.email}`);

	server.upgrade(req, {
		data: { session, url, token, server, ip: req.ip },
	});

	// if we made it here return 404 to remain ambiguous
	// about the presence of websockets on our server
	return Response.json({ error: "Not Found" }, { status: 404 });
}

type WebSocketData = {
	session: SessionData;
	url: string;
	token: string;
	server_id: string;
	ip: string;
	server: Server;
	request_id: string;
};

type ZwcChatWebSocketServer = ServerWebSocket<WebSocketData>;

export const websocketEventSubscriptions = new Map<
	string, // account id
	Map<any, Map<string, ZwcChatWebSocketServer>>
>();

interface websocketHandlers {
	message: (
		ws: ZwcChatWebSocketServer,
		message: string | ArrayBuffer | Uint8Array
	) => void;
	open?: (ws: ZwcChatWebSocketServer) => void;
	close?: (ws: ZwcChatWebSocketServer, code: number, reason: string) => void;
	error?: (ws: ZwcChatWebSocketServer, error: Error) => void;
	drain?: (ws: ZwcChatWebSocketServer) => void;

	maxPayloadLength?: number; // default: 16 * 1024 * 1024 = 16 MB
	idleTimeout?: number; // default: 120 (seconds)
	backpressureLimit?: number; // default: 1024 * 1024 = 1 MB
	closeOnBackpressureLimit?: boolean; // default: false
	sendPings?: boolean; // default: true
	publishToSelf?: boolean; // default: false

	perMessageDeflate?:
		| boolean
		| {
				compress?: boolean;
				decompress?: boolean;
		  };
}

export const bunWebsocketHandlers: websocketHandlers = {
	perMessageDeflate: true,

	async message(ws, message) {
		if (!ws.data) return ws.close(4500, "No WebSocket Data?");
		if (!ws.data.url) return ws.close(4500, "No WebSocket Url?");
		if (!ws.data.token) ws.close(4500, "No WebSocket Token?");

		//console.log("WS_MESSAGE", message);

		if (typeof message !== "string") return formatError(ws, message);

		const msgObject = tryParseJson(message);

		if (!msgObject) return formatError(ws, message);

		if (msgObject.type === "request") {
			const req = new Request(new URL(ws.data?.url + msgObject.path), {
				...msgObject,
			}) as ExtendedRequest;

			req.ip = "WS:" + ws.data?.ip;
			req.performance_start = performance.now();

			const response: Response = await handleRequest(
				req as ExtendedRequest,
				ws.data.server
			);

			const cType = response.headers.get("Content-Type") ?? "";
			if (cType.startsWith("text/event-stream")) {
				return streamedChunks(response, ws, msgObject);
			}

			const bodyTxt = await response.text();
			const body = tryParseJson(bodyTxt);

			ws.send(
				JSON.stringify({
					type: "response",
					id: msgObject.id,
					body,
					status: response.status,
					statusText: response.statusText,
					headers: response.headers,
				})
			);
		} else {
			const session = await getWsSession(ws.data.url, ws.data.token);
			if (!session) return ws.close(4401, "Not Authorized");
		}
	},

	open(ws) {
		// a socket is opened
		console.log(
			"WS_OPEN",
			"Sending Welcome Message to",
			ws.data?.session?.email
		);

		ws.send(
			JSON.stringify({
				type: "socket_opened",
				status: 200,
				headers: {
					"Content-Type": "application/json",
				},
				body: {
					message: "Welcome to ZWC Chat WebSocket Server!",
				},
			})
		);
	},

	close(ws, code, message) {
		// a socket is closed
		console.log("WS_CLOSE", code, message, ws.data?.session?.email);
	},

	drain() {
		// the socket is ready to receive more data
		console.log("WS_DRAIN");
	},
};

async function getWsSession(url: string, token: string) {
	const newRequest = new Request(new URL(url), {
		headers: new Headers({
			Authorization: `Bearer ${token}`,
		}),
	}) as RequestWithSession;

	await getCurrentSession(newRequest);
	return newRequest.session;
}

function tryParseJson(txt: string) {
	try {
		return JSON.parse(txt);
	} catch (error) {
		return null;
	}
}

function formatError(ws: ZwcChatWebSocketServer, message: any) {
	console.log("FORMAT_ERROR", message);

	return ws.send(
		JSON.stringify({
			type: "error",
			status: 500,
			headers: {
				"Content-Type": "application/json",
			},
			body: {
				message:
					"A message was received that could not be parsed, please make sure your messages are in the correct format",
				messageReceived: message,
			},
		})
	);
}

async function streamedChunks(
	response: Response,
	ws: ZwcChatWebSocketServer,
	msgObject: any
) {
	if (response.body === null) return;
	const reader = response.body.getReader();

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		const header = new TextEncoder().encode(
			JSON.stringify({
				id: msgObject.id,
				status: response.status,
				statusText: response.statusText,
				length: value.length,
			})
		);
		const headerLenBytes = new Uint8Array(4); // 32-bit LE
		new DataView(headerLenBytes.buffer).setUint32(0, header.length, true);

		// Combine: [header_length][header][data]
		const message = new Uint8Array(4 + header.length + value.length);
		message.set(headerLenBytes, 0);
		message.set(header, 4);
		message.set(value, 4 + header.length);

		ws.send(message);

		/*
		ws.send(
			JSON.stringify({
				type: "response-chunked",
				id: msgObject.id,
				body: value,
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
			})
		);
		*/
	}
}
