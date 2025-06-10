import type { RequestWithSession } from "api/auth/session/sessionCache";
import { getCurrentSession } from "api/auth/session/utils";
import { apiHandler, badRequest, notAuthorized } from "lib/utils";

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

		const userChatId = `${req.session.email}|${params.chatId}`;

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
