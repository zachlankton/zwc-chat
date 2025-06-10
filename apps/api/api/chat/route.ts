import type { RequestWithSession } from "api/auth/session/sessionCache";
import { getCurrentSession } from "api/auth/session/utils";
import { apiHandler, notAuthorized } from "lib/utils";
import { getChatsCollection } from "lib/database";

export const GET = apiHandler(async (req: RequestWithSession) => {
	await getCurrentSession(req);
	if (!req.session) throw notAuthorized();
	if (!req.session.email) throw notAuthorized();

	const url = new URL(req.url);
	const limit = parseInt(url.searchParams.get('limit') || '20');
	const offset = parseInt(url.searchParams.get('offset') || '0');

	try {
		const chatsCollection = await getChatsCollection();
		
		// Get total count
		const total = await chatsCollection.countDocuments({ userEmail: req.session.email });
		
		// Get paginated chats
		const chats = await chatsCollection
			.find({ userEmail: req.session.email })
			.sort({ updatedAt: -1 })
			.skip(offset)
			.limit(limit)
			.toArray();

		// Format response
		const formattedChats = chats.map(chat => ({
			id: chat.id,
			title: chat.title,
			lastMessage: chat.lastMessage,
			updatedAt: chat.updatedAt.toISOString(),
			messageCount: chat.messageCount
		}));

		return Response.json({
			chats: formattedChats,
			total,
			limit,
			offset
		});
	} catch (error) {
		console.error('Failed to fetch chats:', error);
		return Response.json({ error: 'Failed to fetch chats' }, { status: 500 });
	}
});