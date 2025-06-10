import type { RequestWithSession } from "api/auth/session/sessionCache";
import { getCurrentSession } from "api/auth/session/utils";
import { apiHandler, badRequest, notAuthorized } from "lib/utils";
import {
	getMessagesCollection,
	getChatsCollection,
	type OpenRouterMessage,
	type Chat,
} from "lib/database";

const DEEPSEEK_R1_QWEN3_8B_FREE = "deepseek/deepseek-r1-0528-qwen3-8b:free";
const supportedModels = [DEEPSEEK_R1_QWEN3_8B_FREE];

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

		const body = await req.json().catch(() => null);
		if (body === null) throw badRequest("Could not parse the body");
		if (!body.messages) throw badRequest("messages[] key is required");
		if (body.model && !supportedModels.includes(body.model))
			throw badRequest(`We do not currently support model: ${body.model}`);

		const userChatId = params.chatId;

		// Save user message before processing
		try {
			const messages = body.messages;
			if (messages && messages.length > 0) {
				const lastMessage = messages[messages.length - 1];
				if (lastMessage.role === "user") {
					const chatId = userChatId;
					const userMessageId = crypto.randomUUID();
					const userMessage: OpenRouterMessage = {
						id: userMessageId,
						chatId,
						userEmail: req.session.email,
						content: lastMessage.content,
						role: "user",
						timestamp: Date.now(),
					};

					const messagesCollection = await getMessagesCollection();
					await messagesCollection.insertOne(userMessage);
					console.log(`User message saved to database for chat ${chatId}`);

					// Update chat with user message
					const chatsCollection = await getChatsCollection();
					const existingChat = await chatsCollection.findOne({
						id: chatId,
						userEmail: req.session.email,
					});

					if (!existingChat) {
						// Create new chat if it doesn't exist
						const newChat: Chat = {
							id: chatId,
							userEmail: req.session.email,
							title:
								lastMessage.content.substring(0, 50) +
								(lastMessage.content.length > 50 ? "..." : ""),
							createdAt: new Date(),
							updatedAt: new Date(),
							lastMessage:
								lastMessage.content.substring(0, 100) +
								(lastMessage.content.length > 100 ? "..." : ""),
							messageCount: 1,
						};
						await chatsCollection.insertOne(newChat);
					}
				}
			}
		} catch (error) {
			console.error("Failed to save user message:", error);
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
				model: DEEPSEEK_R1_QWEN3_8B_FREE,
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
			}),
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

		const chatId = params.chatId;
		const url = new URL(req.url);
		const limit = parseInt(url.searchParams.get("limit") || "50");
		const offset = parseInt(url.searchParams.get("offset") || "0");

		try {
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
				timestamp: new Date(msg.timestamp).toISOString(),
				promptTokens: msg.promptTokens,
				completionTokens: msg.completionTokens,
				totalTokens: msg.totalTokens,
				timeToFirstToken: msg.timeToFirstToken,
				timeToFinish: msg.timeToFinish,
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

		const chatId = params.chatId;

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

			// Delete the chat record
			await chatsCollection.deleteOne({
				id: chatId,
				userEmail: req.session.email,
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

		const chatId = params.chatId;
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
			const updateData: any = {
				updatedAt: new Date(),
			};

			if (body.title !== undefined) {
				updateData.title = body.title;
			}

			await chatsCollection.updateOne(
				{ id: chatId, userEmail: req.session.email },
				{ $set: updateData }
			);

			return Response.json({ success: true });
		} catch (error) {
			console.error("Failed to update chat:", error);
			return Response.json({ error: "Failed to update chat" }, { status: 500 });
		}
	}
);
