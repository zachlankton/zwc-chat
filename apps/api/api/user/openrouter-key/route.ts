import type { RequestWithSession } from "api/auth/session/sessionCache";
import { getCurrentSession } from "api/auth/session/utils";
import { apiHandler, badRequest, notAuthorized } from "lib/utils";
import { connectToDatabase, getUsersCollection } from "lib/database";
import { provisioningService } from "lib/openRouterProvisioning";
import { setSession } from "lib/sessionStorage";

export const PUT = apiHandler(async (req: RequestWithSession) => {
	await getCurrentSession(req);
	if (!req.session) throw notAuthorized();
	if (!req.session.email) throw notAuthorized();

	const body = await req.json().catch(() => null);
	if (!body || !body.key) {
		throw badRequest("API key is required");
	}

	try {
		// Validate the key format (basic check)
		if (!body.key.startsWith("sk-or-")) {
			throw badRequest("Invalid OpenRouter API key format");
		}

		// Encrypt the API key before storing
		const encryptedKey = await provisioningService.encryptKey(body.key);

		if (!encryptedKey) {
			throw badRequest("Failed to encrypt API key");
		}

		// Update the user's OpenRouter key in the database
		await connectToDatabase();
		const usersCollection = await getUsersCollection();

		await usersCollection.updateOne(
			{ email: req.session.email },
			{
				$set: {
					openRouterApiKey: encryptedKey,
					openRouterKeyAddedAt: new Date(),
					hasOwnOpenRouterKey: true,
				},
			}
		);

		// Update the session with the new key
		req.session.openRouterApiKey = body.key;
		req.session.hasOwnOpenRouterKey = true;

		// Save the updated session
		await setSession(req.session.token, req.session, encryptedKey);

		return Response.json({
			success: true,
			message: "OpenRouter API key saved successfully",
		});
	} catch (error) {
		console.error("Error saving OpenRouter key:", error);
		if (error instanceof Error && error.message.includes("Invalid")) {
			throw error;
		}
		return Response.json({ error: "Failed to save API key" }, { status: 500 });
	}
});
