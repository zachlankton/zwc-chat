import {
	type RequestWithSession,
	type SessionData,
} from "api/auth/session/sessionCache";
import { getCurrentSession } from "api/auth/session/utils";
import type { Server, ServerWebSocket } from "bun";
import { handleRequest } from "./router";
import type { ExtendedRequest } from "./server-types";
import crypto from "crypto";
import { asyncLocalStorage } from "./asyncLocalStore";
import type { OpenRouterMessage } from "./database";
import { getMessagesCollection, getChatsCollection } from "./database";

const txtDecoder = new TextDecoder();

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
			req.timestamp = Date.now();

			asyncLocalStorage.run(req, async () => {
				const response: Response = await handleRequest(
					req as ExtendedRequest,
					ws.data.server
				);

				const cType = response.headers.get("Content-Type") ?? "";
				if (cType.startsWith("text/event-stream")) {
					await streamedChunks(response, ws, msgObject);
				} else {
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
				}

				console.log(
					`WS: ${response.status} Response in ${(
						performance.now() - req.performance_start
					).toFixed(2)}ms`
				);
			});
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

// Look for "content":" or "reasoning":" byte patterns
const contentPattern = new Uint8Array([
	99, 111, 110, 116, 101, 110, 116, 34, 58, 34,
]); // "content":"
const reasoningPattern = new Uint8Array([
	114, 101, 97, 115, 111, 110, 105, 110, 103, 34, 58, 34,
]); // "reasoning":"

// Helper function to detect first token in stream
function detectFirstToken(value: Uint8Array): boolean {
	return (
		value.some((_, i) =>
			contentPattern.every((byte, j) => value[i + j] === byte)
		) ||
		value.some((_, i) =>
			reasoningPattern.every((byte, j) => value[i + j] === byte)
		) ||
		value.includes(123) // opening brace '{'
	);
}

// Helper function to create WebSocket message with header
function createWebSocketMessage(
	msgObject: any,
	response: Response,
	newMessageId: string,
	value: Uint8Array
): Uint8Array {
	const header = new TextEncoder().encode(
		JSON.stringify({
			id: msgObject.id,
			status: response.status,
			statusText: response.statusText,
			newMessageId,
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

	return message;
}

interface EventType {
	id: string;
	provider: string;
	model: string;
	object: string;
	created: number;
	choices: [
		{
			index: number;
			delta: {
				role: "system" | "developer" | "user" | "assistant" | "tool";
				content: string;
				reasoning: string | null;
			};
			finish_reason: string | null;
			native_finish_reason: string | null;
			logprobs: any | null;
		},
	];
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

// Helper function to parse streaming chunks and extract message content
function parseStreamingChunks(
	dataChunks: number[],
	newMessage: OpenRouterMessage
): void {
	const view = new Uint8Array(dataChunks);
	const text = txtDecoder.decode(view);
	const chunks = text.split("data: ");
	if (chunks[0] === "") chunks.shift();

	for (const chunk of chunks) {
		if (chunk[0] === "{") {
			const value = tryParseJson(chunk) as EventType;
			if (!value) continue;

			// Extract usage information
			const usage = value?.usage;
			if (usage) {
				newMessage.promptTokens = usage.prompt_tokens;
				newMessage.completionTokens = usage.completion_tokens;
				newMessage.totalTokens = usage.total_tokens;
			}

			// Extract content or reasoning
			const delta = value?.choices?.[0]?.delta;
			const role = delta.role;

			if (role !== "assistant") {
				console.error(
					"obviously we forgot to plan for message roles that aren't assistant",
					value
				);
				continue;
			}

			if (delta) {
				const msgKey = delta.reasoning ? "reasoning" : "content";
				if (delta[msgKey]) {
					newMessage[msgKey] = (newMessage[msgKey] ?? "") + delta[msgKey];
				}
			}
		}
	}
}

// Helper function to save message and update chat
async function saveMessageAndUpdateChat(
	newMessage: OpenRouterMessage
): Promise<void> {
	const messagesCollection = await getMessagesCollection();
	await messagesCollection.insertOne(newMessage);

	// Update or create the chat record
	const chatsCollection = await getChatsCollection();
	const chatId = newMessage.chatId;
	const userEmail = newMessage.userEmail;

	// Get the first user message to use for title (if creating new chat)
	const firstUserMessage = await messagesCollection.findOne(
		{ chatId, userEmail, role: "user" },
		{ sort: { timestamp: 1 } }
	);

	const title = firstUserMessage?.content
		? firstUserMessage.content.substring(0, 50) +
			(firstUserMessage.content.length > 50 ? "..." : "")
		: "New Chat";

	// Use atomic upsert operation to update or create the chat
	await chatsCollection.updateOne(
		{ id: chatId, userEmail },
		{
			$set: {
				lastMessage:
					newMessage.content.substring(0, 100) +
					(newMessage.content.length > 100 ? "..." : ""),
				updatedAt: new Date(),
			},
			$setOnInsert: {
				id: chatId,
				userEmail,
				title,
				createdAt: new Date(),
			},
			$inc: { messageCount: 1 },
		},
		{ upsert: true }
	);

	console.log(`Message saved to database for chat ${chatId}`);
}

async function streamedChunks(
	response: Response,
	ws: ZwcChatWebSocketServer,
	msgObject: any
) {
	const ctx = asyncLocalStorage.getStore();
	if (!ctx) throw new Error("NEED SOME CONTEXT TO STREAM CHUNKS");

	if (response.body === null) return;
	const reader = response.body.getReader();

	// Initialize new message
	const newMessageId = crypto.randomUUID();
	const newMessage: OpenRouterMessage = {
		id: newMessageId,
		chatId: ctx.params.chatId,
		userEmail: ctx.session.email,
		content: "",
		role: "assistant",
		timestamp: Date.now(),
	};

	// Stream and collect data chunks
	const dataChunks: number[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		// Detect first token for timing
		if (!newMessage.timeToFirstToken && detectFirstToken(value)) {
			newMessage.timeToFirstToken = Date.now();
		}

		dataChunks.push(...value);

		// Create and send WebSocket message
		const message = createWebSocketMessage(
			msgObject,
			response,
			newMessageId,
			value
		);
		ws.send(message);
	}

	// Record completion time
	newMessage.timeToFinish = Date.now();
	console.log("WSURL", ctx?.url.toString());

	// Parse the collected chunks to extract message content
	parseStreamingChunks(dataChunks, newMessage);

	// Save message and update chat
	try {
		await saveMessageAndUpdateChat(newMessage);
	} catch (error) {
		console.error("Failed to save message to database:", error);
		// Send error notification to the client
		ws.send(
			JSON.stringify({
				type: "error",
				error:
					"Failed to save message. Your conversation may not be persisted.",
			})
		);
		// Re-throw to handle at a higher level if needed
		throw error;
	}
}
