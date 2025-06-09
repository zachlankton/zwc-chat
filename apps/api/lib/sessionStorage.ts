import {
	sessionCache,
	type SessionData,
} from "../api/auth/session/sessionCache";
import { getSessionsCollection } from "./database";

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
			// Restore session to cache
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
	session: SessionData
): Promise<void> {
	// Set in cache
	sessionCache.set(token, session);

	// Also save to MongoDB
	try {
		const sessions = await getSessionsCollection();
		await sessions.replaceOne({ token }, session, { upsert: true });
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
	await setSession(session.token, session);
}

