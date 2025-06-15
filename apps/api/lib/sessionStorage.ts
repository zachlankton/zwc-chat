import {
	sessionCache,
	type SessionData,
} from "../api/auth/session/sessionCache";
import { getSessionsCollection } from "./database";
import { provisioningService } from "./openRouterProvisioning";

export async function getSession(token: string): Promise<SessionData | null> {
	// Try cache first
	const cachedSession = sessionCache.get(token);
	if (cachedSession) {
		console.log("Session found in cache:", cachedSession.email);
		return cachedSession;
	}

	// If not in cache, try MongoDB
	try {
		const sessions = await getSessionsCollection();
		const dbSession = await sessions.findOne({ token });

		if (dbSession) {
			console.log("Session found in MongoDB:", dbSession.email);

			// Decrypt API key if present before caching
			if (dbSession.openRouterApiKey) {
				try {
					const decryptedKey = await provisioningService.decryptKey(
						dbSession.openRouterApiKey
					);
					dbSession.openRouterApiKey = decryptedKey;
				} catch (error) {
					console.error("Failed to decrypt API key for session:", error);
					// Remove the encrypted key if decryption fails
					dbSession.openRouterApiKey = undefined;
				}
			}

			// Restore session to cache with decrypted key
			sessionCache.set(token, dbSession);
			return dbSession;
		}
	} catch (error) {
		console.error("Error fetching session from MongoDB:", error);
	}

	return null;
}

export async function setSession(
	token: string,
	session: SessionData,
	encryptedApiKey?: string
): Promise<void> {
	// Set in cache with decrypted key
	sessionCache.set(token, session);

	// Also save to MongoDB - use encrypted key if provided
	try {
		const sessions = await getSessionsCollection();
		const sessionForDb = encryptedApiKey
			? { ...session, openRouterApiKey: encryptedApiKey }
			: session;
		await sessions.replaceOne({ token }, sessionForDb, { upsert: true });
		console.log("Session saved to MongoDB:", session.email);
	} catch (error) {
		console.error("Error saving session to MongoDB:", error);
	}
}

export async function deleteSession(token: string): Promise<void> {
	// Delete from cache
	sessionCache.delete(token);

	// Also delete from MongoDB
	try {
		const sessions = await getSessionsCollection();
		await sessions.deleteOne({ token });
		console.log("Session deleted from MongoDB");
	} catch (error) {
		console.error("Error deleting session from MongoDB:", error);
	}
}

export async function updateSessionInStorage(
	session: SessionData
): Promise<void> {
	// Update cache with full session
	sessionCache.set(session.token, session);

	// For DB, only update specific fields, never touch the API key
	try {
		const sessions = await getSessionsCollection();
		const { openRouterApiKey, ...sessionWithoutKey } = session;

		// Only update fields that might change, preserve the encrypted API key
		await sessions.updateOne(
			{ token: session.token },
			{
				$set: {
					expiresAt: session.expiresAt,
					// Add any other fields that might be updated
					// but explicitly exclude openRouterApiKey
				},
			}
		);
		console.log("Session updated in MongoDB:", session.email);
	} catch (error) {
		console.error("Error updating session in MongoDB:", error);
	}
}
