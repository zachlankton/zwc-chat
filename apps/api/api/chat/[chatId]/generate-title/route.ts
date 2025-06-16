import type { RequestWithSession } from "api/auth/session/sessionCache";
import { getCurrentSession } from "api/auth/session/utils";
import { apiHandler, badRequest, notAuthorized } from "lib/utils";
import { getMessagesCollection, getChatsCollection } from "lib/database";
import type { ExtendedRequest } from "lib/server-types";
import { sendMessageToChatSubs } from "lib/websockets";

// UUID v4 validation regex
const UUID_V4_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validateUUID = (uuid: string): boolean => {
	return UUID_V4_REGEX.test(uuid);
};

export const POST = apiHandler(
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
			throw badRequest("Invalid chat ID format");
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

			// Get the first few messages of the chat
			const messagesCollection = await getMessagesCollection();
			const messages = await messagesCollection
				.find({
					chatId,
					userEmail: req.session.email,
				})
				.sort({ timestamp: 1 })
				.limit(6) // Get first 3 exchanges max
				.toArray();

			if (messages.length === 0) {
				return Response.json({ error: "No messages found" }, { status: 400 });
			}

			// Prepare messages for the title generation request
			const conversationText = messages
				.map((msg) => {
					const content =
						typeof msg.content === "string"
							? msg.content
							: msg.content.find((c) => c.type === "text")?.text || "";
					return `${msg.role}: ${content}`;
				})
				.join("\n");

			// Use user's API key from session, or fall back to environment key
			const apiKey = req.session.openRouterApiKey;

			if (!apiKey) {
				return Response.json(
					{ error: "No API key available" },
					{ status: 400 }
				);
			}

			// Generate title using OpenRouter API directly
			const response = await fetch(
				"https://openrouter.ai/api/v1/chat/completions",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${apiKey}`,
						"HTTP-Referer": "https://zwc.chat",
						"X-Title": "ZWC Chat",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "openai/gpt-4o-mini",
						stream: false,
						messages: [
							{
								role: "system",
								content:
									"You are a helpful assistant that generates concise, descriptive titles for conversations. Generate a title that captures the main topic or purpose of the conversation. The title should be 3-8 words long, clear, and specific. Do not use quotes, colons, or special formatting. Just return the plain text title.",
							},
							{
								role: "user",
								content: `Generate a title for this conversation:\n\n${conversationText}`,
							},
						],
						temperature: 0.7,
						max_tokens: 20,
					}),
				}
			);

			if (!response.ok) {
				const error = await response.json();
				console.error("OpenRouter API error:", error);
				return Response.json(
					{ error: "Failed to generate title" },
					{ status: 500 }
				);
			}

			const completion = await response.json();
			const generatedTitle =
				completion.choices?.[0]?.message?.content?.trim() || "New Chat";

			// Update the chat with the generated title
			await chatsCollection.updateOne(
				{ id: chatId },
				{
					$set: {
						title: generatedTitle,
						updatedAt: new Date(),
					},
				}
			);

			sendMessageToChatSubs(wsId, chatId, {
				subType: "chat-title-generated",
				generatedTitle,
			});

			return Response.json({
				success: true,
				title: generatedTitle,
			});
		} catch (error) {
			console.error("Failed to generate chat title:", error);
			return Response.json(
				{ error: "Failed to generate title" },
				{ status: 500 }
			);
		}
	}
);
