import type { RequestWithSession } from "api/auth/session/sessionCache";
import { getCurrentSession } from "api/auth/session/utils";
import { apiHandler, badRequest, notAuthorized } from "lib/utils";
import {
	getMessagesCollection,
	getChatsCollection,
	type OpenRouterMessage,
} from "lib/database";
import { DEFAULT_MODEL } from "lib/modelConfig";
import type { ExtendedRequest } from "lib/server-types";
import { chatSubs, sendMessageToChatSubs, socketSubs } from "lib/websockets";

// UUID v4 validation regex
const UUID_V4_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validateUUID = (uuid: string): boolean => {
	return UUID_V4_REGEX.test(uuid);
};

// Type for chat update operations
interface ChatUpdateData {
	updatedAt: Date;
	title?: string;
	lastMessage?: string;
	pinnedAt?: Date | null;
}

const openRouterApiKey = process.env.OPENROUTER_KEY;
if (!openRouterApiKey)
	throw new Error("OPENROUTER_KEY env var needs to be defined");

export const POST = apiHandler(
	async (
		req: RequestWithSession,
		{ params }: { params: { chatId: string } }
	) => {
		console.log("CHATID", params);
		await getCurrentSession(req);
		if (!req.session) throw notAuthorized();
		if (!req.session.email) throw notAuthorized();
		const wsId = (req as ExtendedRequest).wsId;

		const body = await req.json().catch(() => null);
		if (body === null) throw badRequest("Could not parse the body");
		if (!body.messages) throw badRequest("messages[] key is required");

		// Extract model from request body, use default if not provided
		const model = body.model || DEFAULT_MODEL;

		// Extract messageIdToReplace if this is a retry
		const messageIdToReplace = body.messageIdToReplace;
		const overrideAssistantTimestamp = body.overrideAssistantTimestamp;

		const userChatId = params.chatId;
		if (!validateUUID(userChatId)) {
			throw badRequest("Invalid chat ID format");
		}

		// Save messages before processing (only if not retrying)
		try {
			const messages = body.messages;
			sendMessageToChatSubs(wsId, userChatId, {
				subType: "msg-post",
				lastMessage: messages.at(-1),
				messageIdToReplace,
			});

			if (messages && messages.length > 0 && !messageIdToReplace) {
				// Check if there's a system message at the beginning
				const firstMessage = messages[0];
				const hasSystemPrompt = firstMessage.role === "system";

				// Save system prompt if it exists and is not already saved
				if (hasSystemPrompt) {
					const messagesCollection = await getMessagesCollection();
					// Check if system message already exists for this chat
					const existingSystemMessage = await messagesCollection.findOne({
						chatId: userChatId,
						userEmail: req.session.email,
						role: "system",
					});

					if (!existingSystemMessage) {
						const systemMessageId = validateUUID(firstMessage.id)
							? firstMessage.id
							: crypto.randomUUID();
						const systemMessage: OpenRouterMessage = {
							id: systemMessageId,
							chatId: userChatId,
							userEmail: req.session.email,
							content: firstMessage.content,
							role: "system",
							timestamp: Date.now() - 100000, // Slightly before user message
						};
						await messagesCollection.insertOne(systemMessage);
						console.log(
							`System message saved to database for chat ${userChatId}`
						);
					}
				}

				// Save user message
				let currentMessageIndex = messages.length - 1;
				let lastMessage: OpenRouterMessage = messages[currentMessageIndex];
				const lastRole = lastMessage.role;
				const save = ["user", "tool"].includes(lastRole);

				if (lastRole === "tool") {
					// get first tool call in this latest round
					while (lastMessage.role === "tool") {
						currentMessageIndex--;
						lastMessage = messages[currentMessageIndex];
					}
					currentMessageIndex++;
					lastMessage = messages[currentMessageIndex];
				}

				if (lastRole === "user") {
					lastMessage = messages[currentMessageIndex];
				}

				while (save && currentMessageIndex < messages.length) {
					const chatId = userChatId;
					const validMessageId = validateUUID(lastMessage.id);
					const userMessageId = validMessageId
						? lastMessage.id
						: crypto.randomUUID();
					const userMessage: OpenRouterMessage = {
						id: userMessageId,
						chatId,
						userEmail: req.session.email,
						content: lastMessage.content,
						tool_call_id: lastMessage.tool_call_id,
						name: lastMessage.name,
						role: lastMessage.role,
						model: model, // Store which model the user requested
						timestamp: lastMessage.timestamp || Date.now(),
					};

					const messagesCollection = await getMessagesCollection();
					await messagesCollection.insertOne(userMessage);
					console.log(`User message saved to database for chat ${chatId}`);

					// Update chat with user message using atomic upsert
					const chatsCollection = await getChatsCollection();
					const now = new Date();

					// Extract text content for title/lastMessage
					let textContent = "";
					if (typeof lastMessage.content === "string") {
						textContent = lastMessage.content;
					} else if (Array.isArray(lastMessage.content)) {
						// Extract text from content array
						const textPart = lastMessage.content.find(
							(item: any) => item.type === "text"
						) as any;
						textContent = textPart?.text || "Sent attachments";
					}

					const chatTitle =
						textContent.substring(0, 50) +
						(textContent.length > 50 ? "..." : "");
					const chatLastMessage =
						textContent.substring(0, 100) +
						(textContent.length > 100 ? "..." : "");

					await chatsCollection.updateOne(
						{ id: chatId, userEmail: req.session.email },
						{
							$set: {
								lastMessage: chatLastMessage,
								updatedAt: now,
							},
							$setOnInsert: {
								id: chatId,
								userEmail: req.session.email,
								title: chatTitle,
								createdAt: now,
							},
							$inc: { messageCount: hasSystemPrompt ? 2 : 1 }, // Count system message if present
						},
						{ upsert: true }
					);

					currentMessageIndex++;
					lastMessage = messages[currentMessageIndex];
				}
			}
		} catch (error) {
			console.error("Failed to save messages:", error);
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";
			return Response.json(
				{
					error: "Failed to save messages. Please try again.",
					details:
						process.env.NODE_ENV === "development" ? errorMessage : undefined,
				},
				{ status: 500 }
			);
		}

		const messagesCollection = await getMessagesCollection();

		// Store messageIdToReplace in the request for websocket handler
		if (messageIdToReplace) {
			// The request becomes ExtendedRequest in the websocket handler
			(req as ExtendedRequest).messageIdToReplace = messageIdToReplace;
			await messagesCollection.updateOne(
				{
					id: messageIdToReplace,
					chatId: userChatId,
					userEmail: req.session.email,
				},
				{
					$set: {
						content: "",
						reasoning: undefined,
						tool_calls: undefined,
					},
				}
			);
		}

		if (overrideAssistantTimestamp) {
			// The request becomes ExtendedRequest in the websocket handler
			(req as ExtendedRequest).overrideAssistantTimestamp =
				overrideAssistantTimestamp;
		}

		return fetch("https://openrouter.ai/api/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${req.session.openRouterApiKey ?? openRouterApiKey}`,
				"HTTP-Referer": "https://zwc.chat",
				"X-Title": "ZWC Chat",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: model, // Use dynamic model
				plugins: body.websearch ? [{ id: "web" }] : undefined,
				stream: true,
				transforms: ["middle-out"], // silicon valley fo lyfe
				user: req.session.email,
				messages: body.messages,
				reasoning: body.reasoning ?? {
					// One of the following (not both):
					effort: "medium", // Can be "high", "medium", or "low" (OpenAI-style)
					//max_tokens: 2000, // Specific token limit (Anthropic-style)
					// Optional: Default is false. All models support this.
					exclude: false, // Set to true to exclude reasoning tokens from response
				},
				// Include tools if provided
				...(body.tools && { tools: body.tools }),
			}),
		}).then((r) => {
			r.headers.set("x-zwc-chat-id", userChatId);
			if (messageIdToReplace)
				r.headers.set("x-zwc-message-to-replace-id", messageIdToReplace);

			if (overrideAssistantTimestamp)
				r.headers.set(
					"x-zwc-override-assistant-timestamp",
					overrideAssistantTimestamp
				);
			return r;
		});
	}
);

