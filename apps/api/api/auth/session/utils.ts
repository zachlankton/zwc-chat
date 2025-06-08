import { randomBytes } from "crypto";
import type { RequestWithSession, SessionData } from "./sessionCache";
import { updateSessionExpiry, sessionCache } from "./sessionCache";
import { internalServerError, rateLimitError } from "lib/utils";
import { asyncLocalStorage } from "lib/asyncLocalStore";

export const userDefaultRateLimit = "20:5";

export async function createSession(user: any) {
	const userSession: SessionData = {
		...user,
		token: randomBytes(32).toString("hex"),
		expiresAt: new Date(Date.now() + 1000 * 60 * 60),
		requestPerSecondLimit: user.requestPerSecondLimit ?? userDefaultRateLimit,
	};

	sessionCache.set(userSession.token, userSession);

	return userSession;
}

export async function updateSession(sess: SessionData, user: any) {
	const userSession: SessionData = {
		...sess,
		...user,
	};

	// update session in db
	console.log("Updating Session into DB", user.email);
	sessionCache.set(userSession.token, userSession);

	return userSession;
}

export async function deleteSession(sessionId: string) {
	sessionCache.delete(sessionId);
}

export async function getCurrentSession(req: RequestWithSession) {
	const authHeader = req.headers.get("authorization");
	if (!authHeader) {
		return null;
	}
	const authorization = authHeader?.slice(7);

	//attempt cache first
	const cacheSession = sessionCache.get(authorization);

	// if empty return early
	if (!cacheSession) {
		console.log("No Session Found for token: ", authorization);
		return null;
	}

	req.session = cacheSession;
	await updateSessionExpiry(req.session);

	const reqCtx = asyncLocalStorage.getStore();

	if (reqCtx && !reqCtx.rateLogged && process.env.DEV !== "TRUE") {
		reqCtx.rateLogged = true;

		if (userRateLimit(req)) throw rateLimitError();
	}

	return req.session;
}

function userRateLimit(req: RequestWithSession) {
	req.session.requestTimestampHistory =
		req.session.requestTimestampHistory || [];

	const now = Date.now();
	const oneSecondAgo = now - 1000;
	req.session.requestTimestampHistory.push(now);

	const [readLimit, writeLimit] = req.session.requestPerSecondLimit.split(":");

	const rateLimit =
		req.method === "GET" ? Number(readLimit) : Number(writeLimit);

	if (req.session.requestTimestampHistory.length < rateLimit) return false;

	const oldest = req.session.requestTimestampHistory.shift();

	if (oldest === undefined)
		throw internalServerError(
			"Unexpected: oldest is undefined in getCurrentSession"
		);

	if (oldest < oneSecondAgo) return false;

	return true;
}
