import { notAuthorized } from "lib/utils";
import { deleteSession, updateSessionInStorage } from "lib/sessionStorage";

export const sessionCache = new Map<string, SessionData>();

export interface RequestWithSession extends Request {
	session: SessionData;
}

export interface SessionData {
	userId: string;
	email: string;
	name: string | null;
	imgSrc: string | null;
	roles: string[];
	isSubscribed: boolean;
	token: string;
	data: string;
	expiresAt: Date;
	requestTimestampHistory: number[];
	requestPerSecondLimit: string;
	openRouterApiKey?: string;
	hasOwnOpenRouterKey?: boolean;
}

export function userIsSuperAdmin(req: RequestWithSession) {
	const userIsSuperAdmin = req.session.roles.includes("superAdmin");

	if (userIsSuperAdmin) return true;

	return false;
}

export async function updateSessionExpiry(sess: SessionData) {
	// get time left until expiry
	const timeLeft = new Date(sess.expiresAt).getTime() - Date.now();

	if (timeLeft < 0) {
		await deleteSession(sess.token);
		throw notAuthorized("Session Expired");
	}

	// check if time left is less than 50 minutes
	if (timeLeft < 1000 * 60 * 50) {
		sess.expiresAt = new Date(Date.now() + 1000 * 60 * 60);

		await updateSessionInStorage(sess);
		console.log("Updated session expiry", sess.email, sess.token);
	}
}
