import type { RequestWithSession } from "api/auth/session/sessionCache";
import { getCurrentSession } from "api/auth/session/utils";
import { apiHandler, badRequest, notAuthorized } from "lib/utils";
import {
	getMessagesCollection,
	getChatsCollection,
	type Chat,
} from "lib/database";

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

		const chatId = params.chatId;
		if (!validateUUID(chatId)) {
			throw badRequest("Invalid chat ID format");
		}

		const body = await req.json().catch(() => null);
		if (body === null) throw badRequest("Could not parse the body");
		if (!body.messageId) throw badRequest("messageId is required");
		if (!body.messageIndex) throw badRequest("messageIndex is required");

		try {
			// Verify the user owns this chat
			const chatsCollection = await getChatsCollection();
			const originalChat = await chatsCollection.findOne({
				id: chatId,
				userEmail: req.session.email,
			});

			if (!originalChat) {
				return Response.json({ error: "Chat not found" }, { status: 404 });
			}

			// Get all messages up to and including the specified message
			const messagesCollection = await getMessagesCollection();
			const messages = await messagesCollection
				.find({
					chatId,
					userEmail: req.session.email,
				})
				.sort({ timestamp: 1 })
				.toArray();

			// Take only messages up to the specified index
			const messagesToCopy = messages.slice(0, body.messageIndex + 1);

			// Generate new chat ID
			const newChatId = crypto.randomUUID();
			const now = new Date();

			// Create the new chat with branching info
			const newChat: Chat = {
				id: newChatId,
				userEmail: req.session.email,
				title: `${originalChat.title} (Branch)`,
				createdAt: now,
				updatedAt: now,
				messageCount: messagesToCopy.length,
				branchedFrom: {
					chatId: originalChat.id,
					messageId: body.messageId,
					branchedAt: now,
				},
			};

			await chatsCollection.insertOne(newChat);

			// Copy messages to the new chat
			const newMessages = messagesToCopy.map((msg) => ({
				...msg,
				_id: undefined, // Remove MongoDB _id to create new documents
				chatId: newChatId,
				id: crypto.randomUUID(), // Generate new message IDs
			}));

			if (newMessages.length > 0) {
				await messagesCollection.insertMany(newMessages);
			}

			// Set the last message for the new chat
			if (messagesToCopy.length > 0) {
				const lastMessage = messagesToCopy[messagesToCopy.length - 1];
				let lastMessageText = "";
				if (typeof lastMessage.content === "string") {
					lastMessageText = lastMessage.content;
				} else if (Array.isArray(lastMessage.content)) {
					const textPart = lastMessage.content.find(
						(item: any) => item.type === "text"
					) as any;
					lastMessageText = textPart?.text || "Branch created";
				}

				await chatsCollection.updateOne(
					{ id: newChatId },
					{
						$set: {
							lastMessage:
								lastMessageText.substring(0, 100) +
								(lastMessageText.length > 100 ? "..." : ""),
						},
					}
				);
			}

			return Response.json({
				success: true,
				newChatId,
				branchedFrom: {
					chatId: originalChat.id,
					messageId: body.messageId,
				},
			});
		} catch (error) {
			console.error("Failed to branch chat:", error);
			return Response.json({ error: "Failed to branch chat" }, { status: 500 });
		}
	}
);