export const GET = apiHandler(
	async (
		req: RequestWithSession,
		{ params }: { params: { chatId: string } }
	) => {
		await getCurrentSession(req);
		if (!req.session) throw notAuthorized();
		if (!req.session.email) throw notAuthorized();
		const wsId = (req as ExtendedRequest).wsId;

		const chatId = params.chatId;
		if (!validateUUID(chatId)) {
			return Response.json(
				{ error: "Invalid chat ID format" },
				{ status: 400 }
			);
		}

		const url = new URL(req.url);
		// Parse and validate limit
		const rawLimit = parseInt(url.searchParams.get("limit") || "50");
		const limit =
			!isNaN(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;

		// Parse and validate offset
		const rawOffset = parseInt(url.searchParams.get("offset") || "0");
		const offset = !isNaN(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

		try {
			// a  little sub unsub dance for the current socket
			const prevSubChatId = socketSubs.get(wsId);
			if (prevSubChatId) {
				let prevChatSubSocketIds = chatSubs.get(prevSubChatId.chatId);
				if (prevChatSubSocketIds) {
					prevChatSubSocketIds.delete(wsId);
				}
			}

			let newChatSubSocketIds = chatSubs.get(chatId);
			if (!newChatSubSocketIds) {
				newChatSubSocketIds = new Set();
				chatSubs.set(chatId, newChatSubSocketIds);
			}
			newChatSubSocketIds.add(wsId);
			socketSubs.set(wsId, { chatId, offset: 0 });

			// First verify the user owns this chat
			const chatsCollection = await getChatsCollection();
			const chat = await chatsCollection.findOne({
				id: chatId,
				userEmail: req.session.email,
			});

			if (!chat) {
				return Response.json({ error: "Chat not found" }, { status: 404 });
			}

			// Get messages for this chat
			const messagesCollection = await getMessagesCollection();
			const messages = await messagesCollection
				.find({
					chatId,
					userEmail: req.session.email,
				})
				.sort({ timestamp: 1 }) // Ascending order (oldest first)
				.skip(offset)
				.limit(limit)
				.toArray();

			// Check if there are more messages
			const totalMessages = await messagesCollection.countDocuments({
				chatId,
				userEmail: req.session.email,
			});
			const hasMore = offset + messages.length < totalMessages;

			// Format messages
			const formattedMessages = messages.map((msg) => ({
				id: msg.id,
				role: msg.role,
				content: msg.content,
				reasoning: msg.reasoning,
				model: msg.model, // Include model in response
				timestamp: msg.timestamp,
				promptTokens: msg.promptTokens,
				completionTokens: msg.completionTokens,
				totalTokens: msg.totalTokens,
				timeToFirstToken: msg.timeToFirstToken,
				timeToFinish: msg.timeToFinish,
				annotations: msg.annotations,
				// Include tool-related fields
				tool_calls: msg.tool_calls?.length === 0 ? undefined : msg.tool_calls,
				tool_call_id: msg.tool_call_id,
				name: msg.name,
			}));

			return Response.json({
				chatId,
				messages: formattedMessages,
				hasMore,
			});
		} catch (error) {
			console.error("Failed to fetch messages:", error);
			return Response.json(
				{ error: "Failed to fetch messages" },
				{ status: 500 }
			);
		}
	}
);

export const DELETE = apiHandler(
	async (
		req: RequestWithSession,
		{ params }: { params: { chatId: string } }
	) => {
		await getCurrentSession(req);
		if (!req.session) throw notAuthorized();
		if (!req.session.email) throw notAuthorized();
		const wsId = (req as ExtendedRequest).wsId;

		const chatId = params.chatId;
		if (!validateUUID(chatId)) {
			return Response.json(
				{ error: "Invalid chat ID format" },
				{ status: 400 }
			);
		}

		try {
			// Verify the user owns this chat
			const chatsCollection = await getChatsCollection();
			const chat = await chatsCollection.findOne({
				id: chatId,
				userEmail: req.session.email,
			});

			if (!chat) {
				return Response.json({ error: "Chat not found" }, { status: 404 });
			}

			// Delete all messages for this chat
			const messagesCollection = await getMessagesCollection();

			await messagesCollection.deleteMany({
				chatId,
				userEmail: req.session.email,
			});

			await chatsCollection.deleteOne({
				id: chatId,
				userEmail: req.session.email,
			});

			sendMessageToChatSubs(wsId, chatId, {
				subType: "chat-delete",
				chatId,
			});
			return Response.json({ success: true });
		} catch (error) {
			console.error("Failed to delete chat:", error);
			return Response.json({ error: "Failed to delete chat" }, { status: 500 });
		}
	}
);

export const PUT = apiHandler(
	async (
		req: RequestWithSession,
		{ params }: { params: { chatId: string } }
	) => {
		await getCurrentSession(req);
		if (!req.session) throw notAuthorized();
		if (!req.session.email) throw notAuthorized();
		const wsId = (req as ExtendedRequest).wsId;

		const chatId = params.chatId;
		if (!validateUUID(chatId)) {
			return Response.json(
				{ error: "Invalid chat ID format" },
				{ status: 400 }
			);
		}

		const body = await req.json().catch(() => null);
		if (body === null) throw badRequest("Could not parse the body");

		try {
			// Verify the user owns this chat
			const chatsCollection = await getChatsCollection();
			const chat = await chatsCollection.findOne({
				id: chatId,
				userEmail: req.session.email,
			});

			if (!chat) {
				return Response.json({ error: "Chat not found" }, { status: 404 });
			}

			// Update chat metadata
			const updateData: ChatUpdateData = {
				updatedAt: new Date(),
			};

			if (body.title !== undefined) {
				updateData.title = body.title;
			}

			if (body.pinned !== undefined) {
				updateData.pinnedAt = body.pinned ? new Date() : null;
			}

			await chatsCollection.updateOne(
				{ id: chatId, userEmail: req.session.email },
				{ $set: updateData }
			);

			sendMessageToChatSubs(wsId, chatId, {
				subType: "chat-update",
				chatId,
				body,
			});
			return Response.json({ success: true });
		} catch (error) {
			console.error("Failed to update chat:", error);
			return Response.json({ error: "Failed to update chat" }, { status: 500 });
		}
	}
);
