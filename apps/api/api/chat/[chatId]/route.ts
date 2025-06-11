import type { RequestWithSession } from "api/auth/session/sessionCache";
import { getCurrentSession } from "api/auth/session/utils";
import { apiHandler, badRequest, notAuthorized } from "lib/utils";
import {
	getMessagesCollection,
	getChatsCollection,
	type OpenRouterMessage,
	getMongoClient,
} from "lib/database";

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
}

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
		if (!validateUUID(userChatId)) {
			throw badRequest("Invalid chat ID format");
		}

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
							$inc: { messageCount: 1 },
						},
						{ upsert: true }
					);
				}
			}
		} catch (error) {
			console.error("Failed to save user message:", error);
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";
			return Response.json(
				{
					error: "Failed to save message. Please try again.",
					details:
						process.env.NODE_ENV === "development" ? errorMessage : undefined,
				},
				{ status: 500 }
			);
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
				timestamp: msg.timestamp,
				promptTokens: msg.promptTokens,
				completionTokens: msg.completionTokens,
				totalTokens: msg.totalTokens,
				timeToFirstToken: msg.timeToFirstToken,
				timeToFinish: msg.timeToFinish,
				annotations: msg.annotations,
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

			const session = getMongoClient().startSession();

			try {
				await session.withTransaction(async () => {
					await messagesCollection.deleteMany(
						{ chatId, userEmail: req.session.email },
						{ session }
					);
					await chatsCollection.deleteOne(
						{ id: chatId, userEmail: req.session.email },
						{ session }
					);
				});
			} finally {
				await session.endSession();
			}

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
