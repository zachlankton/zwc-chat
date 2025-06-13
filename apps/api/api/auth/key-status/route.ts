import type { RequestWithSession } from "api/auth/session/sessionCache";
import { getCurrentSession } from "../session/utils";
import { apiHandler, notAuthorized } from "lib/utils";

export const GET = apiHandler(async (req: RequestWithSession) => {
	await getCurrentSession(req);
	if (!req.session) throw notAuthorized();
	if (!req.session.email) throw notAuthorized();

	// Only check user's API key, never expose system key info
	if (!req.session.openRouterApiKey) {
		return Response.json({
			hasApiKey: false,
			message: "No personal API key configured",
		});
	}

	try {
		// Call OpenRouter API to check key status
		const response = await fetch("https://openrouter.ai/api/v1/key", {
			method: "GET",
			headers: {
				Authorization: `Bearer ${req.session.openRouterApiKey}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			// If the key is invalid or there's an error
			const errorData = await response.text();
			console.error("OpenRouter API key check failed:", errorData);

			return Response.json({
				hasApiKey: true,
				valid: false,
				error: "Invalid API key",
			});
		}

		// Parse the response from OpenRouter
		const keyData = await response.json();

		// Return the key status information
		return Response.json({
			hasApiKey: true,
			valid: true,
			data: keyData.data,
		});
	} catch (error) {
		console.error("Error checking API key status:", error);
		return Response.json(
			{
				error: "Failed to check API key status",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
});
