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
import { abortMap } from "./streamAbortControllers";
//import { appendFile } from "node:fs/promises";

type WebSocketData = {
	id: string;
	session: SessionData;
	url: string;
	token: string;
	server_id: string;
	ip: string;
	server: Server;
	request_id: string;
};

type ZwcChatWebSocketServer = ServerWebSocket<WebSocketData>;

//													email				ws.id
const userSockets = new Map<string, Map<string, ZwcChatWebSocketServer>>();

//										ws.id
export const skts = new Map<string, ZwcChatWebSocketServer>();

//															ws.id		chatId
export const socketSubs = new Map<string, { chatId: string; offset: number }>();

//															chatId			ws.id
export const chatSubs = new Map<string, Set<string>>();

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
			req.wsId = ws.data.id;

			asyncLocalStorage.run(req, async () => {
				const response: Response = await handleRequest(
					req as ExtendedRequest,
					ws.data.server
				);

				const cType = response.headers.get("Content-Type") ?? "";
				if (cType.startsWith("text/event-stream")) {
					try {
						await streamedChunks(response, ws, msgObject);
					} catch (err: any) {
						console.error("STREAMED_CHUNKS_ERROR", err.name);

						const ctx = asyncLocalStorage.getStore();
						if (!ctx) return;

						abortMap.delete(ctx.params.chatId);
					}
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
		} else if (msgObject.type === "ping") {
			// Handle ping message by sending pong response
			const test = ws.send(
				JSON.stringify({
					type: "pong",
					timestamp: msgObject.timestamp,
				})
			);

			if (test < 1) {
				console.error(
					`Failed to send pong message to ${ws.data.session.email}`
				);
			}
		} else {
			const session = await getWsSession(ws.data.url, ws.data.token);
			if (!session) return ws.close(4401, "Not Authorized");
		}
	},

	open(ws) {
		// a socket is opened
		if (!ws.data?.session?.email) return;

		ws.data.id = crypto.randomUUID();

		console.log(
			"WS_OPEN",
			"Sending Welcome Message to",
			ws.data.session.email,
			ws.data.id
		);

		skts.set(ws.data.id, ws);

		if (userSockets.has(ws.data.session.email)) {
			const userSocket = userSockets.get(ws.data.session.email);
			userSocket!.set(ws.data.id, ws);
		} else {
			const userConnections = new Map();
			userConnections.set(ws.data.id, ws);
			userSockets.set(ws.data.session.email, userConnections);
		}

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
		if (userSockets.has(ws.data.session.email)) {
			const userSocket = userSockets.get(ws.data.session.email);
			userSocket!.delete(ws.data.id);
		}
		skts.delete(ws.data.id);

		const prevSubChatId = socketSubs.get(ws.data.id);
		if (prevSubChatId) {
			let prevChatSubSocketIds = chatSubs.get(prevSubChatId.chatId);
			if (prevChatSubSocketIds) {
				prevChatSubSocketIds.delete(ws.data.id);
			}
		}
		console.log("WS_CLOSE", code, message, ws.data?.session?.email);
	},

	drain() {
		// the socket is ready to receive more data
		//console.log("WS_DRAIN", ws.data.session.email);
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
		console.error("TRY PARSE ERROR", txt);
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
	newMessageTimestamp: number,
	chatId: string,
	value: Uint8Array,
	offset: number,
	thisMessageIsFromTheOriginSocket: boolean
): Uint8Array {
	const header = new TextEncoder().encode(
		JSON.stringify({
			id: msgObject.id,
			status: response.status,
			statusText: response.statusText,
			newMessageId,
			newMessageTimestamp,
			chatId,
			length: value.length,
			offset,
			thisMessageIsFromTheOriginSocket,
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
				annotations: any;
				tool_calls: {
					id: string;
					index: number;
					type: "function";
					function: {
						name: string;
						arguments: string; // JSON string
					};
				}[];
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
async function parseStreamingChunks(
	dataChunks: number[],
	newMessage: OpenRouterMessage
): Promise<void> {
	const view = new Uint8Array(dataChunks);
	const text = txtDecoder.decode(view);
	const chunks = text.split("\n\n");
	if (chunks[0] === "") chunks.shift();

	// Initialize tool calls array if needed
	if (!newMessage.tool_calls) {
		newMessage.tool_calls = [];
	}

	for (const chunk of chunks) {
		// Extract data from SSE event
		const dataMatch = chunk.match(/^data: (.+)$/m);
		if (dataMatch) {
			const data = dataMatch[1];

			if (data.trim() === "[DONE]") {
				console.log("Received message:", { data });
			} else {
				const value = tryParseJson(data) as EventType;
				//await appendFile(
				//	"debug-chunks.txt",
				//	JSON.stringify(value, null, 2) + "\n\n"
				//);

				if (!value) continue;

				// Extract model information
				if (value.model && !newMessage.model) {
					newMessage.model = value.model;
				}

				// Extract usage information
				const usage = value?.usage;
				if (usage) {
					newMessage.promptTokens = usage.prompt_tokens;
					newMessage.completionTokens = usage.completion_tokens;
					newMessage.totalTokens = usage.total_tokens;
				}

				// Extract content or reasoning
				const delta = value?.choices?.[0]?.delta;
				if (!delta) {
					console.error("expected delta, but undefined, skipping for now");
					continue;
				}

				const role = delta.role;

				if (delta.annotations) {
					newMessage.annotations = delta.annotations;
				}

				if (role && role !== "assistant") {
					console.error(
						"obviously we forgot to plan for message roles that aren't assistant",
						value
					);
					continue;
				}

				// Handle regular content
				if (delta.content || delta.reasoning) {
					const msgKey = delta.reasoning ? "reasoning" : "content";
					if (delta[msgKey]) {
						newMessage[msgKey] = (newMessage[msgKey] ?? "") + delta[msgKey];
					}
				}

				// Handle tool calls streaming
				if (delta.tool_calls) {
					for (const toolCallDelta of delta.tool_calls) {
						const index = toolCallDelta.index;

						// Initialize tool call if it's the first chunk for this index
						if (!newMessage.tool_calls[index]) {
							newMessage.tool_calls[index] = {
								id: toolCallDelta.id || "",
								type: toolCallDelta.type || "function",
								function: {
									name: toolCallDelta.function?.name || "",
									arguments: "",
								},
							};
						}

						// Update tool call data
						if (toolCallDelta.id) {
							newMessage.tool_calls[index].id = toolCallDelta.id;
						}
						if (toolCallDelta.function?.name) {
							newMessage.tool_calls[index].function.name =
								toolCallDelta.function.name;
						}
						if (toolCallDelta.function?.arguments) {
							newMessage.tool_calls[index].function.arguments +=
								toolCallDelta.function.arguments;
						}
					}
				}

				// Check for finish reason
				const finishReason = value?.choices?.[0]?.finish_reason;
				if (finishReason === "tool_calls") {
					// Tool calls are complete - they've been built incrementally
				}
			}
		}
	}
}

// Helper function to save message and update chat
async function saveMessageAndUpdateChat(
	newMessage: OpenRouterMessage,
	messageIdToReplace?: string
): Promise<void> {
	const messagesCollection = await getMessagesCollection();

	if (messageIdToReplace) {
		// Get the original message to preserve its timestamp
		const originalMessage = await messagesCollection.findOne({
			id: messageIdToReplace,
			chatId: newMessage.chatId,
			userEmail: newMessage.userEmail,
		});

		if (originalMessage) {
			// Preserve the original timestamp
			newMessage.timestamp = originalMessage.timestamp;
		}

		if (newMessage.tool_calls?.length === 0) {
			newMessage.tool_calls = undefined;
		}

		// Update existing message
		await messagesCollection.replaceOne(
			{
				id: messageIdToReplace,
				chatId: newMessage.chatId,
				userEmail: newMessage.userEmail,
			},
			newMessage
		);
	} else {
		// Insert new message
		await messagesCollection.insertOne(newMessage);
	}

	// Update or create the chat record
	const chatsCollection = await getChatsCollection();
	const chatId = newMessage.chatId;
	const userEmail = newMessage.userEmail;

	// Use atomic upsert operation to update or create the chat
	await chatsCollection.updateOne(
		{ id: chatId, userEmail },
		{
			$set: {
				lastMessage:
					typeof newMessage.content === "string"
						? newMessage.content.substring(0, 100) +
							(newMessage.content.length > 100 ? "..." : "")
						: "Assistant response",
				generating: false,
				updatedAt: new Date(),
			},
			$setOnInsert: {
				id: chatId,
				userEmail,
				title: "We should never see this",
				createdAt: new Date(),
			},
			$inc: { messageCount: messageIdToReplace ? 0 : 1 }, // Only increment if it's a new message
		},
		{ upsert: true }
	);
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

	// Get messageIdToReplace from context if this is a retry
	const messageIdToReplace = ctx.messageIdToReplace;
	const overrideAssistantTimestamp = ctx.overrideAssistantTimestamp;

	// Initialize new message
	const newMessageId = messageIdToReplace || crypto.randomUUID();
	const newMessage: OpenRouterMessage = {
		id: newMessageId,
		chatId: ctx.params.chatId,
		userEmail: ctx.session.email,
		content: "",
		role: "assistant",
		timestamp: overrideAssistantTimestamp || Date.now(),
	};

	// Stream and collect data chunks
	const dataChunks: number[] = [];

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			// Detect first token for timing
			if (!newMessage.timeToFirstToken && detectFirstToken(value)) {
				newMessage.timeToFirstToken = Date.now() - newMessage.timestamp;
			}

			const offset = dataChunks.length;

			dataChunks.push(...value);

			const subs = chatSubs.get(ctx.params.chatId);
			if (!subs) continue;

			for (const sub of subs) {
				const subSocket = socketSubs.get(sub);

				if (!subSocket) continue;
				let valueToSend = value;
				let offsetToSend = offset;
				if (subSocket.offset === 0) {
					valueToSend = dataChunks as any;
					offsetToSend = 0;
				}

				subSocket.offset = valueToSend.length;

				// Create and send WebSocket message
				const message = createWebSocketMessage(
					msgObject,
					response,
					newMessageId,
					newMessage.timestamp,
					ctx.params.chatId,
					valueToSend,
					offsetToSend,
					sub === ws.data.id
				);

				const socketToSendOn = skts.get(sub);
				if (!socketToSendOn) {
					console.error("socketToSendOn is not defined", sub);
					continue;
				}

				socketToSendOn.send(message);
			}
		}
	} catch (e: any) {
		if (e.name !== "AbortError") {
			return console.error("STREAMED CHUNKS WHILE LOOP", e);
		}

		newMessage.stoppedByUser = true;
	}

	// Record completion time
	newMessage.timeToFinish = Date.now() - newMessage.timestamp;

	// Parse the collected chunks to extract message content
	await parseStreamingChunks(dataChunks, newMessage);

	// Save message and update chat
	await saveMessageAndUpdateChat(newMessage, messageIdToReplace);

	console.log("DELETING ABORT CONTROLLER", ctx.params.chatId);
	abortMap.delete(ctx.params.chatId);

	sendMessageToChatSubs(
		ws.data.id,
		ctx.params.chatId,
		{
			subType: "chat-stream-finished",
		},
		{ sendToAll: true }
	);
}

export function sendMessageToChatSubs(
	thisWsId: string,
	chatId: string,
	data: Record<string, any>,
	opts?: { sendToAll: boolean }
) {
	const ctx = asyncLocalStorage.getStore();
	if (!ctx) throw new Error("NEED SOME CONTEXT TO SEND CHAT SUB MESSAGES");

	const subs = userSockets.get(ctx.session.email);
	if (!subs) return;
	for (const [wsId, userSocket] of subs) {
		// don't send messages to ourselves
		if (!opts?.sendToAll && wsId === thisWsId) continue;

		if (!userSocket) continue;

		const socketToSendOn = userSocket;
		if (!socketToSendOn) {
			console.error("socketToSendOn is not defined", userSocket);
			continue;
		}

		socketToSendOn.send(
			JSON.stringify({
				type: "chat-sub-message",
				data,
				status: 200,
				statusText: "ok",
				headers: { "x-zwc-chat-id": chatId },
			})
		);
	}
}
