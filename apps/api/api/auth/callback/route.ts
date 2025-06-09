import { randomBytes } from "crypto";
import { apiHandler } from "lib/utils";

import { WorkOS } from "@workos-inc/node";
import {
	sessionCache,
	type RequestWithSession,
	type SessionData,
} from "../session/sessionCache";
import { userDefaultRateLimit } from "../session/utils";
import { setSession } from "lib/sessionStorage";

const workosApiKey = process.env.WORKOS_API_KEY;
const clientId = process.env.WORKOS_CLIENT_ID;
const redirectUri = process.env.WORKOS_REDIRECT_URI;
const cookiePW = process.env.WORKOS_COOKIE_PW;

if (!clientId) throw "WORKOS_CLIENT_ID env var is not set";
if (!redirectUri) throw "WORKOS_REDIRECT_URI env var is not set";
if (!workosApiKey) throw "WORKOS_API_KEY env var is not set";
if (!cookiePW) throw "WORKOS_COOKIE_PW env var is not set";

const workos = new WorkOS(workosApiKey, { clientId });

export const GET = apiHandler(async (req: RequestWithSession) => {
	// The authorization code returned by AuthKit
	const url = new URL(req.url);
	const code = url.searchParams.get("code");

	if (!code) {
		return new Response("No code provided", { status: 400 });
	}

	const auth = await workos.userManagement.authenticateWithCode({
		code,
		clientId,
		session: {
			sealSession: true,
			cookiePassword: cookiePW,
		},
	});

	const session: SessionData = {
		token: randomBytes(32).toString("hex"),
		userId: auth.user.id,
		email: auth.user.email,
		name: auth.user.firstName,
		imgSrc: auth.user.profilePictureUrl,
		roles: JSON.parse(auth.user.metadata.roles ?? "[]") as string[],
		isSubscribed: JSON.parse(auth.user.metadata.isSubscribed ?? "false"),
		data: auth.sealedSession!,
		expiresAt: new Date(Date.now() + 1000 * 60 * 60),
		requestPerSecondLimit: userDefaultRateLimit,
		requestTimestampHistory: [],
	};

	await setSession(session.token, session);

	// Redirect the user to the homepage
	return Response.json(
		{
			token: session.token,
			userId: session.userId,
			email: session.email,
			name: session.name,
			imgSrc: session.imgSrc,
			roles: session.roles,
			isSubscribed: session.isSubscribed,
			expiresAt: session.expiresAt,
			requestPerSecondLimit: session.requestPerSecondLimit,
		},
		{ status: 201 }
	);
});
