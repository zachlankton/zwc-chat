import { randomBytes } from "crypto";
import { apiHandler } from "lib/utils";

import { WorkOS } from "@workos-inc/node";
import {
	sessionCache,
	type RequestWithSession,
	type SessionData,
} from "../session/sessionCache";
import { userDefaultRateLimit } from "../session/utils";

const workosApiKey = process.env.WORKOS_API_KEY;
const clientId = process.env.WORKOS_CLIENT_ID;
const redirectUri = process.env.WORKOS_REDIRECT_URI;
const orgId = process.env.WORKOS_ORG_ID;

if (!clientId) throw "WORKOS_CLIENT_ID env var is not set";
if (!redirectUri) throw "WORKOS_REDIRECT_URI env var is not set";
if (!workosApiKey) throw "WORKOS_API_KEY env var is not set";
if (!orgId) throw "WORKOS_ORG_ID env var is not set";

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
	});

	if (auth.organizationId !== orgId) {
		return new Response("Invalid Org", { status: 400 });
	}

	const session: SessionData = {
		token: randomBytes(32).toString("hex"),
		userId: auth.user.id,
		email: auth.user.email,
		name: auth.user.firstName,
		imgSrc: auth.user.profilePictureUrl,
		roles: [],
		expiresAt: new Date(Date.now() + 1000 * 60 * 60),
		requestPerSecondLimit: userDefaultRateLimit,
		requestTimestampHistory: [],
	};

	sessionCache.set(session.token, session);

	// Redirect the user to the homepage
	return new Response(session.token, { status: 201 });
});
