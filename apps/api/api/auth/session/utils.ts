import { randomBytes } from "crypto";
import type { RequestWithSession, SessionData } from "./sessionCache";
import { updateSessionExpiry } from "./sessionCache";
import { internalServerError, notAuthorized, rateLimitError } from "lib/utils";
import { asyncLocalStorage } from "lib/asyncLocalStore";
import {
	getSession,
	setSession,
	deleteSession as deleteSessionFromStorage,
} from "lib/sessionStorage";

export const userDefaultRateLimit = "50:10";

export async function createSession(user: any) {
	const userSession: SessionData = {
		...user,
		token: randomBytes(32).toString("hex"),
		expiresAt: new Date(Date.now() + 1000 * 60 * 60),
		requestPerSecondLimit: user.requestPerSecondLimit ?? userDefaultRateLimit,
	};

	await setSession(userSession.token, userSession);

	return userSession;
}

export async function updateSession(sess: SessionData, user: any) {
	const userSession: SessionData = {
		...sess,
		...user,
	};

	// update session in db
	console.log("Updating Session into DB", user.email);
	await setSession(userSession.token, userSession);

	return userSession;
}

export async function deleteSession(sessionId: string) {
	await deleteSessionFromStorage(sessionId);
}

const adminKey = process.env.ADMIN_KEY;
if (!adminKey) throw "ADMIN_KEY env var is not set";

export function validateAdminKeyHeader(req: RequestWithSession) {
	const authHeader = req.headers.get("authorization");
	if (!authHeader) {
		return null;
	}

	const authorization = authHeader?.slice(7);

	if (authorization !== adminKey) throw notAuthorized();
}

export async function getCurrentSession(req: RequestWithSession) {
	const authHeader = req.headers.get("authorization");
	if (!authHeader) {
		return null;
	}
	const authorization = authHeader?.slice(7);

	//attempt cache first, then MongoDB
	const session = await getSession(authorization);

	// if empty return early
	if (!session) {
		console.log(
			"No Session Found for token: ",
			authorization.substring(0, 8) + "..."
		);
		return null;
	}

	req.session = session;
	await updateSessionExpiry(req.session);

	const reqCtx = asyncLocalStorage.getStore();

	if (reqCtx && !reqCtx.rateLogged && process.env.DEV !== "TRUE") {
		reqCtx.rateLogged = true;

		if (userRateLimit(req))
			throw rateLimitError(
				`Too Many Requests. Rate Limit Exceeded for user ${reqCtx.session.email}`
			);
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
